import { Router } from "express";
import { db, transactionsTable, categoriesTable, partnersTable, budgetsTable, billsTable, savingsGoalsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

router.get("/dashboard/summary", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const { start, end } = monthRange(month);

    const txs = await db.select().from(transactionsTable)
      .where(and(gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    let totalIncome = 0, totalExpenses = 0, fixedExpenses = 0, variableExpenses = 0, wantsExpenses = 0;
    let sharedExpenses = 0, personalExpenses = 0;

    for (const t of txs) {
      const amt = parseNum(t.amount);
      if (t.type === "income") {
        totalIncome += amt;
      } else {
        totalExpenses += amt;
        const cat = catMap.get(t.categoryId);
        if (cat?.expenseType === "fixed") fixedExpenses += amt;
        else if (cat?.expenseType === "variable") variableExpenses += amt;
        else if (cat?.expenseType === "wants") wantsExpenses += amt;

        if (t.ownership === "shared") sharedExpenses += amt;
        else personalExpenses += amt;
      }
    }

    const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.month, month));
    const totalBudgeted = budgets.reduce((s, b) => s + parseNum(b.amount), 0);

    const savings = await db.select().from(savingsGoalsTable);
    const totalSavings = savings.reduce((s, g) => s + parseNum(g.currentAmount), 0);

    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

    // Overspending alerts
    const overspendingAlerts: string[] = [];
    const spendByCategory = new Map<number, number>();
    for (const t of txs) {
      if (t.type === "expense") {
        spendByCategory.set(t.categoryId, (spendByCategory.get(t.categoryId) || 0) + parseNum(t.amount));
      }
    }
    for (const b of budgets) {
      const spent = spendByCategory.get(b.categoryId) || 0;
      if (spent > parseNum(b.amount)) {
        const cat = catMap.get(b.categoryId);
        if (cat) overspendingAlerts.push(cat.name);
      }
    }

    // Forecast: extrapolate based on days elapsed
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = Math.max(1, today.getDate());
    const forecastEndOfMonth = totalExpenses > 0 ? Math.round((totalExpenses / dayOfMonth) * daysInMonth) : 0;

    const remainingBudget = totalIncome - totalExpenses;

    res.json({
      month,
      totalIncome,
      totalExpenses,
      remainingBudget,
      totalSavings,
      savingsRate,
      fixedExpenses,
      variableExpenses,
      wantsExpenses,
      sharedExpenses,
      personalExpenses,
      overspendingAlerts,
      forecastEndOfMonth,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/dashboard/category-breakdown", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const { start, end } = monthRange(month);

    const txs = await db.select().from(transactionsTable)
      .where(and(
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
        eq(transactionsTable.type, "expense"),
      ));

    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const spendMap = new Map<number, number>();
    let total = 0;
    for (const t of txs) {
      const amt = parseNum(t.amount);
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) || 0) + amt);
      total += amt;
    }

    const result = Array.from(spendMap.entries()).map(([catId, amount]) => {
      const cat = catMap.get(catId);
      return {
        categoryId: catId,
        categoryName: cat?.name ?? "Unknown",
        color: cat?.color ?? "#999",
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        expenseType: cat?.expenseType ?? "variable",
      };
    }).sort((a, b) => b.amount - a.amount);

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch category breakdown" });
  }
});

router.get("/dashboard/spending-trend", async (req, res) => {
  try {
    const months = parseInt((req.query.months as string) || "6");
    const result = [];

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { start, end } = monthRange(month);

      const txs = await db.select({ type: transactionsTable.type, amount: transactionsTable.amount })
        .from(transactionsTable)
        .where(and(gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

      let totalExpenses = 0, totalIncome = 0;
      for (const t of txs) {
        const amt = parseNum(t.amount);
        if (t.type === "income") totalIncome += amt;
        else totalExpenses += amt;
      }

      result.push({ month, totalExpenses, totalIncome, netSavings: totalIncome - totalExpenses });
    }

    res.json(result);
  } catch (err) {
    console.error("spending-trend error:", err);
    res.status(500).json({ error: "Failed to fetch spending trend", detail: String(err) });
  }
});

router.get("/dashboard/partner-comparison", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const { start, end } = monthRange(month);

    const partners = await db.select().from(partnersTable).orderBy(partnersTable.id);
    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const txs = await db.select().from(transactionsTable)
      .where(and(
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
        eq(transactionsTable.type, "expense"),
      ));

    function buildPartnerData(partner: typeof partners[0]) {
      const myTxs = txs.filter((t) => t.paidById === partner.id);
      const spendMap = new Map<number, number>();
      let totalSpent = 0;
      for (const t of myTxs) {
        const amt = parseNum(t.amount);
        spendMap.set(t.categoryId, (spendMap.get(t.categoryId) || 0) + amt);
        totalSpent += amt;
      }
      const categories = Array.from(spendMap.entries()).map(([catId, amount]) => {
        const cat = catMap.get(catId);
        return {
          categoryId: catId,
          categoryName: cat?.name ?? "Unknown",
          color: cat?.color ?? "#999",
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
          expenseType: cat?.expenseType ?? "variable",
        };
      }).sort((a, b) => b.amount - a.amount);

      return { id: partner.id, name: partner.name, totalSpent, categories };
    }

    const [partnerA, partnerB] = partners;
    res.json({
      partnerA: partnerA ? buildPartnerData(partnerA) : { id: 0, name: "Partner A", totalSpent: 0, categories: [] },
      partnerB: partnerB ? buildPartnerData(partnerB) : { id: 0, name: "Partner B", totalSpent: 0, categories: [] },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch partner comparison" });
  }
});

router.get("/dashboard/upcoming-bills", async (_req, res) => {
  try {
    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const allBills = await db.select().from(billsTable).where(eq(billsTable.isActive, true));
    const cats = await db.select().from(categoriesTable);
    const partners = await db.select().from(partnersTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const partnerMap = new Map(partners.map((p) => [p.id, p.name]));

    function getNextDueDate(dueDay: number, frequency: string): Date {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      if (frequency === "monthly") {
        let d = new Date(y, m, dueDay);
        if (d <= now) d = new Date(y, m + 1, dueDay);
        return d;
      } else if (frequency === "quarterly") {
        const q = Math.floor(m / 3);
        let d = new Date(y, q * 3, dueDay);
        if (d <= now) d = new Date(y, (q + 1) * 3, dueDay);
        return d;
      } else if (frequency === "annual") {
        let d = new Date(y, 0, dueDay);
        if (d <= now) d = new Date(y + 1, 0, dueDay);
        return d;
      }
      return new Date(y, m, dueDay);
    }

    const upcoming = allBills
      .filter((b) => {
        const next = getNextDueDate(b.dueDay, b.frequency);
        return next >= today && next <= in30;
      })
      .map((b) => ({
        ...b,
        amount: parseFloat(b.amount ?? "0"),
        categoryName: b.categoryId ? catMap.get(b.categoryId)?.name ?? null : null,
        paidByName: partnerMap.get(b.paidById) ?? null,
        nextDueDate: getNextDueDate(b.dueDay, b.frequency).toISOString().split("T")[0],
        lastPaidDate: b.lastPaidDate ?? null,
      }))
      .sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!));

    res.json(upcoming);
  } catch {
    res.status(500).json({ error: "Failed to fetch upcoming bills" });
  }
});

