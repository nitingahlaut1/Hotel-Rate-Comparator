import { Router } from "express";
import healthRoutes from "./health.routes";
import supplierRoutes from "./supplier.routes";
import searchRoutes from "./search.routes";

const router = Router();

router.use(healthRoutes);
router.use(supplierRoutes);
router.use(searchRoutes);

export default router;
