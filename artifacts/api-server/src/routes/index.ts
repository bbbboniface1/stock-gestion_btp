import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import stockMovementsRouter from "./stock-movements";
import projectsRouter from "./projects";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import companyRouter from "./company";
import invoicesRouter from "./invoices";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(productsRouter);
router.use(stockMovementsRouter);
router.use(projectsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(companyRouter);
router.use(invoicesRouter);
router.use(auditRouter);

export default router;