router.get("/dashboard/budget-vs-actual", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const { start, end } = monthRange(month);

    const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.month, month));
    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const txs = await db.select().from(transactionsTable)
      .where(and(
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
        eq(transactionsTable.type, "expense"),
      ));

    const spendMap = new Map<number, number>();
    for (const t of txs) {
      spendMap.set(t.categoryId, (spendMap.get(t.categoryId) || 0) + parseNum(t.amount));
    }

    const result = budgets.map((b) => {
      const budgeted = parseNum(b.amount);
      const actual = spendMap.get(b.categoryId) || 0;
      const cat = catMap.get(b.categoryId);
      return {
        categoryId: b.categoryId,
        categoryName: cat?.name ?? "Unknown",
        color: cat?.color ?? "#999",
        budgeted,
        actual,
        difference: budgeted - actual,
        overspent: actual > budgeted,
      };
    }).sort((a, b) => b.actual - a.actual);

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch budget vs actual" });
  }
});

router.get("/dashboard/shared-vs-personal", async (req, res) => {
  try {
    const months = parseInt((req.query.months as string) || "6");
    const result = [];

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { start, end } = monthRange(month);

      const txs = await db.select({ ownership: transactionsTable.ownership, amount: transactionsTable.amount })
        .from(transactionsTable)
        .where(and(
          gte(transactionsTable.date, start),
          lte(transactionsTable.date, end),
          eq(transactionsTable.type, "expense"),
        ));

      let shared = 0, personal = 0;
      for (const t of txs) {
        const amt = parseNum(t.amount);
        if (t.ownership === "shared") shared += amt;
        else personal += amt;
      }

      result.push({ month, shared, personal });
    }

    res.json(result);
  } catch (err) {
    console.error("shared-vs-personal error:", err);
    res.status(500).json({ error: "Failed to fetch shared vs personal", detail: String(err) });
  }
});

router.get("/dashboard/top-merchants", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const limit = parseInt((req.query.limit as string) || "10");
    const { start, end } = monthRange(month);

    const txs = await db.select().from(transactionsTable)
      .where(and(
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
        eq(transactionsTable.type, "expense"),
      ));

    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const merchantMap = new Map<string, { amount: number; count: number; categoryId: number | null }>();
    for (const t of txs) {
      const existing = merchantMap.get(t.merchant) || { amount: 0, count: 0, categoryId: t.categoryId };
      merchantMap.set(t.merchant, {
        amount: existing.amount + parseNum(t.amount),
        count: existing.count + 1,
        categoryId: t.categoryId,
      });
    }

    const result = Array.from(merchantMap.entries())
      .map(([merchant, data]) => {
        const cat = data.categoryId ? catMap.get(data.categoryId) : null;
        return {
          merchant,
          amount: data.amount,
          count: data.count,
          categoryName: cat?.name ?? null,
          color: cat?.color ?? null,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch top merchants" });
  }
});

router.get("/dashboard/spending-heatmap", async (req, res) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const { start, end } = monthRange(month);

    const txs = await db.select().from(transactionsTable)
      .where(and(
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
        eq(transactionsTable.type, "expense"),
      ));

    const dayMap = new Map<string, { amount: number; count: number }>();
    for (const t of txs) {
      const existing = dayMap.get(t.date) || { amount: 0, count: 0 };
      dayMap.set(t.date, { amount: existing.amount + parseNum(t.amount), count: existing.count + 1 });
    }

    // Fill in all days of the month
    const [year, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const data = dayMap.get(date) || { amount: 0, count: 0 };
      result.push({ date, amount: data.amount, count: data.count });
    }

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch spending heatmap" });
  }
});

export default router;
