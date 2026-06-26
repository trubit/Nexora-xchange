import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { lookupByUid, internalTransfer } from "../controllers/transferController.js";

const router = Router();

router.get("/lookup/:uid", requireAuth, lookupByUid);
router.post("/internal", requireAuth, internalTransfer);

export default router;
