import { Router } from "express";
import { db } from "@workspace/db";
import { partnersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/partners", async (_req, res) => {
  try {
    const partners = await db.select().from(partnersTable).orderBy(partnersTable.id);
    res.json(partners.map((p) => ({
      ...p,
      avatarInitials: p.avatarInitials || p.name.slice(0, 2).toUpperCase(),
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

router.patch("/partners/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, color } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      updates.name = name;
      updates.avatarInitials = name.slice(0, 2).toUpperCase();
    }
    if (color !== undefined) updates.color = color;

    const [updated] = await db
      .update(partnersTable)
      .set(updates)
      .where(eq(partnersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Partner not found" }); return; }
    res.json({ ...updated, avatarInitials: updated.avatarInitials || updated.name.slice(0, 2).toUpperCase() });
  } catch (err) {
    res.status(500).json({ error: "Failed to update partner" });
  }
});

export default router;
