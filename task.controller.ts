import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { createTaskSchema, updateTaskSchema } from "../utils/validators";
import { AuthRequest } from "../middleware/auth";
import {
  logActivity,
  pushNotification,
  recalcTaskProgress,
  recalcTaskDeadline,
  recalcProjectDeadline,
} from "../services/businessLogic";

async function assertProjectMember(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
  if (!project) throw new ApiError(404, "Проєкт не знайдено.");
  const isMember = project.ownerId === userId || project.members.some((m: any) => m.userId === userId);
  if (!isMember) throw new ApiError(403, "Немає доступу до цього проєкту.");
  return project;
}

export const listTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId, responsibleId, status } = req.query as Record<string, string | undefined>;
  if (projectId) await assertProjectMember(projectId, req.userId!);

  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (responsibleId) where.responsibleId = responsibleId;
  if (status) where.status = status;
  if (!projectId) {
    // Cross-project "My Tasks": only tasks in projects the user belongs to.
    where.project = { OR: [{ ownerId: req.userId }, { members: { some: { userId: req.userId } } }] };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: { responsible: { select: { id: true, name: true, color: true } } },
  });
  res.json({ tasks });
});

export const getTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      subtasks: true,
      dependsOn: { include: { fromTask: { select: { id: true, title: true } } } },
      responsible: { select: { id: true, name: true, color: true } },
    },
  });
  if (!task) throw new ApiError(404, "Задачу не знайдено.");
  await assertProjectMember(task.projectId, req.userId!);
  res.json({ task });
});

export const createTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createTaskSchema.parse(req.body);
  const project = await assertProjectMember(data.projectId, req.userId!);

  const task = await prisma.task.create({ data });

  if (data.parentTaskId) {
    await prisma.task.update({ where: { id: data.parentTaskId }, data: { progressMode: "AUTO" } });
    await recalcTaskProgress(data.parentTaskId, req.userId);
    await recalcTaskDeadline(data.parentTaskId, req.userId);
  } else {
    await recalcProjectDeadline(data.projectId, req.userId);
  }

  await logActivity({
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    action: "updated",
    detail: `Додано задачу «${task.title}»`,
    userId: req.userId,
  });

  if (data.responsibleId && data.responsibleId !== req.userId) {
    await pushNotification({
      userId: data.responsibleId,
      type: "assignment",
      title: "Нова задача",
      message: `Вам призначено «${task.title}»`,
      entityType: "task",
      entityId: task.id,
    });
  }

  res.status(201).json({ task });
});

export const updateTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Задачу не знайдено.");
  await assertProjectMember(existing.projectId, req.userId!);

  const data = updateTaskSchema.parse(req.body);

  // Editing progress by hand takes the task out of auto (subtask-derived) mode.
  const patch: any = { ...data };
  if (data.progress !== undefined && data.progressMode === undefined) patch.progressMode = "MANUAL";
  if (data.status === "COMPLETED" && data.progress === undefined) patch.progress = 100;

  const task = await prisma.task.update({ where: { id: req.params.id }, data: patch });

  if (data.status && data.status !== existing.status) {
    await logActivity({
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
      action: "status_changed",
      detail: `${existing.status} → ${data.status}`,
      userId: req.userId,
    });
  }
  if (data.responsibleId !== undefined && data.responsibleId !== existing.responsibleId) {
    await logActivity({
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
      action: "responsible_changed",
      detail: null,
      userId: req.userId,
    });
    if (data.responsibleId) {
      await pushNotification({
        userId: data.responsibleId,
        type: "assignment",
        title: "Вас призначено відповідальним",
        message: `«${task.title}»`,
        entityType: "task",
        entityId: task.id,
      });
    }
  }
  if (data.dueDate) {
    await logActivity({
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
      action: "deadline_changed",
      detail: null,
      userId: req.userId,
    });
  }

  if (data.progress !== undefined) await recalcTaskProgress(task.id, req.userId);
  if (data.dueDate || data.startDate) await recalcTaskDeadline(task.id, req.userId);

  res.json({ task });
});

export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) throw new ApiError(404, "Задачу не знайдено.");
  const project = await assertProjectMember(task.projectId, req.userId!);

  await prisma.task.delete({ where: { id: task.id } }); // cascades to subtasks & dependencies

  if (task.parentTaskId) await recalcTaskProgress(task.parentTaskId, req.userId);
  else await recalcProjectDeadline(task.projectId, req.userId);

  await logActivity({
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    action: "updated",
    detail: `Задачу «${task.title}» видалено`,
    userId: req.userId,
  });

  res.status(204).send();
});
