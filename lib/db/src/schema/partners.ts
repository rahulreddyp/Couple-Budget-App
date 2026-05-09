import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#6366f1"),
  role: varchar("role", { length: 20 }).notNull(), // partner_a | partner_b
  avatarInitials: varchar("avatar_initials", { length: 4 }).notNull().default(""),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({ id: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
