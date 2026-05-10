import { useState, useRef, useEffect } from "react";
import {
  useGetPartners,
  useUpdatePartner,
  useGetAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@workspace/api-client-react";
import type {
  Account,
  AccountInput,
  AccountInputType,
  Category,
  CategoryInput,
  CategoryInputExpenseType,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQueryClient } from "@tanstack/react-query";
import { User, CreditCard, Tag, Plus, Pencil, Trash2, Download, Upload, Bell, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_CAT: CategoryInput = { name: "", color: "#6366f1", icon: "tag", expenseType: "variable" };
const EMPTY_ACC: AccountInput = { name: "", type: "checking", isJoint: false, balance: 0 };

const CATS_ORDER_KEY = "settings_cats_order";

function loadCatsOrder(): number[] | null {
  try {
    const raw = localStorage.getItem(CATS_ORDER_KEY);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}
function saveCatsOrder(ids: number[]) {
  localStorage.setItem(CATS_ORDER_KEY, JSON.stringify(ids));
}

function applyCatsOrder(cats: Category[], order: number[] | null): Category[] {
  if (!order || order.length === 0) return cats;
  const map = new Map(cats.map((c) => [c.id, c]));
  const ordered = order.map((id) => map.get(id)).filter(Boolean) as Category[];
  const rest = cats.filter((c) => !order.includes(c.id));
  return [...ordered, ...rest];
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: partners, isLoading: loadingPartners } = useGetPartners();
  const { data: accounts, isLoading: loadingAccounts } = useGetAccounts();
  const { data: categories } = useGetCategories();

  const updatePartner = useUpdatePartner();
  const createAcc = useCreateAccount();
  const updateAcc = useUpdateAccount();
  const deleteAcc = useDeleteAccount();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [names, setNames] = useState<Record<number, string>>({});
  const [colors, setColors] = useState<Record<number, string>>({});

  // Category display order (local, persisted to localStorage)
  const [catsOrder, setCatsOrder] = useState<number[] | null>(null);
  const orderedCats = applyCatsOrder(categories ?? [], catsOrder);

  useEffect(() => {
    const saved = loadCatsOrder();
    if (saved) setCatsOrder(saved);
  }, []);

  const moveCat = (index: number, dir: -1 | 1) => {
    const newOrder = [...orderedCats.map((c) => c.id)];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setCatsOrder(newOrder);
    saveCatsOrder(newOrder);
  };

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<CategoryInput>(EMPTY_CAT);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);

  // Account dialog
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [accForm, setAccForm] = useState<AccountInput>(EMPTY_ACC);
  const [deleteAccId, setDeleteAccId] = useState<number | null>(null);

  // Notification preferences (persisted to localStorage)
  const [notifBudget, setNotifBudget] = useState(() => localStorage.getItem("notif_budget") !== "false");
  const [notifBills, setNotifBills] = useState(() => localStorage.getItem("notif_bills") !== "false");
  const [notifGoals, setNotifGoals] = useState(() => localStorage.getItem("notif_goals") !== "false");

  const importRef = useRef<HTMLInputElement>(null);

  const invalidateCats = () => queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
  const invalidateAccs = () => queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });

  // — Category CRUD —
  const openNewCat = () => { setEditCat(null); setCatForm(EMPTY_CAT); setCatDialogOpen(true); };
  const openEditCat = (cat: Category) => {
    setEditCat(cat);
    setCatForm({ name: cat.name, color: cat.color, icon: cat.icon, expenseType: cat.expenseType as CategoryInputExpenseType });
    setCatDialogOpen(true);
  };
  const handleSaveCat = async () => {
    if (editCat) {
      await updateCat.mutateAsync({ id: editCat.id, data: catForm });
    } else {
      await createCat.mutateAsync({ data: catForm });
    }
    invalidateCats();
    setCatDialogOpen(false);
  };
  const handleDeleteCat = async () => {
    if (deleteCatId !== null) {
      await deleteCat.mutateAsync({ id: deleteCatId });
      invalidateCats();
      setDeleteCatId(null);
    }
  };

  // — Account CRUD —
  const openNewAcc = () => { setEditAcc(null); setAccForm(EMPTY_ACC); setAccDialogOpen(true); };
  const openEditAcc = (acc: Account) => {
    setEditAcc(acc);
    setAccForm({
      name: acc.name,
      type: acc.type as AccountInputType,
      isJoint: acc.isJoint ?? false,
      balance: acc.balance ?? 0,
      ownerId: acc.ownerId ?? null,
    });
    setAccDialogOpen(true);
  };
  const handleSaveAcc = async () => {
    if (editAcc) {
      await updateAcc.mutateAsync({ id: editAcc.id, data: accForm });
    } else {
      await createAcc.mutateAsync({ data: accForm });
    }
    invalidateAccs();
    setAccDialogOpen(false);
  };
  const handleDeleteAcc = async () => {
    if (deleteAccId !== null) {
      await deleteAcc.mutateAsync({ id: deleteAccId });
      invalidateAccs();
      setDeleteAccId(null);
    }
  };

  // — Partner save (only send changed fields) —
  const handleSavePartner = async (id: number, original: { name: string; color: string }) => {
    const payload: { name?: string; color?: string } = {};
    if (names[id] !== undefined && names[id] !== original.name) payload.name = names[id];
    if (colors[id] !== undefined && colors[id] !== original.color) payload.color = colors[id];
    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    await updatePartner.mutateAsync({ id, data: payload });
    queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
    toast({ title: "Profile saved" });
  };

  // — Notification prefs —
  const saveNotif = (key: string, val: boolean) => localStorage.setItem(key, String(val));

  // — Data export —
  const handleExport = async () => {
    try {
      const [txRes, billsRes, budgetsRes, goalsRes] = await Promise.all([
        fetch("/api/transactions?limit=10000"),
        fetch("/api/bills"),
        fetch("/api/budgets"),
        fetch("/api/savings-goals"),
      ]);
      const data = {
        exportedAt: new Date().toISOString(),
        transactions: (await txRes.json()).data ?? [],
        bills: await billsRes.json(),
        budgets: await budgetsRes.json(),
        savingsGoals: await goalsRes.json(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `together-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export complete", description: "Your data has been downloaded." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactions: data.transactions ?? [],
            bills: data.bills ?? [],
            savingsGoals: data.savingsGoals ?? [],
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          toast({ title: "Import failed", description: String(err.error ?? "Server error"), variant: "destructive" });
          return;
        }

        const result = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
        queryClient.invalidateQueries({ queryKey: ["/api/savings-goals"] });

        toast({
          title: "Import complete",
          description: `Imported ${result.imported.transactions} transactions, ${result.imported.bills} bills, ${result.imported.savingsGoals} savings goals.`,
        });
      } catch {
        toast({ title: "Invalid file", description: "Could not parse the JSON file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile, accounts, and preferences</p>
      </div>

      {/* Partner Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" /> Partner Profiles
          </CardTitle>
          <CardDescription>Update names and profile colors for each partner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingPartners ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            partners?.map((p) => (
              <div key={p.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b last:border-0 last:pb-0">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    defaultValue={p.name}
                    onChange={(e) => setNames((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      defaultValue={p.color}
                      onChange={(e) => setColors((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-9 h-9 rounded cursor-pointer border border-border"
                    />
                    <Badge style={{ backgroundColor: colors[p.id] || p.color }} className="text-white text-xs">
                      {p.role === "partner_a" ? "Partner A" : "Partner B"}
                    </Badge>
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <Button
                    size="sm"
                    onClick={() => handleSavePartner(p.id, { name: p.name, color: p.color })}
                    disabled={updatePartner.isPending}
                  >
                    Save {p.name}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4" /> Accounts
              </CardTitle>
              <CardDescription>Manage your linked financial accounts</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openNewAcc}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAccounts ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-2">
              {accounts?.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.type} · {acc.isJoint ? "Joint" : "Personal"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {acc.balance !== undefined && acc.balance !== null
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(acc.balance)
                        : "—"}
                    </p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEditAcc(acc)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteAccId(acc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="w-4 h-4" /> Categories
              </CardTitle>
              <CardDescription>Drag to reorder or use arrows. Changes are saved automatically.</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openNewCat}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orderedCats.map((cat, index) => (
              <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveCat(index, -1)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveCat(index, 1)}
                      disabled={index === orderedCats.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{cat.expenseType}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEditCat(cat)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteCatId(cat.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" /> Notification Preferences
          </CardTitle>
          <CardDescription>Choose which alerts you want to see in the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Budget overspend alerts", desc: "Alert when a category exceeds its monthly budget", val: notifBudget, key: "notif_budget", set: setNotifBudget },
            { label: "Upcoming bill reminders", desc: "Alert when a bill is due within 3 days", val: notifBills, key: "notif_bills", set: setNotifBills },
            { label: "Savings goal milestones", desc: "Alert when a goal reaches 25%, 50%, 75%, or 100%", val: notifGoals, key: "notif_goals", set: setNotifGoals },
          ].map(({ label, desc, val, key, set }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={val} onCheckedChange={(v) => { set(v); saveNotif(key, v); }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data Import / Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="w-4 h-4" /> Data & Export
          </CardTitle>
          <CardDescription>Export your data as JSON or import a previous backup</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export all data
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()}>
            <Upload className="w-4 h-4" /> Import backup
          </Button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </CardContent>
      </Card>

      {/* Account Create/Edit Dialog */}
      <Dialog open={accDialogOpen} onOpenChange={setAccDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editAcc ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input value={accForm.name} onChange={(e) => setAccForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Joint Checking" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={accForm.type} onValueChange={(v) => setAccForm((f) => ({ ...f, type: v as AccountInputType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="joint">Joint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balance ($)</Label>
              <Input
                type="number" step="0.01"
                value={accForm.balance ?? 0}
                onChange={(e) => setAccForm((f) => ({ ...f, balance: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={accForm.isJoint ?? false} onCheckedChange={(v) => setAccForm((f) => ({ ...f, isJoint: v }))} />
              <Label>Joint account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAcc} disabled={createAcc.isPending || updateAcc.isPending || !accForm.name}>
              {editAcc ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirm */}
      <Dialog open={deleteAccId !== null} onOpenChange={() => setDeleteAccId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Account?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Transactions linked to this account will lose their account reference.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAcc} disabled={deleteAcc.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Create/Edit Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Dining Out" />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <span className="text-sm text-muted-foreground">{catForm.color}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={catForm.expenseType} onValueChange={(v) => setCatForm((f) => ({ ...f, expenseType: v as CategoryInputExpenseType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="wants">Wants</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCat} disabled={createCat.isPending || updateCat.isPending || !catForm.name}>
              {editCat ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirm */}
      <Dialog open={deleteCatId !== null} onOpenChange={() => setDeleteCatId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Category?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This may affect transactions and budgets assigned to this category.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCatId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCat} disabled={deleteCat.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
