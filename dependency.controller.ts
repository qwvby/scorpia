import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { createDependencySchema } from "../utils/validators";
import { AuthRequest } from "../middleware/auth";
import { logActivity } from "../services/businessLogic";

export const createDependency = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createDependencySchema.parse(req.body);
  if (data.fromTaskId === data.toTaskId) throw new ApiError(400, "Задача не може залежати сама від себе.");

  const [fromTask, toTask] = await Promise.all([
    prisma.task.findUnique({ where: { id: data.fromTaskId } }),
    prisma.task.findUnique({ where: { id: data.toTaskId } }),
  ]);
  if (!fromTask || !toTask) throw new ApiError(404, "Одну із задач не знайдено.");
  if (fromTask.projectId !== toTask.projectId) throw new ApiError(400, "Залежності можливі лише в межах одного проєкту.");

  const dependency = await prisma.dependency.upsert({
    where: { fromTaskId_toTaskId: { fromTaskId: data.fromTaskId, toTaskId: data.toTaskId } },
    update: { type: data.type || "FS" },
    create: { fromTaskId: data.fromTaskId, toTaskId: data.toTaskId, type: data.type || "FS" },
  });

  await logActivity({
    entityType: "task",
    entityId: toTask.id,
    entityName: toTask.title,
    action: "dependency_added",
    detail: `Залежить від «${fromTask.title}»`,
    userId: req.userId,
  });

  res.status(201).json({ dependency });
});

export const deleteDependency = asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.dependency.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
