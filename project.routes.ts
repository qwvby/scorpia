import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
} from "../controllers/project.controller";

const router = Router();
router.use(requireAuth);

router.get("/", listProjects);
router.post("/", createProject);
router.get("/:id", getProject);
router.patch("/:id", updateProject);
router.delete("/:id", deleteProject);
router.post("/:id/members", addProjectMember);

export default router;
