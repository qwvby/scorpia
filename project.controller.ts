import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { createProjectSchema, updateProjectSchema } from "../utils/validators";
import { AuthRequest } from "../middleware/auth";
import {
  logActivity,
  recalcProjectProgress,
  computeProjectHealth,
  getProjectDeadlineConflict,
} from "../services/businessLogic";

// A user can see a project if they own it or are a member of it.
async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) throw new ApiError(404, "Проєкт не знайдено.");
  const isMember = project.ownerId === userId || project.members.some((m: any) => m.userId === userId);
  if (!isMember) throw new ApiError(403, "Немає доступу до цього проєкту.");
  return project;
}

export const listProjects = asyncHandler(async (req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerId: req.userId }, { members: { some: { userId: req.userId } } }] },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true } } },
  });
  const withHealth = await Promise.all(
    projects.map(async (p: any) => ({ ...p, health: await computeProjectHealth(p.id) }))
  );
  res.json({ projects: withHealth });
});

export const getProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await assertProjectAccess(req.params.id, req.userId!);
  const health = await computeProjectHealth(project.id);
  const conflict = await getProjectDeadlineConflict(project.id);
  res.json({ project: { ...project, health, conflict } });
});

export const createProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createProjectSchema.parse(req.body);
  const project = await prisma.project.create({
    data: { ...data, ownerId: req.userId! },
  });
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: req.userId!, role: "OWNER" },
  });
  await logActivity({
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    action: "created",
    detail: "Проєкт створено",
    userId: req.userId,
  });
  res.status(201).json({ project });
});

export const updateProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  await assertProjectAccess(req.params.id, req.userId!);
  const data = updateProjectSchema.parse(req.body);
  const project = await prisma.project.update({ where: { id: req.params.id }, data });

  if (data.progressMode) await recalcProjectProgress(project.id);

  await logActivity({
    entityType: "project",
    entityId: project.id,
    entityName: project.name,
    action: "updated",
    detail: Object.keys(data).join(", ") + " змінено",
    userId: req.userId,
  });
  res.json({ project });
});

export const deleteProject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await assertProjectAccess(req.params.id, req.userId!);
  if (project.ownerId !== req.userId) throw new ApiError(403, "Лише власник може видалити проєкт.");
  await prisma.project.delete({ where: { id: project.id } });
  res.status(204).send();
});

export const addProjectMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await assertProjectAccess(req.params.id, req.userId!);
  const { userId, role } = req.body as { userId: string; role?: string };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "Користувача не знайдено.");
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId } },
    update: { role: (role as any) || "MEMBER" },
    create: { projectId: project.id, userId, role: (role as any) || "MEMBER" },
  });
  res.status(201).json({ member });
});
