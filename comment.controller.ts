import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { createCommentSchema } from "../utils/validators";
import { AuthRequest } from "../middleware/auth";
import { pushNotification } from "../services/businessLogic";

export const listComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.query as { entityType: string; entityId: string };
  if (!entityType || !entityId) throw new ApiError(400, "Потрібні entityType і entityId.");
  const comments = await prisma.comment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, color: true } } },
  });
  res.json({ comments });
});

export const createComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createCommentSchema.parse(req.body);
  const comment = await prisma.comment.create({
    data: { ...data, authorId: req.userId! },
    include: { author: { select: { id: true, name: true, color: true } } },
  });

  if (data.entityType === "task") {
    const task = await prisma.task.findUnique({ where: { id: data.entityId } });
    if (task?.responsibleId && task.responsibleId !== req.userId) {
      await pushNotification({
        userId: task.responsibleId,
        type: "comment",
        title: "Новий коментар",
        message: `Новий коментар до «${task.title}»`,
        entityType: "task",
        entityId: task.id,
      });
    }
  }

  res.status(201).json({ comment });
});

export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) throw new ApiError(404, "Коментар не знайдено.");
  if (comment.authorId !== req.userId) throw new ApiError(403, "Можна видаляти лише свої коментарі.");
  await prisma.comment.delete({ where: { id: comment.id } });
  res.status(204).send();
});
