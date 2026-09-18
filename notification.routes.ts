import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller";

const router = Router();
router.use(requireAuth);

router.get("/", listNotifications);
router.post("/:id/read", markNotificationRead);
router.post("/read-all", markAllNotificationsRead);

export default router;
