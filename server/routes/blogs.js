import express from "express";
import {
  createBlog,
  deleteBlog,
  getBlog,
  getRelatedBlogs,
  likeBlog,
  listBlogs,
  uploadBlogImage,
  updateBlog,
} from "../controllers/blogsController.js";
import { blogImageUpload } from "../middleware/blogUpload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

// Blog CRUD and interaction routes.
const router = express.Router();

// Public routes.
router.get("/", listBlogs);
router.get("/:id", getBlog);
router.get("/:id/related", getRelatedBlogs);
router.post("/:id/like", likeBlog);

// Admin-only write routes.
router.post(
  "/upload",
  requireAuth,
  requireRole("admin"),
  blogImageUpload.single("image"),
  uploadBlogImage,
);
router.post("/", requireAuth, requireRole("admin"), createBlog);
router.put("/:id", requireAuth, requireRole("admin"), updateBlog);
router.delete("/:id", requireAuth, requireRole("admin"), deleteBlog);

export default router;
