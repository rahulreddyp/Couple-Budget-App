import { Router } from "express";
import { db, budgetsTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
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
      categoryName: catMap.get(b.categoryId)?.name ?? null,
      categoryColor: catMap.get(b.categoryId)?.color ?? null,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch budgets" });
  }
});

router.post("/budgets", async (req, res) => {
  try {
    const { month, categoryId, amount, rolloverEnabled } = req.body;
    const [row] = await db.insert(budgetsTable).values({
      month,
      categoryId,
      amount: String(amount),
      rolloverEnabled: rolloverEnabled ?? false,
    }).returning();

    const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
    const cat = cats[0];
    res.status(201).json({
      ...row,
      amount: parseNum(row.amount),
      rolloverAmount: parseNum(row.rolloverAmount),
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.patch("/budgets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
    if (req.body.rolloverEnabled !== undefined) updates.rolloverEnabled = req.body.rolloverEnabled;

    const [row] = await db.update(budgetsTable).set(updates).where(eq(budgetsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.id, row.categoryId));
    const cat = cats[0];
    res.json({
      ...row,
      amount: parseNum(row.amount),
      rolloverAmount: parseNum(row.rolloverAmount),
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/budgets/:id", async (req, res) => {
  try {
    await db.delete(budgetsTable).where(eq(budgetsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
