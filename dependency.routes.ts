import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createDependency, deleteDependency } from "../controllers/dependency.controller";

const router = Router();
router.use(requireAuth);

router.post("/", createDependency);
router.delete("/:id", deleteDependency);

export default router;
