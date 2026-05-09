import { pgTable, serial, integer, numeric, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  categoryId: integer("category_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  rolloverEnabled: boolean("rollover_enabled").notNull().default(false),
  rolloverAmount: numeric("rollover_amount", { precision: 12, scale: 2 }),
});

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;
