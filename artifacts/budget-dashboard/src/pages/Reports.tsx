import { useState } from "react";
import {
  useGetSpendingTrend,
  useGetCategoryBreakdown,
  useGetPartnerComparison,
  useGetSharedVsPersonal,
  useGetTopMerchants,
  useGetSpendingHeatmap,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatCurrency, currentMonth, monthOptions } from "@/lib/format";

const CHART_COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

const formatYAxis = (v: number) => `$${(v / 1000).toFixed(0)}k`;
interface ChartEntry { name: string; value: number; color: string; }
interface TooltipProps { active?: boolean; payload?: ChartEntry[]; label?: string; }

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((e) => (
        <p key={e.name} style={{ color: e.color }}>{e.name}: {formatCurrency(e.value)}</p>
      ))}
    </div>
  );
};

export default function Reports() {
  const [month, setMonth] = useState(currentMonth());

  const { data: trend } = useGetSpendingTrend({ months: 6 });
  const { data: catBreakdown } = useGetCategoryBreakdown({ month });
  const { data: partnerCmp } = useGetPartnerComparison({ month });
  const { data: sharedVsPersonal } = useGetSharedVsPersonal({ months: 6 });
  const { data: topMerchants } = useGetTopMerchants({ month, limit: 10 });
  const { data: heatmap } = useGetSpendingHeatmap({ month });

  // Transform partner comparison for chart
  const partnerChartData = (() => {
    if (!partnerCmp) return [];
    const cats = new Map<string, { categoryName: string; partnerAAmount: number; partnerBAmount: number }>();
    for (const item of partnerCmp.partnerA?.categories ?? []) {
      cats.set(item.categoryName, { categoryName: item.categoryName, partnerAAmount: item.amount, partnerBAmount: 0 });
    }
    for (const item of partnerCmp.partnerB?.categories ?? []) {
      const existing = cats.get(item.categoryName) ?? { categoryName: item.categoryName, partnerAAmount: 0, partnerBAmount: 0 };
      cats.set(item.categoryName, { ...existing, partnerBAmount: item.amount });
    }
    return Array.from(cats.values())
      .sort((a, b) => (b.partnerAAmount + b.partnerBAmount) - (a.partnerAAmount + a.partnerBAmount))
      .slice(0, 8);
  })();

  const heatmapMax = Math.max(...(heatmap?.map((d) => d.amount) ?? [1]), 1);
  const heatColor = (amount: number) => {
    if (amount === 0) return "hsl(var(--muted))";
    const intensity = Math.min(amount / heatmapMax, 1);
    const alpha = 0.15 + intensity * 0.85;
    return `rgba(99, 102, 241, ${alpha})`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Deep-dive analytics for Alex & Jordan</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(6).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="trends">
        <TabsList className="mb-4">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Income vs Expenses — 6 Month Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="totalIncome" stroke="#10b981" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                  <Area type="monotone" dataKey="totalExpenses" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
                  <Area type="monotone" dataKey="netSavings" stroke="#6366f1" fill="url(#savingsGrad)" strokeWidth={2} name="Net Savings" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Shared vs Personal Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sharedVsPersonal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="shared" name="Shared" fill="#6366f1" stackId="s" />
                  <Bar dataKey="personal" name="Personal" fill="#14b8a6" stackId="s" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {heatmap && heatmap.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Daily Spending Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {heatmap.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${formatCurrency(day.amount)}`}
                      className="w-8 h-8 rounded-sm cursor-default transition-transform hover:scale-110 flex items-center justify-center text-[9px] font-bold"
                      style={{
                        backgroundColor: heatColor(day.amount),
                        color: day.amount > heatmapMax * 0.5 ? "#fff" : "#6366f1"
                      }}
                    >
                      {new Date(day.date + "T00:00:00").getDate()}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
                      <div key={v} className="w-5 h-4 rounded-sm" style={{ backgroundColor: heatColor(v * heatmapMax) }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={catBreakdown} dataKey="amount" nameKey="categoryName" cx="50%" cy="50%" outerRadius={110} paddingAngle={2}>
                      {catBreakdown?.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Category Amounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 overflow-y-auto max-h-72">
                  {catBreakdown?.map((item, i) => {
                    const total = catBreakdown.reduce((s, c) => s + c.amount, 0);
                    const pct = total > 0 ? (item.amount / total) * 100 : 0;
                    return (
                      <div key={item.categoryId}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium">{item.categoryName}</span>
                          <span className="text-muted-foreground">{formatCurrency(item.amount)} ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partners" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Partner Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={partnerChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="categoryName" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="partnerAAmount" name={partnerCmp?.partnerA?.name ?? "Alex"} fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="partnerBAmount" name={partnerCmp?.partnerB?.name ?? "Jordan"} fill="#14b8a6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: partnerCmp?.partnerA?.name ?? "Alex", amount: partnerCmp?.partnerA?.totalSpent ?? 0, color: "#6366f1" },
              { name: partnerCmp?.partnerB?.name ?? "Jordan", amount: partnerCmp?.partnerB?.totalSpent ?? 0, color: "#14b8a6" },
            ].map(({ name, amount, color }) => {
              const total = (partnerCmp?.partnerA?.totalSpent ?? 0) + (partnerCmp?.partnerB?.totalSpent ?? 0);
              return (
                <Card key={name}>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <p className="text-sm font-semibold">{name}'s Spending</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
                    <p className="text-xs text-muted-foreground">{total > 0 ? Math.round((amount / total) * 100) : 0}% of total</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="merchants">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Merchants This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topMerchants?.map((m, i) => {
                  const maxAmount = topMerchants[0]?.amount ?? 1;
                  const pct = (m.amount / maxAmount) * 100;
                  return (
                    <div key={m.merchant}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-medium">{m.merchant}</span>
                          <span className="text-xs text-muted-foreground">{m.count} transactions</span>
                        </div>
                        <span className="text-sm font-bold">{formatCurrency(m.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-8">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
