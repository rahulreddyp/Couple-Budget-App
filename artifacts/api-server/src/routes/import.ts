import { Router } from "express";
import { db, transactionsTable, billsTable, savingsGoalsTable } from "@workspace/db";

const router = Router();

function str(v: unknown) { return v !== undefined && v !== null ? String(v) : null; }
function num(v: unknown) { return v !== undefined && v !== null && v !== "" ? String(parseFloat(String(v))) : null; }
function bool(v: unknown) { return Boolean(v); }

router.post("/import", async (req, res) => {
  try {
    const { transactions = [], bills = [], savingsGoals = [] } = req.body as {
      transactions?: Record<string, unknown>[];
      bills?: Record<string, unknown>[];
      savingsGoals?: Record<string, unknown>[];
    };

    let txImported = 0;
    let billsImported = 0;
    let goalsImported = 0;

    if (transactions.length > 0) {
      const rows = transactions.map((tx) => ({
        date: String(tx.date),
        amount: String(parseFloat(String(tx.amount)) || 0),
        merchant: String(tx.merchant || "Unknown"),
        notes: str(tx.notes),
        type: String(tx.type || "expense"),
        ownership: String(tx.ownership || "shared"),
        splitType: String(tx.splitType || "fifty_fifty"),
        splitRatio: num(tx.splitRatio),
        paidById: parseInt(String(tx.paidById)) || 1,
        categoryId: parseInt(String(tx.categoryId)) || 1,
        accountId: tx.accountId ? parseInt(String(tx.accountId)) : null,
        isRecurring: bool(tx.isRecurring),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(transactionsTable).values(rows.slice(i, i + 100));
        txImported += rows.slice(i, i + 100).length;
      }
    }

    if (bills.length > 0) {
      const rows = bills.map((b) => ({
        name: String(b.name || "Imported Bill"),
        amount: String(parseFloat(String(b.amount)) || 0),
        dueDay: parseInt(String(b.dueDay)) || 1,
        frequency: String(b.frequency || "monthly"),
        ownership: String(b.ownership || "shared"),
        paidById: parseInt(String(b.paidById)) || 1,
        isPaidThisCycle: bool(b.isPaidThisCycle),
        isActive: b.isActive !== false,
        categoryId: b.categoryId ? parseInt(String(b.categoryId)) : null,
        notes: str(b.notes),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(billsTable).values(rows.slice(i, i + 100));
        billsImported += rows.slice(i, i + 100).length;
      }
    }

    if (savingsGoals.length > 0) {
      const rows = savingsGoals.map((g) => ({
        name: String(g.name || "Imported Goal"),
        targetAmount: String(parseFloat(String(g.targetAmount)) || 0),
        currentAmount: String(parseFloat(String(g.currentAmount)) || 0),
        targetDate: g.targetDate ? String(g.targetDate) : null,
        ownerId: g.ownerId ? parseInt(String(g.ownerId)) : null,
        notes: str(g.notes),
        color: String(g.color || "#6366f1"),
        icon: String(g.icon || "piggy-bank"),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(savingsGoalsTable).values(rows.slice(i, i + 100));
        goalsImported += rows.slice(i, i + 100).length;
      }
    }

    res.json({
      success: true,
      imported: { transactions: txImported, bills: billsImported, savingsGoals: goalsImported },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Import failed", detail: msg });
    return;
  }
});

export default router;
