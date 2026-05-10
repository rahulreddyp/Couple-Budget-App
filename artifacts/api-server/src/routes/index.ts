import { Router, type IRouter } from "express";
import healthRouter from "./health";
import partnersRouter from "./partners";
import categoriesRouter from "./categories";
import accountsRouter from "./accounts";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import billsRouter from "./bills";
import savingsRouter from "./savings";
import dashboardRouter from "./dashboard";
import importRouter from "./import";

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
