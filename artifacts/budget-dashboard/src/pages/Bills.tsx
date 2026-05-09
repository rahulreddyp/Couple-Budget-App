import { useState } from "react";
import {
  useGetBills,
  useCreateBill,
  useUpdateBill,
  useDeleteBill,
  useMarkBillPaid,
  useGetCategories,
  useGetPartners,
} from "@workspace/api-client-react";
import type { Bill } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const EMPTY_FORM = {
  name: "",
  amount: 0,
  dueDay: 1,
  frequency: "monthly" as const,
  ownership: "shared" as const,
  paidById: 1,
  categoryId: null as number | null,
  isActive: true,
  isPaidThisCycle: false,
  notes: "",
};

export default function Bills() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBill, setEditBill] = useState<Bill | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: bills, isLoading } = useGetBills();
  const { data: categories } = useGetCategories();
  const { data: partners } = useGetPartners();

  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  const markPaid = useMarkBillPaid();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/bills"] });

  const openNew = () => { setEditBill(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (b: Bill) => {
    setEditBill(b);
    setForm({
      name: b.name,
      amount: b.amount,
      dueDay: b.dueDay,
      frequency: b.frequency as any,
      ownership: b.ownership as any,
      paidById: b.paidById,
      categoryId: b.categoryId ?? null,
      isActive: b.isActive ?? true,
      isPaidThisCycle: b.isPaidThisCycle ?? false,
      notes: b.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, notes: form.notes || null, categoryId: form.categoryId || null };
    if (editBill) {
      await updateBill.mutateAsync({ billId: editBill.id, data: payload });
    } else {
      await createBill.mutateAsync({ data: payload });
    }
    invalidate();
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId !== null) { await deleteBill.mutateAsync({ billId: deleteId }); invalidate(); setDeleteId(null); }
  };

  const handleTogglePaid = async (bill: Bill) => {
    await markPaid.mutateAsync({ billId: bill.id, data: { paid: !bill.isPaidThisCycle } });
    invalidate();
  };

  const activeBills = bills?.filter((b) => b.isActive) ?? [];
  const inactiveBills = bills?.filter((b) => !b.isActive) ?? [];
  const totalMonthly = activeBills.filter(b => b.frequency === "monthly").reduce((s, b) => s + b.amount, 0);
  const unpaidCount = activeBills.filter(b => !b.isPaidThisCycle).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground text-sm">{unpaidCount} unpaid · {formatCurrency(totalMonthly)}/mo total</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Add Bill
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Total</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totalMonthly)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid This Cycle</p>
          <p className="text-xl font-bold mt-1 text-emerald-600">{activeBills.filter(b => b.isPaidThisCycle).length} / {activeBills.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Still Due</p>
          <p className={`text-xl font-bold mt-1 ${unpaidCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>{unpaidCount} bills</p>
        </CardContent></Card>
      </div>

      {/* Bills list */}
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          : activeBills.map((bill) => {
              const cat = categories?.find((c) => c.id === bill.categoryId);
              const payer = partners?.find((p) => p.id === bill.paidById);
              return (
                <Card key={bill.id} className={bill.isPaidThisCycle ? "opacity-75" : ""}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleTogglePaid(bill)} className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                        {bill.isPaidThisCycle
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          : <Circle className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${bill.isPaidThisCycle ? "line-through text-muted-foreground" : ""}`}>{bill.name}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{bill.frequency}</Badge>
                          {cat && <Badge style={{ backgroundColor: cat.color + "22", color: cat.color, borderColor: cat.color + "44" }} variant="outline" className="text-[10px] h-4 px-1.5">{cat.name}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">Due {bill.dueDay}th · {payer?.name ?? "Partner"} · {bill.ownership}</p>
                      </div>
                      <p className="text-sm font-bold">{formatCurrency(bill.amount)}</p>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(bill)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(bill.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editBill ? "Edit Bill" : "Add Bill"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Day (1-31)</Label>
              <Input type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm((f) => ({ ...f, dueDay: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
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
              <Label>Paid By</Label>
              <Select value={String(form.paidById)} onValueChange={(v) => setForm((f) => ({ ...f, paidById: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {partners?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.categoryId ? String(form.categoryId) : "none"} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v !== "none" ? Number(v) : null }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v })) } />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createBill.isPending || updateBill.isPending}>
              {editBill ? "Save" : "Add Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Bill?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove this bill.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteBill.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
