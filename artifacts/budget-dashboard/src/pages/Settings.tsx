import { useState } from "react";
import { useGetPartners, useUpdatePartner, useGetAccounts, useGetCategories } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { User, CreditCard, Tag } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: partners, isLoading: loadingPartners } = useGetPartners();
  const { data: accounts, isLoading: loadingAccounts } = useGetAccounts();
  const { data: categories } = useGetCategories();

  const updatePartner = useUpdatePartner();

  const [names, setNames] = useState<Record<number, string>>({});
  const [colors, setColors] = useState<Record<number, string>>({});

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4" /> Categories
          </CardTitle>
          <CardDescription>Spending categories in your budget</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories?.map((cat) => (
              <Badge
                key={cat.id}
                style={{ backgroundColor: cat.color + "22", color: cat.color, borderColor: cat.color + "44" }}
                variant="outline"
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
