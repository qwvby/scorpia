import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";

export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ notifications });
});

export const markNotificationRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.userId) throw new ApiError(404, "Сповіщення не знайдено.");
  await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
  res.json({ ok: true });
});

export const markAllNotificationsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, read: false }, data: { read: true } });
  res.json({ ok: true });
});
