import React, { useState } from "react";
import {
  useGetSavingsGoals,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
  useContributeSavingsGoal,
  useGetPartners,
} from "@workspace/api-client-react";
import type { SavingsGoal } from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2, PiggyBank, Target } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

const COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#a855f7", "#f59e0b"];

const EMPTY_FORM = {
  name: "",
  targetAmount: 1000,
  currentAmount: 0,
  targetDate: "",
  ownerId: null as number | null,
  color: "#6366f1",
  icon: "piggy-bank",
  notes: "",
};

export default function Savings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contributeOpen, setContributeOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [contributeGoalId, setContributeGoalId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [contributeAmount, setContributeAmount] = useState(100);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: goals, isLoading } = useGetSavingsGoals();
  const { data: partners } = useGetPartners();

  const createGoal = useCreateSavingsGoal();
  const updateGoal = useUpdateSavingsGoal();
  const deleteGoal = useDeleteSavingsGoal();
  const contribute = useContributeSavingsGoal();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/savings"] });

  const openNew = () => { setEditGoal(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (g: SavingsGoal) => {
    setEditGoal(g);
    setForm({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate ?? "",
      ownerId: g.ownerId ?? null,
      color: g.color ?? "#6366f1",
      icon: g.icon ?? "piggy-bank",
      notes: g.notes ?? "",
    });
    setDialogOpen(true);
  };

  const openContribute = (id: number) => { setContributeGoalId(id); setContributeAmount(100); setContributeOpen(true); };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      targetAmount: form.targetAmount,
      currentAmount: form.currentAmount,
      targetDate: form.targetDate || null,
      ownerId: form.ownerId,
      color: form.color,
      icon: form.icon,
      notes: form.notes || null,
    };
    if (editGoal) {
      await updateGoal.mutateAsync({ id: editGoal.id, data: payload });
    } else {
      await createGoal.mutateAsync({ data: payload });
    }
    invalidate();
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId !== null) { await deleteGoal.mutateAsync({ id: deleteId }); invalidate(); setDeleteId(null); }
  };

  const handleContribute = async () => {
    if (contributeGoalId !== null) {
      await contribute.mutateAsync({ id: contributeGoalId, data: { amount: contributeAmount } });
      invalidate();
      setContributeOpen(false);
    }
  };

  const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0;
  const totalSaved = goals?.reduce((s, g) => s + g.currentAmount, 0) ?? 0;
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Savings Goals</h1>
          <p className="text-muted-foreground text-sm">{goals?.length ?? 0} active goals</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> New Goal
        </Button>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">Overall Savings Progress</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalSaved)} of {formatCurrency(totalTarget)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{Math.round(overallPct)}%</p>
            </div>
          </div>
          <Progress value={overallPct} className="h-3" />
        </CardContent>
      </Card>

      {/* Goals grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
          : goals?.map((goal) => {
              const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              const remaining = goal.targetAmount - goal.currentAmount;
              const owner = partners?.find((p) => p.id === goal.ownerId);
              return (
                <Card key={goal.id}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (goal.color || "#6366f1") + "22" }}>
                          <PiggyBank className="w-4 h-4" style={{ color: goal.color || "#6366f1" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{goal.name}</p>
                          {owner && <p className="text-xs text-muted-foreground">{owner.name}</p>}
                          {!goal.ownerId && <p className="text-xs text-muted-foreground">Joint goal</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(goal)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(goal.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Saved</span>
                        <span className="font-semibold">{formatCurrency(goal.currentAmount)}</span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2" style={{ "--progress-fill": goal.color || "#6366f1" } as React.CSSProperties} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{Math.round(pct)}% complete</span>
                        <span>{formatCurrency(remaining)} to go</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="w-3 h-3" />
                        {goal.targetDate ? formatDate(goal.targetDate) : "No deadline"}
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openContribute(goal.id)}>
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* New/Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editGoal ? "Edit Goal" : "New Savings Goal"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Goal Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Amount ($)</Label>
              <Input type="number" step="100" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Current Savings ($)</Label>
              <Input type="number" step="100" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Date</Label>
              <Input type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.ownerId ? String(form.ownerId) : "joint"} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v !== "joint" ? Number(v) : null }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="joint">Joint</SelectItem>
                  {partners?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createGoal.isPending || updateGoal.isPending}>
              {editGoal ? "Save" : "Create Goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contribute Dialog */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Contribution</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Amount ($)</Label>
            <Input type="number" step="50" value={contributeAmount} onChange={(e) => setContributeAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContributeOpen(false)}>Cancel</Button>
            <Button onClick={handleContribute} disabled={contribute.isPending}>Add Funds</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Goal?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove this savings goal.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteGoal.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
