import { Router } from "express";
import { searchHotels, cancelSearch } from "../controllers/search.controller";

const router = Router();

router.post("/api/search-hotels", searchHotels);
router.post("/api/search-hotels/:workflowId/cancel", cancelSearch);

export default router;
