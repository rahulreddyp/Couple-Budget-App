import { useState } from "react";
import {
  useGetBudgets,
  useGetBudgetVsActual,
  useGetCategories,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from "@workspace/api-client-react";
import type { Budget } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, currentMonth, monthOptions } from "@/lib/format";

export default function Budgets() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState({ categoryId: 7, amount: 500 });

  const { data: budgets, isLoading: loadingBudgets } = useGetBudgets({ month }, { query: { queryKey: ["/api/budgets", month] } });
  const { data: bva } = useGetBudgetVsActual({ month }, { query: { queryKey: ["/api/dashboard/budget-vs-actual", month] } });
  const { data: categories } = useGetCategories();

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });

  const openNew = () => { setEditBudget(null); setForm({ categoryId: 7, amount: 500 }); setDialogOpen(true); };
  const openEdit = (b: Budget) => { setEditBudget(b); setForm({ categoryId: b.categoryId, amount: b.amount }); setDialogOpen(true); };

  const handleSave = async () => {
    if (editBudget) {
      await updateBudget.mutateAsync({ id: editBudget.id, data: { amount: form.amount } });
    } else {
      await createBudget.mutateAsync({ data: { month, categoryId: form.categoryId, amount: form.amount, rolloverEnabled: false } });
    }
    invalidate();
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/budget-vs-actual"] });
    setDialogOpen(false);
  };

  const handleDelete = async (id: number) => {
    await deleteBudget.mutateAsync({ id });
    invalidate();
  };

  const bvaMap = new Map(bva?.map((b) => [b.categoryId, b]));

  const totalBudget = budgets?.reduce((s, b) => s + b.amount, 0) ?? 0;
  const totalActual = bva?.reduce((s, b) => s + b.actual, 0) ?? 0;
  const overBudgetCount = bva?.filter((b) => b.actual > b.budgeted).length ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track spending against your monthly targets</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions(6).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add Budget
          </Button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Budget</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Spent</p>
            <p className={`text-xl font-bold mt-1 ${totalActual > totalBudget ? "text-destructive" : "text-foreground"}`}>{formatCurrency(totalActual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Over Budget</p>
            <p className={`text-xl font-bold mt-1 ${overBudgetCount > 0 ? "text-destructive" : "text-emerald-600"}`}>{overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget list */}
      <div className="space-y-3">
        {loadingBudgets
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          : budgets?.map((budget) => {
              const bvaItem = bvaMap.get(budget.categoryId);
              const actual = bvaItem?.actual ?? 0;
              const pct = budget.amount > 0 ? Math.min((actual / budget.amount) * 100, 100) : 0;
              const over = actual > budget.amount;
              const cat = categories?.find((c) => c.id === budget.categoryId);

              return (
                <Card key={budget.id}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat?.color || "#6366f1" }} />
                        <span className="font-medium text-sm">{cat?.name ?? `Category ${budget.categoryId}`}</span>
                        {over && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Over budget</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(budget)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(budget.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className="h-2"
                      style={{ "--progress-fill": over ? "hsl(var(--destructive))" : cat?.color || "hsl(var(--primary))" } as any}
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">{formatCurrency(actual)} spent</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency(budget.amount)} budget</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBudget ? "Edit Budget" : "Add Budget"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editBudget && (
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={String(form.categoryId)} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Budget Amount ($)</Label>
              <Input type="number" step="10" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createBudget.isPending || updateBudget.isPending}>
              {editBudget ? "Save" : "Add Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
