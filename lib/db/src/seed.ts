import { db, pool } from "./index";
import {
  partnersTable,
  categoriesTable,
  accountsTable,
  transactionsTable,
  billsTable,
  budgetsTable,
  savingsGoalsTable,
} from "./schema";
import { sql } from "drizzle-orm";

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateInMonth(yyyyMM: string, day: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yyyyMM}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function randBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function seed() {
  // Check if already seeded
  const existing = await db.execute(sql`SELECT COUNT(*) as count FROM partners`);
  const count = Number((existing.rows[0] as { count: string }).count);
  if (count > 0) return;

  console.log("Seeding database with demo data...");

  // Partners
  const [alex, jordan] = await db.insert(partnersTable).values([
    { name: "Alex", color: "#6366f1", role: "partner_a", avatarInitials: "AL" },
    { name: "Jordan", color: "#14b8a6", role: "partner_b", avatarInitials: "JO" },
  ]).returning();

  // Categories
  const cats = await db.insert(categoriesTable).values([
    { name: "Rent", color: "#6366f1", icon: "home", expenseType: "fixed", sortOrder: 1 },
    { name: "Groceries", color: "#10b981", icon: "shopping-cart", expenseType: "variable", sortOrder: 2 },
    { name: "Dining Out", color: "#f97316", icon: "utensils", expenseType: "wants", sortOrder: 3 },
    { name: "Transport", color: "#3b82f6", icon: "car", expenseType: "variable", sortOrder: 4 },
    { name: "Utilities", color: "#8b5cf6", icon: "zap", expenseType: "fixed", sortOrder: 5 },
    { name: "Entertainment", color: "#ec4899", icon: "film", expenseType: "wants", sortOrder: 6 },
    { name: "Healthcare", color: "#ef4444", icon: "heart", expenseType: "variable", sortOrder: 7 },
    { name: "Insurance", color: "#f59e0b", icon: "shield", expenseType: "fixed", sortOrder: 8 },
    { name: "Savings", color: "#14b8a6", icon: "piggy-bank", expenseType: "fixed", sortOrder: 9 },
    { name: "Income", color: "#22c55e", icon: "trending-up", expenseType: "income", sortOrder: 10 },
    { name: "Subscriptions", color: "#a855f7", icon: "repeat", expenseType: "fixed", sortOrder: 11 },
    { name: "Shopping", color: "#fb923c", icon: "bag", expenseType: "wants", sortOrder: 12 },
  ]).returning();

  const catByName = Object.fromEntries(cats.map((c) => [c.name, c]));

  // Accounts
  const accs = await db.insert(accountsTable).values([
    { name: "Joint Checking", type: "checking", isJoint: true, balance: "8500.00" },
    { name: "Alex Checking", type: "checking", ownerId: alex.id, isJoint: false, balance: "3200.00" },
    { name: "Jordan Checking", type: "checking", ownerId: jordan.id, isJoint: false, balance: "2800.00" },
    { name: "Joint Savings", type: "savings", isJoint: true, balance: "22000.00" },
    { name: "Alex Credit Card", type: "credit", ownerId: alex.id, isJoint: false, balance: "-1200.00" },
    { name: "Jordan Credit Card", type: "credit", ownerId: jordan.id, isJoint: false, balance: "-850.00" },
  ]).returning();

  const jointAcc = accs[0];
  const alexAcc = accs[1];
  const jordanAcc = accs[2];

  // Bills
  await db.insert(billsTable).values([
    { name: "Rent", amount: "2200.00", dueDay: 1, frequency: "monthly", ownership: "shared", paidById: alex.id, categoryId: catByName["Rent"].id, isActive: true, isPaidThisCycle: true, notes: "Split 50/50" },
    { name: "Electricity", amount: "95.00", dueDay: 10, frequency: "monthly", ownership: "shared", paidById: jordan.id, categoryId: catByName["Utilities"].id, isActive: true, isPaidThisCycle: false },
    { name: "Internet", amount: "65.00", dueDay: 15, frequency: "monthly", ownership: "shared", paidById: alex.id, categoryId: catByName["Utilities"].id, isActive: true, isPaidThisCycle: true },
    { name: "Netflix", amount: "22.99", dueDay: 8, frequency: "monthly", ownership: "shared", paidById: jordan.id, categoryId: catByName["Subscriptions"].id, isActive: true, isPaidThisCycle: true },
    { name: "Spotify Family", amount: "16.99", dueDay: 12, frequency: "monthly", ownership: "shared", paidById: alex.id, categoryId: catByName["Subscriptions"].id, isActive: true, isPaidThisCycle: false },
    { name: "Car Insurance", amount: "148.00", dueDay: 20, frequency: "monthly", ownership: "shared", paidById: jordan.id, categoryId: catByName["Insurance"].id, isActive: true, isPaidThisCycle: true },
    { name: "Gym Membership - Alex", amount: "45.00", dueDay: 5, frequency: "monthly", ownership: "personal", paidById: alex.id, categoryId: catByName["Healthcare"].id, isActive: true, isPaidThisCycle: true },
    { name: "Gym Membership - Jordan", amount: "45.00", dueDay: 5, frequency: "monthly", ownership: "personal", paidById: jordan.id, categoryId: catByName["Healthcare"].id, isActive: true, isPaidThisCycle: false },
    { name: "Renter's Insurance", amount: "28.50", dueDay: 1, frequency: "monthly", ownership: "shared", paidById: alex.id, categoryId: catByName["Insurance"].id, isActive: true, isPaidThisCycle: true },
    { name: "Amazon Prime", amount: "14.99", dueDay: 22, frequency: "monthly", ownership: "shared", paidById: jordan.id, categoryId: catByName["Subscriptions"].id, isActive: true, isPaidThisCycle: false },
    { name: "Water & Sewer", amount: "55.00", dueDay: 18, frequency: "monthly", ownership: "shared", paidById: alex.id, categoryId: catByName["Utilities"].id, isActive: true, isPaidThisCycle: true },
    { name: "Phone Plan - Alex", amount: "75.00", dueDay: 25, frequency: "monthly", ownership: "personal", paidById: alex.id, categoryId: catByName["Subscriptions"].id, isActive: true, isPaidThisCycle: false },
  ]);

  // Savings Goals
  await db.insert(savingsGoalsTable).values([
    { name: "Emergency Fund", targetAmount: "15000.00", currentAmount: "9500.00", targetDate: "2026-12-31", color: "#6366f1", icon: "shield" },
    { name: "Europe Vacation", targetAmount: "8000.00", currentAmount: "3200.00", targetDate: "2026-09-01", color: "#14b8a6", icon: "plane" },
    { name: "New Car Down Payment", targetAmount: "12000.00", currentAmount: "4800.00", targetDate: "2027-06-01", color: "#f97316", icon: "car" },
    { name: "Wedding Fund", targetAmount: "25000.00", currentAmount: "7500.00", targetDate: "2027-10-01", color: "#ec4899", icon: "heart" },
  ]);

  // Transactions — 6 months of realistic data
  const months = Array.from({ length: 6 }, (_, i) => monthsAgo(5 - i));

  const txRows = [];

  for (const mo of months) {
    // Income
    txRows.push(
      { date: dateInMonth(mo, 1), amount: "5200.00", merchant: "TechCorp Inc.", notes: "Alex salary", type: "income", ownership: "personal", splitType: "personal", splitRatio: null, paidById: alex.id, categoryId: catByName["Income"].id, accountId: alexAcc.id, isRecurring: true },
      { date: dateInMonth(mo, 1), amount: "4800.00", merchant: "DesignStudio LLC", notes: "Jordan salary", type: "income", ownership: "personal", splitType: "personal", splitRatio: null, paidById: jordan.id, categoryId: catByName["Income"].id, accountId: jordanAcc.id, isRecurring: true },
    );

    // Freelance income (some months)
    if (Math.random() > 0.4) {
      txRows.push({ date: dateInMonth(mo, pick([10, 15, 20])), amount: String(randBetween(500, 1800)), merchant: "Freelance Client", notes: "Contract work", type: "income", ownership: "personal", splitType: "personal", splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Income"].id, accountId: alexAcc.id, isRecurring: false });
    }

    // Rent
    txRows.push({ date: dateInMonth(mo, 1), amount: "2200.00", merchant: "Oakwood Apartments", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: alex.id, categoryId: catByName["Rent"].id, accountId: jointAcc.id, isRecurring: true, notes: null });

    // Groceries (2-4 per month)
    const groceryMerchants = ["Whole Foods", "Trader Joe's", "Kroger", "Costco", "Aldi"];
    for (let i = 0; i < 3; i++) {
      txRows.push({ date: dateInMonth(mo, pick([4, 8, 12, 18, 22, 26])), amount: String(randBetween(65, 185)), merchant: pick(groceryMerchants), type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Groceries"].id, accountId: jointAcc.id, isRecurring: false, notes: null });
    }

    // Dining Out (3-5 per month)
    const restaurants = ["Pasta Roma", "Sushi Garden", "The Burger Joint", "Café Misto", "Thai Palace", "El Taco Loco", "Pizza Napoli", "Seoul Kitchen"];
    for (let i = 0; i < 4; i++) {
      txRows.push({ date: dateInMonth(mo, pick([3, 7, 11, 14, 17, 21, 25, 28])), amount: String(randBetween(28, 95)), merchant: pick(restaurants), type: "expense", ownership: pick(["shared", "personal"]), splitType: "fifty_fifty", splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Dining Out"].id, accountId: pick([alexAcc.id, jordanAcc.id]), isRecurring: false, notes: null });
    }

    // Transport
    const transportMerchants = ["Uber", "Lyft", "Shell Gas", "BP Gas", "Metro Card", "Parking Garage"];
    for (let i = 0; i < 3; i++) {
      txRows.push({ date: dateInMonth(mo, pick([2, 6, 9, 13, 16, 19, 23, 27])), amount: String(randBetween(15, 75)), merchant: pick(transportMerchants), type: "expense", ownership: pick(["shared", "personal"]), splitType: pick(["fifty_fifty", "personal"]), splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Transport"].id, accountId: pick([alexAcc.id, jordanAcc.id]), isRecurring: false, notes: null });
    }

    // Utilities
    txRows.push(
      { date: dateInMonth(mo, 10), amount: String(randBetween(75, 110)), merchant: "Power & Light Co.", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: jordan.id, categoryId: catByName["Utilities"].id, accountId: jointAcc.id, isRecurring: true, notes: null },
      { date: dateInMonth(mo, 15), amount: "65.00", merchant: "Fiber Internet", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: alex.id, categoryId: catByName["Utilities"].id, accountId: jointAcc.id, isRecurring: true, notes: null },
    );

    // Entertainment
    const entMerchants = ["AMC Theaters", "Bowling Alley", "Museum of Art", "Concert Tickets", "Escape Room", "Mini Golf"];
    for (let i = 0; i < 2; i++) {
      txRows.push({ date: dateInMonth(mo, pick([5, 10, 15, 20, 25])), amount: String(randBetween(20, 120)), merchant: pick(entMerchants), type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Entertainment"].id, accountId: pick([alexAcc.id, jordanAcc.id]), isRecurring: false, notes: null });
    }

    // Healthcare
    if (Math.random() > 0.5) {
      txRows.push({ date: dateInMonth(mo, pick([8, 15, 22])), amount: String(randBetween(20, 200)), merchant: pick(["CVS Pharmacy", "Walgreens", "City Medical Center", "Dr. Smith Office"]), type: "expense", ownership: "personal", splitType: "personal", splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Healthcare"].id, accountId: pick([alexAcc.id, jordanAcc.id]), isRecurring: false, notes: null });
    }

    // Subscriptions
    txRows.push(
      { date: dateInMonth(mo, 8), amount: "22.99", merchant: "Netflix", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: jordan.id, categoryId: catByName["Subscriptions"].id, accountId: jointAcc.id, isRecurring: true, notes: null },
      { date: dateInMonth(mo, 12), amount: "16.99", merchant: "Spotify", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: alex.id, categoryId: catByName["Subscriptions"].id, accountId: jointAcc.id, isRecurring: true, notes: null },
    );

    // Savings transfer
    txRows.push({ date: dateInMonth(mo, 3), amount: "800.00", merchant: "Transfer to Savings", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: alex.id, categoryId: catByName["Savings"].id, accountId: jointAcc.id, isRecurring: true, notes: "Monthly savings contribution" });

    // Insurance
    txRows.push({ date: dateInMonth(mo, 20), amount: "148.00", merchant: "State Auto Insurance", type: "expense", ownership: "shared", splitType: "fifty_fifty", splitRatio: null, paidById: jordan.id, categoryId: catByName["Insurance"].id, accountId: jointAcc.id, isRecurring: true, notes: null });

    // Shopping (occasional)
    if (Math.random() > 0.3) {
      txRows.push({ date: dateInMonth(mo, pick([6, 12, 18, 24])), amount: String(randBetween(35, 200)), merchant: pick(["Amazon", "Target", "IKEA", "HomeGoods", "Macy's", "Best Buy"]), type: "expense", ownership: pick(["shared", "personal"]), splitType: pick(["fifty_fifty", "personal", "settle_later"]), splitRatio: null, paidById: pick([alex.id, jordan.id]), categoryId: catByName["Shopping"].id, accountId: pick([alexAcc.id, jordanAcc.id]), isRecurring: false, notes: null });
    }
  }

  // Budgets for current and previous month
  const currentMonth = monthsAgo(0);
  const prevMonth = monthsAgo(1);

  const budgetData = [
    { categoryId: catByName["Rent"].id, amount: "2200.00" },
    { categoryId: catByName["Groceries"].id, amount: "400.00" },
    { categoryId: catByName["Dining Out"].id, amount: "300.00" },
    { categoryId: catByName["Transport"].id, amount: "200.00" },
    { categoryId: catByName["Utilities"].id, amount: "250.00" },
    { categoryId: catByName["Entertainment"].id, amount: "150.00" },
    { categoryId: catByName["Healthcare"].id, amount: "100.00" },
    { categoryId: catByName["Insurance"].id, amount: "200.00" },
    { categoryId: catByName["Savings"].id, amount: "800.00" },
    { categoryId: catByName["Subscriptions"].id, amount: "100.00" },
    { categoryId: catByName["Shopping"].id, amount: "200.00" },
  ];

  await db.insert(budgetsTable).values([
    ...budgetData.map((b) => ({ ...b, month: currentMonth })),
    ...budgetData.map((b) => ({ ...b, month: prevMonth })),
  ]);

  await db.insert(transactionsTable).values(txRows.map((t) => ({ ...t, notes: t.notes ?? null })));

  console.log(`Seeded: ${txRows.length} transactions, ${budgetData.length * 2} budgets, 12 bills, 4 savings goals.`);
}
