import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listComments, createComment, deleteComment } from "../controllers/comment.controller";

const router = Router();
router.use(requireAuth);

router.get("/", listComments);
router.post("/", createComment);
router.delete("/:id", deleteComment);

export default router;
