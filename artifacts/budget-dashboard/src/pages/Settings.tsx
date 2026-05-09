import { useState } from "react";
import {
  useGetPartners,
  useUpdatePartner,
  useGetAccounts,
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@workspace/api-client-react";
import type { Category, CategoryInput, CategoryInputExpenseType } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { User, CreditCard, Tag, Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY_CAT: CategoryInput = {
  name: "",
  color: "#6366f1",
  icon: "tag",
  expenseType: "variable",
};

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: partners, isLoading: loadingPartners } = useGetPartners();
  const { data: accounts, isLoading: loadingAccounts } = useGetAccounts();
  const { data: categories } = useGetCategories();

  const updatePartner = useUpdatePartner();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [names, setNames] = useState<Record<number, string>>({});
  const [colors, setColors] = useState<Record<number, string>>({});

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState<CategoryInput>(EMPTY_CAT);
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null);

  const invalidateCats = () => queryClient.invalidateQueries({ queryKey: ["/api/categories"] });

  const openNewCat = () => { setEditCat(null); setCatForm(EMPTY_CAT); setCatDialogOpen(true); };
  const openEditCat = (cat: Category) => {
    setEditCat(cat);
    setCatForm({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      expenseType: cat.expenseType as CategoryInputExpenseType,
    });
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

  const handleSavePartner = async (id: number) => {
    await updatePartner.mutateAsync({ id, data: { name: names[id], color: colors[id] } });
    queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile, accounts, and categories</p>
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
              <div key={p.id} className="grid grid-cols-2 gap-4 pb-4 border-b last:border-0 last:pb-0">
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
                <div className="col-span-2">
                  <Button size="sm" onClick={() => handleSavePartner(p.id)} disabled={updatePartner.isPending}>
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
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" /> Accounts
          </CardTitle>
          <CardDescription>Your linked financial accounts</CardDescription>
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
                    <p className="text-xs text-muted-foreground capitalize">{acc.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {acc.balance !== undefined && acc.balance !== null
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(acc.balance)
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{acc.isJoint ? "Joint" : "Personal"}</p>
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
              <CardDescription>Spending categories in your budget</CardDescription>
            </div>
            <Button size="sm" className="gap-1" onClick={openNewCat}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories?.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
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

      {/* Category Create/Edit Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This may affect transactions assigned to this category.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCatId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteCat} disabled={deleteCat.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
