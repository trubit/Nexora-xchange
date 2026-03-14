 import express from "express";
import {
  getUser,
  listUsers,
  updateUser,
} from "../controllers/usersController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("admin"), listUsers);
router.get("/:id", requireAuth, getUser);
router.put("/:id", requireAuth, updateUser);

export default router; 

