import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startDate: z.coerce.date(),
  deadline: z.coerce.date(),
  deadlineMode: z.enum(["DYNAMIC", "LOCKED"]).optional(),
  progressMode: z.enum(["TASKS", "EFFORT", "MANUAL"]).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  deadlineMode: z.enum(["DYNAMIC", "LOCKED"]).optional(),
  progressMode: z.enum(["TASKS", "EFFORT", "MANUAL"]).optional(),
});

export const createTaskSchema = z.object({
  projectId: z.string(),
  parentTaskId: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedHours: z.number().min(0).optional(),
  startDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  responsibleId: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "WAITING", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  progressMode: z.enum(["AUTO", "MANUAL"]).optional(),
  estimatedHours: z.number().min(0).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  responsibleId: z.string().nullable().optional(),
});

export const createCommentSchema = z.object({
  entityType: z.enum(["task", "project"]),
  entityId: z.string(),
  content: z.string().min(1).max(4000),
});

export const createDependencySchema = z.object({
  fromTaskId: z.string(),
  toTaskId: z.string(),
  type: z.enum(["FS", "SS", "FF"]).optional(),
});
