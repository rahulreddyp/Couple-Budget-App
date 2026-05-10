import { Router } from "express";
import { db, transactionsTable, categoriesTable, partnersTable } from "@workspace/db";
import { eq, and, gte, lte, ilike, or, sql, desc, asc } from "drizzle-orm";

const router = Router();

function parseNum(v: unknown) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function txRow(t: Record<string, unknown>, catMap: Map<number, { name: string; color: string }>, partnerMap: Map<number, string>) {
  const cat = catMap.get(t.categoryId as number);
  const paidBy = partnerMap.get(t.paidById as number);
  return {
    ...t,
    amount: parseNum(t.amount),
    splitRatio: parseNum(t.splitRatio),
    categoryName: cat?.name ?? null,
    categoryColor: cat?.color ?? null,
    paidByName: paidBy ?? null,
    isRecurring: t.isRecurring ?? false,
  };
}

async function getCatMap() {
  const cats = await db.select().from(categoriesTable);
  return new Map(cats.map((c) => [c.id, { name: c.name, color: c.color }]));
}
async function getPartnerMap() {
  const pts = await db.select().from(partnersTable);
  return new Map(pts.map((p) => [p.id, p.name]));
}

function param(v: string | undefined): string | undefined {
  if (!v || v === "null" || v === "undefined") return undefined;
  return v;
}

function monthLastDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

router.get("/transactions", async (req, res) => {
  try {
    const raw = req.query as Record<string, string>;
    const month = param(raw.month);
    const startDate = param(raw.startDate);
    const endDate = param(raw.endDate);
    const partnerId = param(raw.partnerId);
    const categoryId = param(raw.categoryId);
    const accountId = param(raw.accountId);
    const type = param(raw.type);
    const ownership = param(raw.ownership);
    const isRecurring = param(raw.isRecurring);
    const search = param(raw.search);
    const sortBy = param(raw.sortBy);
    const sortDir = param(raw.sortDir);
    const limit = param(raw.limit);
    const offset = param(raw.offset);

    const conditions = [];

    if (month) {
      conditions.push(
        gte(transactionsTable.date, `${month}-01`),
        lte(transactionsTable.date, monthLastDay(month)),
      );
    }
    if (startDate) conditions.push(gte(transactionsTable.date, startDate));
    if (endDate) conditions.push(lte(transactionsTable.date, endDate));
    if (partnerId) conditions.push(eq(transactionsTable.paidById, parseInt(partnerId)));
    if (categoryId) conditions.push(eq(transactionsTable.categoryId, parseInt(categoryId)));
    if (accountId) conditions.push(eq(transactionsTable.accountId, parseInt(accountId)));
    if (type) conditions.push(eq(transactionsTable.type, type));
    if (ownership) conditions.push(eq(transactionsTable.ownership, ownership));
    if (isRecurring === "true") conditions.push(eq(transactionsTable.isRecurring, true));
    if (isRecurring === "false") conditions.push(eq(transactionsTable.isRecurring, false));
    if (search) {
      conditions.push(
        or(
          ilike(transactionsTable.merchant, `%${search}%`),
          ilike(transactionsTable.notes, `%${search}%`),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .where(whereClause);

    const catMap = await getCatMap();
    const partnerMap = await getPartnerMap();

    // Sorting
    const orderFn = sortDir === "asc" ? asc : desc;

    let rows;
    if (sortBy === "category") {
      // Join with categories to sort by name
      const joined = await db
        .select({ tx: transactionsTable, catName: categoriesTable.name })
        .from(transactionsTable)
        .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
        .where(whereClause)
        .orderBy(orderFn(categoriesTable.name))
        .limit(limit ? parseInt(limit) : 100)
        .offset(offset ? parseInt(offset) : 0);
      rows = joined.map((r) => r.tx);
    } else {
      const sortColumn =
        sortBy === "amount" ? transactionsTable.amount :
        sortBy === "merchant" ? transactionsTable.merchant :
        transactionsTable.date;
      rows = await db
        .select()
        .from(transactionsTable)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(limit ? parseInt(limit) : 100)
        .offset(offset ? parseInt(offset) : 0);
    }

    res.json({
      data: rows.map((t) => txRow(t as unknown as Record<string, unknown>, catMap, partnerMap)),
      total: count,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const b = req.body;
    const [row] = await db.insert(transactionsTable).values({
      date: b.date,
      amount: String(b.amount),
      merchant: b.merchant,
      notes: b.notes ?? null,
      type: b.type ?? "expense",
      ownership: b.ownership ?? "shared",
      splitType: b.splitType ?? "fifty_fifty",
      splitRatio: b.splitRatio != null ? String(b.splitRatio) : null,
      paidById: b.paidById,
      categoryId: b.categoryId,
      accountId: b.accountId ?? null,
      isRecurring: b.isRecurring ?? false,
    }).returning();

    const catMap = await getCatMap();
    const partnerMap = await getPartnerMap();
    res.status(201).json(txRow(row as unknown as Record<string, unknown>, catMap, partnerMap));
  } catch {
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const catMap = await getCatMap();
    const partnerMap = await getPartnerMap();
    res.json(txRow(row as unknown as Record<string, unknown>, catMap, partnerMap));
  } catch {
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
});

router.patch("/transactions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const updates: Record<string, unknown> = {};
    if (b.date !== undefined) updates.date = b.date;
    if (b.amount !== undefined) updates.amount = String(b.amount);
    if (b.merchant !== undefined) updates.merchant = b.merchant;
    if (b.notes !== undefined) updates.notes = b.notes;
    if (b.type !== undefined) updates.type = b.type;
    if (b.ownership !== undefined) updates.ownership = b.ownership;
    if (b.splitType !== undefined) updates.splitType = b.splitType;
    if (b.splitRatio !== undefined) updates.splitRatio = b.splitRatio !== null ? String(b.splitRatio) : null;
    if (b.paidById !== undefined) updates.paidById = b.paidById;
    if (b.categoryId !== undefined) updates.categoryId = b.categoryId;
    if (b.accountId !== undefined) updates.accountId = b.accountId;
    if (b.isRecurring !== undefined) updates.isRecurring = b.isRecurring;

    const [row] = await db.update(transactionsTable).set(updates).where(eq(transactionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    const catMap = await getCatMap();
    const partnerMap = await getPartnerMap();
    res.json(txRow(row as unknown as Record<string, unknown>, catMap, partnerMap));
  } catch {
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    await db.delete(transactionsTable).where(eq(transactionsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

export default router;
