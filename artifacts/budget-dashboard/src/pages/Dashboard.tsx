import { useState } from "react";
import {
  useGetDashboardSummary,
  useGetCategoryBreakdown,
  useGetSpendingTrend,
  useGetPartnerComparison,
  useGetBudgetVsActual,
  useGetSharedVsPersonal,
  useGetTopMerchants,
  useGetUpcomingBills,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, CalendarClock, ArrowUpRight } from "lucide-react";
import { formatCurrency, currentMonth, monthOptions } from "@/lib/format";

const CHART_COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const formatYAxis = (v: number) => `$${(v / 1000).toFixed(0)}k`;

interface ChartEntry { name: string; value: number; color: string; }
interface TooltipProps { active?: boolean; payload?: ChartEntry[]; label?: string; }

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const opts = monthOptions(6);
  const [month, setMonth] = useState(currentMonth());

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ month });
  const { data: categoryBreakdown } = useGetCategoryBreakdown({ month });
  const { data: spendingTrend } = useGetSpendingTrend({ months: 6 });
  const { data: partnerComparison } = useGetPartnerComparison({ month });
  const { data: budgetVsActual } = useGetBudgetVsActual({ month });
  const { data: sharedVsPersonal } = useGetSharedVsPersonal({ months: 6 });
  const { data: topMerchants } = useGetTopMerchants({ month, limit: 8 });
  const { data: upcomingBills } = useGetUpcomingBills();

  // Transform partner comparison into chart-friendly format
  const partnerChartData = (() => {
    if (!partnerComparison) return [];
    const cats = new Map<string, { categoryName: string; partnerAAmount: number; partnerBAmount: number }>();
    for (const item of partnerComparison.partnerA?.categories ?? []) {
      cats.set(item.categoryName, { categoryName: item.categoryName, partnerAAmount: item.amount, partnerBAmount: 0 });
    }
    for (const item of partnerComparison.partnerB?.categories ?? []) {
      const existing = cats.get(item.categoryName) ?? { categoryName: item.categoryName, partnerAAmount: 0, partnerBAmount: 0 };
      cats.set(item.categoryName, { ...existing, partnerBAmount: item.amount });
    }
    return Array.from(cats.values())
      .sort((a, b) => (b.partnerAAmount + b.partnerBAmount) - (a.partnerAAmount + a.partnerBAmount))
      .slice(0, 6);
  })();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Alex & Jordan's shared finances</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              title="Total Income"
              value={formatCurrency(summary?.totalIncome)}
              icon={TrendingUp}
              color="#10b981"
            />
            <StatCard
              title="Total Expenses"
              value={formatCurrency(summary?.totalExpenses)}
              icon={TrendingDown}
              color="#ef4444"
            />
            <StatCard
              title="Net Savings"
              value={formatCurrency(summary?.remainingBudget)}
              sub={summary?.savingsRate !== undefined ? `${summary.savingsRate.toFixed(1)}% savings rate` : undefined}
              icon={DollarSign}
              color="#6366f1"
            />
            <StatCard
              title="Upcoming Bills"
              value={String(upcomingBills?.length ?? 0)}
              sub={upcomingBills ? formatCurrency(upcomingBills.reduce((s, b) => s + (b.amount ?? 0), 0)) + " due" : undefined}
              icon={CalendarClock}
              color="#f97316"
            />
          </>
        )}
      </div>

      {/* Charts Row 1: Spending Trend + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spending Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={spendingTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="totalIncome" stroke="#10b981" strokeWidth={2} dot={false} name="Income" />
                <Line type="monotone" dataKey="totalExpenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
                <Line type="monotone" dataKey="netSavings" stroke="#6366f1" strokeWidth={2} dot={false} name="Savings" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={categoryBreakdown?.slice(0, 8)}
                  dataKey="amount"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {categoryBreakdown?.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => formatCurrency(val)}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-1">
              {categoryBreakdown?.slice(0, 5).map((item, i) => (
                <div key={item.categoryId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground">{item.categoryName}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Budget vs Actual + Partner Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Budget vs Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetVsActual?.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budgeted" fill="#6366f144" name="Budget" radius={[0, 2, 2, 0]} />
                <Bar dataKey="actual" name="Actual" radius={[0, 2, 2, 0]}>
                  {budgetVsActual?.slice(0, 8).map((item, i) => (
                    <Cell key={i} fill={item.overspent ? "#ef4444" : "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Partner Spending Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={partnerChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="categoryName" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="partnerAAmount" name={partnerComparison?.partnerA?.name ?? "Partner A"} fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="partnerBAmount" name={partnerComparison?.partnerB?.name ?? "Partner B"} fill="#14b8a6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Shared vs Personal + Top Merchants + Upcoming Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Shared vs Personal (6mo)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sharedVsPersonal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={formatYAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="shared" name="Shared" fill="#6366f1" stackId="a" />
                <Bar dataKey="personal" name="Personal" fill="#14b8a6" stackId="a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topMerchants?.slice(0, 6).map((m, i) => (
                <div key={m.merchant} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.merchant}</p>
                    <p className="text-[10px] text-muted-foreground">{m.count} transactions</p>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingBills?.slice(0, 6).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{bill.name}</p>
                    <p className="text-[10px] text-muted-foreground">Due {bill.dueDay}th</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">{formatCurrency(bill.amount)}</p>
                    <Badge variant={bill.isPaidThisCycle ? "default" : "secondary"} className="text-[9px] h-4 px-1">
                      {bill.isPaidThisCycle ? "Paid" : "Due"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
