import { pgTable, serial, text, varchar, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDay: integer("due_day").notNull(), // day of month 1-31
  frequency: varchar("frequency", { length: 20 }).notNull().default("monthly"), // monthly | quarterly | annual | weekly
  ownership: varchar("ownership", { length: 20 }).notNull().default("shared"),
  paidById: integer("paid_by_id").notNull(),
  categoryId: integer("category_id"),
  isActive: boolean("is_active").notNull().default(true),
  isPaidThisCycle: boolean("is_paid_this_cycle").notNull().default(false),
  lastPaidDate: date("last_paid_date"),
  notes: text("notes"),
});

export const insertBillSchema = createInsertSchema(billsTable).omit({ id: true });
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Bill = typeof billsTable.$inferSelect;
