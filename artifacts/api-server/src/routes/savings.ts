import { Router } from "express";
import { db, savingsGoalsTable, partnersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

async function enrichGoals(rows: typeof savingsGoalsTable.$inferSelect[]) {
  const partners = await db.select().from(partnersTable);
  const partnerMap = new Map(partners.map((p) => [p.id, p.name]));

  return rows.map((g) => {
    const target = parseNum(g.targetAmount);
    const current = parseNum(g.currentAmount);
    return {
      ...g,
      targetAmount: target,
      currentAmount: current,
      ownerName: g.ownerId ? partnerMap.get(g.ownerId) ?? null : null,
      progressPct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
    };
  });
}

router.get("/savings-goals", async (_req, res) => {
  try {
    const rows = await db.select().from(savingsGoalsTable).orderBy(savingsGoalsTable.id);
    res.json(await enrichGoals(rows));
  } catch {
    res.status(500).json({ error: "Failed to fetch savings goals" });
  }
});

router.post("/savings-goals", async (req, res) => {
  try {
    const b = req.body;
    const [row] = await db.insert(savingsGoalsTable).values({
      name: b.name,
      targetAmount: String(b.targetAmount),
      currentAmount: b.currentAmount !== undefined ? String(b.currentAmount) : "0",
      targetDate: b.targetDate ?? null,
      ownerId: b.ownerId ?? null,
      color: b.color ?? "#6366f1",
      icon: b.icon ?? "piggy-bank",
      notes: b.notes ?? null,
    }).returning();
    const [enriched] = await enrichGoals([row]);
    res.status(201).json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to create savings goal" });
  }
});

router.patch("/savings-goals/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) updates.name = b.name;
    if (b.targetAmount !== undefined) updates.targetAmount = String(b.targetAmount);
    if (b.currentAmount !== undefined) updates.currentAmount = String(b.currentAmount);
    if (b.targetDate !== undefined) updates.targetDate = b.targetDate;
    if (b.ownerId !== undefined) updates.ownerId = b.ownerId;
    if (b.color !== undefined) updates.color = b.color;
    if (b.icon !== undefined) updates.icon = b.icon;
    if (b.notes !== undefined) updates.notes = b.notes;

    const [row] = await db.update(savingsGoalsTable).set(updates).where(eq(savingsGoalsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const [enriched] = await enrichGoals([row]);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to update savings goal" });
  }
});

router.delete("/savings-goals/:id", async (req, res) => {
  try {
    await db.delete(savingsGoalsTable).where(eq(savingsGoalsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete savings goal" });
  }
});

router.post("/savings-goals/:id/contribute", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { amount } = req.body;
    const [row] = await db.update(savingsGoalsTable)
      .set({
        currentAmount: sql`${savingsGoalsTable.currentAmount} + ${String(amount)}`,
      })
      .where(eq(savingsGoalsTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const [enriched] = await enrichGoals([row]);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to contribute to savings goal" });
  }
});

export default router;
