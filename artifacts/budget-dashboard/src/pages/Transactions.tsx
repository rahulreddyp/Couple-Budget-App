import { useState } from "react";
import {
  useGetTransactions,
  useGetCategories,
  useGetPartners,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@workspace/api-client-react";
import type { Transaction, TransactionInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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

export default function Transactions() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionInput>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params = {
    month,
    search: search || null,
    type: typeFilter !== "all" ? (typeFilter as any) : null,
    ownership: ownerFilter !== "all" ? (ownerFilter as any) : null,
    categoryId: categoryFilter !== "all" ? Number(categoryFilter) : null,
    limit: 100,
    offset: 0,
  };

  const { data: txData, isLoading } = useGetTransactions(params, { query: { queryKey: ["/api/transactions", params] } });
  const { data: categories } = useGetCategories();
  const { data: partners } = useGetPartners();

  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

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
      await updateTx.mutateAsync({ transactionId: editTx.id, data: form });
    } else {
      await createTx.mutateAsync({ data: form });
    }
    invalidate();
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId !== null) {
      await deleteTx.mutateAsync({ transactionId: deleteId });
      invalidate();
      setDeleteId(null);
    }
  };

  const transactions = txData?.data ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground text-sm">{txData?.total ?? 0} transactions found</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search merchants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions(6).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Merchant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Paid By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ownership</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{tx.merchant}</p>
                            {tx.notes && <p className="text-xs text-muted-foreground">{tx.notes}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tx.categoryName && (
                            <Badge
                              style={{ backgroundColor: (tx.categoryColor || "#6366f1") + "22", color: tx.categoryColor || "#6366f1", borderColor: (tx.categoryColor || "#6366f1") + "44" }}
                              variant="outline"
                              className="text-xs"
                            >
                              {tx.categoryName}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{tx.paidByName ?? `Partner ${tx.paidById}`}</td>
                        <td className="px-4 py-3">
                          <Badge variant={tx.ownership === "shared" ? "secondary" : "outline"} className="text-xs">
                            {tx.ownership}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={tx.type === "income" ? "text-emerald-600" : "text-foreground"}>
                            {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(tx)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(tx.id)}>
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
        <DialogContent className="max-w-lg">
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
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Merchant</Label>
              <Input value={form.merchant} onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ownership</Label>
              <Select value={form.ownership} onValueChange={(v) => setForm((f) => ({ ...f, ownership: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={String(form.categoryId)} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paid By</Label>
              <Select value={String(form.paidById)} onValueChange={(v) => setForm((f) => ({ ...f, paidById: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {partners?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
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

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTx.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
