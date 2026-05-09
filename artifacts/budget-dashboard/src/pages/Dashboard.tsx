import { useState, useMemo } from "react";
import {
  useGetDashboardSummary,
  useGetCategoryBreakdown,
  useGetSpendingTrend,
  useGetPartnerComparison,
  useGetBudgetVsActual,
  useGetSharedVsPersonal,
  useGetTopMerchants,
  useGetUpcomingBills,
  useGetSpendingHeatmap,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, CalendarClock, Lock, Zap, Smile } from "lucide-react";
import { formatCurrency, currentMonth, monthOptions } from "@/lib/format";

const CHART_COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + "22" }}>
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
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

function SpendingHeatmap({ data }: { data: { date: string; amount: number; count: number }[] }) {
  const max = useMemo(() => Math.max(...data.map((d) => d.amount), 1), [data]);
  const byDate = useMemo(() => new Map(data.map((d) => [d.date, d])), [data]);

  const weeks = useMemo(() => {
    if (data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(sorted[0].date);
    const end = new Date(sorted[sorted.length - 1].date);
    // align start to Sunday
    const startSunday = new Date(start);
    startSunday.setDate(start.getDate() - start.getDay());
    const cols: string[][] = [];
    const cur = new Date(startSunday);
    while (cur <= end) {
      const week: string[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(week);
    }
    return cols;
  }, [data]);

  const getColor = (amount: number) => {
    if (amount === 0) return "hsl(var(--muted))";
    const pct = Math.min(amount / max, 1);
    const opacity = 0.15 + pct * 0.85;
    return `rgba(99, 102, 241, ${opacity.toFixed(2)})`;
  };

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 min-w-max">
        <div className="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="w-5 h-5 flex items-center justify-end text-[9px] text-muted-foreground">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((date) => {
              const entry = byDate.get(date);
              const amount = entry?.amount ?? 0;
              return (
                <div
                  key={date}
                  title={amount > 0 ? `${date}: ${formatCurrency(amount)} (${entry?.count} txns)` : date}
                  className="w-5 h-5 rounded-sm cursor-default transition-opacity hover:opacity-80"
                  style={{ backgroundColor: getColor(amount) }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0.1, 0.3, 0.6, 0.85, 1].map((p) => (
          <div key={p} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(99, 102, 241, ${0.15 + p * 0.85})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

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
  const { data: heatmapData } = useGetSpendingHeatmap({ month });

  const partnerChartData = useMemo(() => {
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
  }, [partnerComparison]);

  const merchantChartData = useMemo(
    () => (topMerchants ?? []).slice(0, 8).map((m) => ({ name: m.merchant, amount: m.amount, count: m.count })),
    [topMerchants]
  );

  const expenseTypePie = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Fixed", value: summary.fixedExpenses, color: "#6366f1" },
      { name: "Variable", value: summary.variableExpenses, color: "#f97316" },
      { name: "Wants", value: summary.wantsExpenses, color: "#ec4899" },
    ].filter((e) => e.value > 0);
  }, [summary]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Alex & Jordan's shared finances</p>
        </div>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Total Income" value={formatCurrency(summary?.totalIncome)} icon={TrendingUp} color="#10b981" />
            <StatCard title="Total Expenses" value={formatCurrency(summary?.totalExpenses)} icon={TrendingDown} color="#ef4444" />
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

      {/* Expense Type KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {loadingSummary ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Fixed Expenses" value={formatCurrency(summary?.fixedExpenses)} sub="Rent, insurance, subs" icon={Lock} color="#6366f1" />
            <StatCard title="Variable Expenses" value={formatCurrency(summary?.variableExpenses)} sub="Groceries, transport" icon={Zap} color="#f97316" />
            <StatCard title="Wants" value={formatCurrency(summary?.wantsExpenses)} sub="Dining, entertainment" icon={Smile} color="#ec4899" />
          </>
        )}
      </div>

      {/* Chart 1+2: Spending Trend + Category Breakdown */}
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
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={categoryBreakdown?.slice(0, 8)}
                  dataKey="amount"
                  nameKey="categoryName"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {categoryBreakdown?.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => formatCurrency(val)}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
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

      {/* Chart 3+4: Budget vs Actual + Partner Comparison */}
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

      {/* Chart 5+6: Shared vs Personal + Expense Type Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Shared vs Personal (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
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
            <CardTitle className="text-sm font-semibold">Fixed vs Variable vs Wants</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={expenseTypePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {expenseTypePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(val: number) => formatCurrency(val)}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {expenseTypePie.map((e) => (
                <div key={e.name} className="text-center">
                  <p className="text-xs text-muted-foreground">{e.name}</p>
                  <p className="text-sm font-semibold" style={{ color: e.color }}>{formatCurrency(e.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart 7: Top Merchants bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Merchants by Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={merchantChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip
                formatter={(val: number, name: string) => [formatCurrency(val), name]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
              />
              <Bar dataKey="amount" name="Amount" radius={[0, 3, 3, 0]}>
                {merchantChartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Chart 8: Spending Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Daily Spending Heatmap (3 months)</CardTitle>
        </CardHeader>
        <CardContent>
          {heatmapData && heatmapData.length > 0
            ? <SpendingHeatmap data={heatmapData} />
            : <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">No heatmap data available</div>
          }
        </CardContent>
      </Card>

      {/* Upcoming Bills list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Upcoming Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {upcomingBills?.slice(0, 8).map((bill) => (
              <div key={bill.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">Due {bill.dueDay}th</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-sm font-semibold">{formatCurrency(bill.amount)}</p>
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
  );
}
