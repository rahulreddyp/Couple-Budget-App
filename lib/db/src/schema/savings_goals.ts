import { pgTable, serial, text, integer, numeric, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savingsGoalsTable = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  targetDate: date("target_date"),
  ownerId: integer("owner_id"),
  color: varchar("color", { length: 20 }).notNull().default("#6366f1"),
  icon: varchar("icon", { length: 50 }).notNull().default("piggy-bank"),
  notes: text("notes"),
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoalsTable).omit({ id: true });
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoalsTable.$inferSelect;
