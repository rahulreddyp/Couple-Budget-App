import { Router } from "express";
import { db, budgetsTable, categoriesTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function computeRollover(categoryId: number, month: string): Promise<number | null> {
  const prev = prevMonth(month);
  const [prevBudget] = await db.select().from(budgetsTable).where(
    and(eq(budgetsTable.month, prev), eq(budgetsTable.categoryId, categoryId))
  );
  if (!prevBudget || !prevBudget.rolloverEnabled) return null;

  const budgeted = parseNum(prevBudget.amount) ?? 0;
  const firstDay = `${prev}-01`;
  const [y, mo] = prev.split("-").map(Number);
  const lastDay = `${prev}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;

  const [actualRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}),0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.categoryId, categoryId),
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, firstDay),
        lte(transactionsTable.date, lastDay)
      )
    );
  const actual = parseNum(actualRow?.total) ?? 0;
  const leftover = budgeted - actual;
  return leftover > 0 ? leftover : null;
}

router.get("/budgets", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    const rows = await db.select().from(budgetsTable)
      .where(month ? eq(budgetsTable.month, month) : undefined)
      .orderBy(budgetsTable.id);

    const cats = await db.select().from(categoriesTable);
    const catMap = new Map(cats.map((c) => [c.id, c]));

    res.json(rows.map((b) => ({
      ...b,
      amount: parseNum(b.amount),
      rolloverAmount: parseNum(b.rolloverAmount),
      effectiveBudget: (parseNum(b.amount) ?? 0) + (parseNum(b.rolloverAmount) ?? 0),
      categoryName: catMap.get(b.categoryId)?.name ?? null,
      categoryColor: catMap.get(b.categoryId)?.color ?? null,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch budgets" });
    return;
  }
});

router.post("/budgets", async (req, res) => {
  try {
    const { month, categoryId, amount, rolloverEnabled } = req.body;
    const rollover = rolloverEnabled ? await computeRollover(categoryId, month) : null;

    const [row] = await db.insert(budgetsTable).values({
      month,
      categoryId,
      amount: String(amount),
      rolloverEnabled: rolloverEnabled ?? false,
      rolloverAmount: rollover !== null ? String(rollover) : null,
    }).returning();

    const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
    const cat = cats[0];
    res.status(201).json({
      ...row,
      amount: parseNum(row.amount),
      rolloverAmount: parseNum(row.rolloverAmount),
      effectiveBudget: (parseNum(row.amount) ?? 0) + (parseNum(row.rolloverAmount) ?? 0),
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to create budget" });
    return;
  }
});

router.patch("/budgets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
    if (req.body.rolloverEnabled !== undefined) {
      updates.rolloverEnabled = req.body.rolloverEnabled;
      if (!req.body.rolloverEnabled) updates.rolloverAmount = null;
    }

    const [row] = await db.update(budgetsTable).set(updates).where(eq(budgetsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
    const cat = cats[0];
    res.json({
      ...row,
      amount: parseNum(row.amount),
      rolloverAmount: parseNum(row.rolloverAmount),
      effectiveBudget: (parseNum(row.amount) ?? 0) + (parseNum(row.rolloverAmount) ?? 0),
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to update budget" });
    return;
  }
});

router.delete("/budgets/:id", async (req, res) => {
  try {
    await db.delete(budgetsTable).where(eq(budgetsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete budget" });
    return;
  }
});

export default router;
