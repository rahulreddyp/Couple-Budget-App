import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/categories", async (_req, res) => {
  try {
    const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, color, icon, expenseType, sortOrder } = req.body;
    const [row] = await db.insert(categoriesTable).values({
      name,
      color: color ?? "#6366f1",
      icon: icon ?? "tag",
      expenseType: expenseType ?? "variable",
      sortOrder: sortOrder ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.patch("/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = {};
    const fields = ["name", "color", "icon", "expenseType", "sortOrder"];
    for (const f of fields) if (req.body[f] !== undefined) updates[f === "expenseType" ? "expenseType" : f] = req.body[f];
    const [row] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, parseInt(req.params.id)));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
