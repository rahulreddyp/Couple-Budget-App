import { pgTable, serial, text, varchar, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  merchant: text("merchant").notNull(),
  notes: text("notes"),
  type: varchar("type", { length: 20 }).notNull().default("expense"), // income | expense
  ownership: varchar("ownership", { length: 20 }).notNull().default("shared"), // shared | personal
  splitType: varchar("split_type", { length: 20 }).notNull().default("fifty_fifty"), // fifty_fifty | custom | personal | settle_later
  splitRatio: numeric("split_ratio", { precision: 5, scale: 2 }),
  paidById: integer("paid_by_id").notNull(),
  categoryId: integer("category_id").notNull(),
  accountId: integer("account_id"),
  isRecurring: boolean("is_recurring").notNull().default(false),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
