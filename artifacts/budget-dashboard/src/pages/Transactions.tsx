import { useState, useCallback } from "react";
import {
  useGetTransactions,
  useGetCategories,
  useGetPartners,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@workspace/api-client-react";
import type {
  Transaction,
  TransactionInput,
  GetTransactionsType,
  GetTransactionsOwnership,
  TransactionInputType,
  TransactionInputOwnership,
  TransactionInputSplitType,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate, currentMonth, monthOptions } from "@/lib/format";

const EMPTY_FORM: TransactionInput = {
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  merchant: "",
  notes: "",
  type: "expense",
  ownership: "shared",
  splitType: "fifty_fifty",
  splitRatio: null,
  paidById: 1,
  categoryId: 7,
  accountId: 1,
  isRecurring: false,
};

const SPLIT_TYPE_LABELS: Record<string, string> = {
  fifty_fifty: "50/50",
  custom: "Custom %",
  personal: "Personal",
  settle_later: "Settle Later",
};

type SortField = "date" | "amount" | "merchant";
type SortDir = "asc" | "desc";

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
}

function exportCsv(transactions: Transaction[]) {
  const header = ["Date", "Merchant", "Category", "Paid By", "Type", "Ownership", "Split", "Amount", "Notes"];
  const rows = transactions.map((tx) => [
    tx.date,
    `"${tx.merchant.replace(/"/g, '""')}"`,
    tx.categoryName ?? "",
    tx.paidByName ?? String(tx.paidById),
    tx.type,
    tx.ownership,
    tx.splitType ?? "",
    tx.amount,
    `"${(tx.notes ?? "").replace(/"/g, '""')}"`,
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Transactions() {
  const queryClient = useQueryClient();

  // Filters
  const [filterMode, setFilterMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(currentMonth());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [recurringFilter, setRecurringFilter] = useState<string>("all");

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Selection (bulk actions)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params = {
    ...(filterMode === "month"
      ? { month }
      : { startDate: startDate || null, endDate: endDate || null }),
    search: search || null,
    type: typeFilter !== "all" ? (typeFilter as GetTransactionsType) : null,
    ownership: ownerFilter !== "all" ? (ownerFilter as GetTransactionsOwnership) : null,
    categoryId: categoryFilter !== "all" ? Number(categoryFilter) : null,
    isRecurring: recurringFilter !== "all" ? recurringFilter === "yes" : undefined,
    sortBy,
    sortDir,
    limit: 500,
    offset: 0,
  };

  const { data: txData, isLoading } = useGetTransactions(params, {
    query: { queryKey: ["/api/transactions", params] },
  });
  const { data: categories } = useGetCategories();
  const { data: partners } = useGetPartners();

  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

  const toggleSort = useCallback((field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setSelected(new Set());
  }, [sortBy]);

  const openNew = () => { setEditTx(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    setForm({
      date: tx.date,
      amount: tx.amount,
      merchant: tx.merchant,
      notes: tx.notes ?? "",
      type: tx.type,
      ownership: tx.ownership,
      splitType: tx.splitType ?? "fifty_fifty",
      splitRatio: tx.splitRatio ?? null,
      paidById: tx.paidById,
      categoryId: tx.categoryId,
      accountId: tx.accountId ?? null,
      isRecurring: tx.isRecurring ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editTx) {
      await updateTx.mutateAsync({ id: editTx.id, data: form });
    } else {
      await createTx.mutateAsync({ data: form });
    }
    invalidate();
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId !== null) {
      await deleteTx.mutateAsync({ id: deleteId });
      invalidate();
      setDeleteId(null);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      await deleteTx.mutateAsync({ id });
    }
    setSelected(new Set());
    invalidate();
    setBulkDeleteOpen(false);
  };

  const transactions = txData?.data ?? [];

  const allIds = new Set(transactions.map((t) => t.id));
  const allSelected = allIds.size > 0 && [...allIds].every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleOne = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  };

  const thCls = "text-left px-3 py-3 text-xs font-medium text-muted-foreground";
  const sortTh = (field: SortField, label: string) => (
    <th className={thCls}>
      <button
        className="flex items-center hover:text-foreground transition-colors"
        onClick={() => toggleSort(field)}
      >
        {label}
        <SortIcon field={field} current={sortBy} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm">{txData?.total ?? 0} transactions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {someSelected && (
            <Button variant="destructive" className="gap-2" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-4 h-4" /> Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => exportCsv(transactions)} disabled={transactions.length === 0}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-40 flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search merchants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as "month" | "range")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">By Month</SelectItem>
                <SelectItem value="range">Date Range</SelectItem>
              </SelectContent>
            </Select>

            {filterMode === "month" ? (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions(12).map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
              </>
            )}

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={recurringFilter} onValueChange={setRecurringFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Recurring" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">
                  <span className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Recurring</span>
                </SelectItem>
                <SelectItem value="no">Non-recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-3 w-8">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  {sortTh("date", "Date")}
                  {sortTh("merchant", "Merchant")}
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Paid By</th>
                  <th className={thCls}>Ownership</th>
                  <th className={thCls}>Split</th>
                  {sortTh("amount", "Amount")}
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : transactions.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No transactions found for the selected filters.
                      </td>
                    </tr>
                  )
                  : transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selected.has(tx.id) ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={selected.has(tx.id)}
                            onCheckedChange={() => toggleOne(tx.id)}
                            aria-label={`Select ${tx.merchant}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="px-3 py-2.5">
                          <div>
                            <p className="font-medium text-foreground">{tx.merchant}</p>
                            {tx.notes && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{tx.notes}</p>}
                            {tx.isRecurring && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500">
                                <RefreshCw className="w-2.5 h-2.5" /> Recurring
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {tx.categoryName && (
                            <Badge
                              style={{
                                backgroundColor: (tx.categoryColor || "#6366f1") + "22",
                                color: tx.categoryColor || "#6366f1",
                                borderColor: (tx.categoryColor || "#6366f1") + "44",
                              }}
                              variant="outline"
                              className="text-xs whitespace-nowrap"
                            >
                              {tx.categoryName}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {tx.paidByName ?? `Partner ${tx.paidById}`}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={tx.ownership === "shared" ? "secondary" : "outline"} className="text-xs">
                            {tx.ownership}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {SPLIT_TYPE_LABELS[tx.splitType ?? "fifty_fifty"]}
                          {tx.splitType === "custom" && tx.splitRatio != null && ` (${tx.splitRatio}%)`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          <span className={tx.type === "income" ? "text-emerald-600" : "text-foreground"}>
                            {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(tx)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(tx.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTx ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Merchant</Label>
              <Input value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as TransactionInputType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ownership</Label>
              <Select value={form.ownership} onValueChange={(v) => setForm((f) => ({ ...f, ownership: v as TransactionInputOwnership }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Split Type</Label>
              <Select
                value={form.splitType}
                onValueChange={(v) => setForm((f) => ({
                  ...f,
                  splitType: v as TransactionInputSplitType,
                  splitRatio: v === "custom" ? (f.splitRatio ?? 50) : null,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifty_fifty">50/50 Split</SelectItem>
                  <SelectItem value="custom">Custom %</SelectItem>
                  <SelectItem value="personal">Fully Personal</SelectItem>
                  <SelectItem value="settle_later">Settle Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.splitType === "custom" && (
              <div className="space-y-1.5">
                <Label>Split Ratio (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={form.splitRatio ?? 50}
                  onChange={(e) => setForm((f) => ({ ...f, splitRatio: parseFloat(e.target.value) || 50 }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={String(form.categoryId)}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paid By</Label>
              <Select
                value={String(form.paidById)}
                onValueChange={(v) => setForm((f) => ({ ...f, paidById: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {partners?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch
                checked={form.isRecurring ?? false}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isRecurring: v }))}
              />
              <Label>Recurring transaction</Label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTx.isPending || updateTx.isPending}>
              {editTx ? "Save Changes" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Transaction?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTx.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {selected.size} transactions?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete {selected.size} selected transactions. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleteTx.isPending}>
              Delete {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
