import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import partnersRouter from "./partners.js";
import categoriesRouter from "./categories.js";
import accountsRouter from "./accounts.js";
import transactionsRouter from "./transactions.js";
import budgetsRouter from "./budgets.js";
import billsRouter from "./bills.js";
import savingsRouter from "./savings.js";
import dashboardRouter from "./dashboard.js";
import importRouter from "./import.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(partnersRouter);
router.use(categoriesRouter);
router.use(accountsRouter);
router.use(transactionsRouter);
router.use(budgetsRouter);
router.use(billsRouter);
router.use(savingsRouter);
router.use(dashboardRouter);
router.use(importRouter);

export default router;
