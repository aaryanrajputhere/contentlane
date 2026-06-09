import { Router } from "express";
import { requireAuth } from "../lib/authMiddleware";
import {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from "../controllers/project.controller";

const router = Router();

// All project routes require authentication
router.use(requireAuth as any);

router.get("/", listProjects as any);
router.post("/", createProject as any);
router.get("/:id", getProject as any);
router.put("/:id", updateProject as any);
router.delete("/:id", deleteProject as any);

export default router;
