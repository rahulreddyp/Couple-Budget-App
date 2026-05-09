import { Router } from "express";
import { db, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/accounts", async (_req, res) => {
  try {
    const rows = await db.select().from(accountsTable).orderBy(accountsTable.id);
    res.json(rows.map((r) => ({
      ...r,
      balance: r.balance ? parseFloat(r.balance) : null,
      isJoint: r.isJoint ?? false,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const { name, type, ownerId, balance, isJoint } = req.body;
    const [row] = await db.insert(accountsTable).values({
      name,
      type: type ?? "checking",
      ownerId: ownerId ?? null,
      balance: balance !== undefined ? String(balance) : null,
      isJoint: isJoint ?? false,
    }).returning();
    res.status(201).json({ ...row, balance: row.balance ? parseFloat(row.balance) : null });
  } catch {
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.patch("/accounts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.ownerId !== undefined) updates.ownerId = req.body.ownerId;
    if (req.body.balance !== undefined) updates.balance = String(req.body.balance);
    if (req.body.isJoint !== undefined) updates.isJoint = req.body.isJoint;
    const [row] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, balance: row.balance ? parseFloat(row.balance) : null });
  } catch {
    res.status(500).json({ error: "Failed to update account" });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    await db.delete(accountsTable).where(eq(accountsTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
