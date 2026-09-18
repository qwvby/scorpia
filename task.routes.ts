import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listTasks, getTask, createTask, updateTask, deleteTask } from "../controllers/task.controller";

const router = Router();
router.use(requireAuth);

router.get("/", listTasks);
router.post("/", createTask);
router.get("/:id", getTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
