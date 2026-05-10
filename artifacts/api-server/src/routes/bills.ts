import { Router } from "express";
import { db, billsTable, categoriesTable, partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function getNextDueDate(dueDay: number, frequency: string): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  if (frequency === "monthly") {
    let next = new Date(year, month, dueDay);
    if (next <= today) next = new Date(year, month + 1, dueDay);
    return next.toISOString().split("T")[0];
  } else if (frequency === "annual") {
    let next = new Date(year, 0, dueDay);
    if (next <= today) next = new Date(year + 1, 0, dueDay);
    return next.toISOString().split("T")[0];
  } else if (frequency === "quarterly") {
    const quarter = Math.floor(month / 3);
    let next = new Date(year, quarter * 3, dueDay);
    if (next <= today) next = new Date(year, (quarter + 1) * 3, dueDay);
    return next.toISOString().split("T")[0];
  }
  return new Date(year, month, dueDay).toISOString().split("T")[0];
}

async function enrichBills(rows: typeof billsTable.$inferSelect[]) {
  const cats = await db.select().from(categoriesTable);
  const partners = await db.select().from(partnersTable);
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const partnerMap = new Map(partners.map((p) => [p.id, p.name]));

  return rows.map((b) => ({
    ...b,
    amount: parseNum(b.amount),
    categoryName: b.categoryId ? catMap.get(b.categoryId)?.name ?? null : null,
    paidByName: partnerMap.get(b.paidById) ?? null,
    nextDueDate: getNextDueDate(b.dueDay, b.frequency),
    lastPaidDate: b.lastPaidDate ?? null,
  }));
}

router.get("/bills", async (_req, res) => {
  try {
    const rows = await db.select().from(billsTable).orderBy(billsTable.dueDay);
    res.json(await enrichBills(rows));
  } catch {
    res.status(500).json({ error: "Failed to fetch bills" });
  }
});

router.post("/bills", async (req, res) => {
  try {
    const b = req.body;
    const [row] = await db.insert(billsTable).values({
      name: b.name,
      amount: String(b.amount),
      dueDay: b.dueDay,
      frequency: b.frequency ?? "monthly",
      ownership: b.ownership ?? "shared",
      paidById: b.paidById,
      categoryId: b.categoryId ?? null,
      isActive: b.isActive ?? true,
      isPaidThisCycle: false,
      notes: b.notes ?? null,
    }).returning();
    const [enriched] = await enrichBills([row]);
    res.status(201).json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to create bill" });
  }
});

router.patch("/bills/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) updates.name = b.name;
    if (b.amount !== undefined) updates.amount = String(b.amount);
    if (b.dueDay !== undefined) updates.dueDay = b.dueDay;
    if (b.frequency !== undefined) updates.frequency = b.frequency;
    if (b.ownership !== undefined) updates.ownership = b.ownership;
    if (b.paidById !== undefined) updates.paidById = b.paidById;
    if (b.categoryId !== undefined) updates.categoryId = b.categoryId;
    if (b.isActive !== undefined) updates.isActive = b.isActive;
    if (b.notes !== undefined) updates.notes = b.notes;

    const [row] = await db.update(billsTable).set(updates).where(eq(billsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const [enriched] = await enrichBills([row]);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to update bill" });
  }
});

router.delete("/bills/:id", async (req, res) => {
  try {
    await db.delete(billsTable).where(eq(billsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

router.post("/bills/:id/unmark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(billsTable)
      .set({ isPaidThisCycle: false })
      .where(eq(billsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const [enriched] = await enrichBills([row]);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to unmark bill paid" });
    return;
  }
});

router.post("/bills/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const today = new Date().toISOString().split("T")[0];
    const [row] = await db.update(billsTable)
      .set({ isPaidThisCycle: true, lastPaidDate: today })
      .where(eq(billsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const [enriched] = await enrichBills([row]);
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Failed to mark bill paid" });
  }
});

export default router;
