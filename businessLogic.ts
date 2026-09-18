import { prisma } from "../config/db";
import { TaskStatus } from "@prisma/client";

/* =============================================================
   ONE SOURCE OF TRUTH: усі похідні величини (прогрес, дедлайни,
   статус здоров'я проєкту) перераховуються з первинних записів
   (Task/Project) при кожній мутації. Каскад: Subtask -> Task -> Project.
   Це серверний еквівалент логіки з прототипу — тепер над реальною БД.
============================================================= */

function fmt(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

export async function logActivity(opts: {
  entityType: string;
  entityId: string;
  entityName?: string | null;
  action: string;
  detail?: string | null;
  userId?: string | null;
}) {
  await prisma.activity.create({
    data: {
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName ?? null,
      action: opts.action,
      detail: opts.detail ?? null,
      userId: opts.userId ?? null,
    },
  });
}

export async function pushNotification(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
    },
  });
}

// Bottom-up: Subtasks -> Task -> Project progress.
export async function recalcTaskProgress(taskId: string, actorId?: string | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const subtasks = await prisma.task.findMany({ where: { parentTaskId: taskId } });
  if (subtasks.length && task.progressMode !== "MANUAL") {
    const avg = Math.round(subtasks.reduce((s: number, t: any) => s + t.progress, 0) / subtasks.length);
    if (avg !== task.progress) {
      let newStatus: TaskStatus = task.status;
      if (avg === 100 && task.status !== "COMPLETED") newStatus = "COMPLETED";
      else if (avg > 0 && avg < 100 && task.status === "TODO") newStatus = "IN_PROGRESS";
      else if (avg < 100 && task.status === "COMPLETED") newStatus = "IN_PROGRESS";
      await prisma.task.update({ where: { id: taskId }, data: { progress: avg, status: newStatus } });
    }
  }

  if (task.parentTaskId) {
    await recalcTaskProgress(task.parentTaskId, actorId);
  } else {
    await recalcProjectProgress(task.projectId);
  }
}

export async function recalcProjectProgress(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.progressMode === "MANUAL") return;

  const topTasks = await prisma.task.findMany({ where: { projectId, parentTaskId: null } });
  if (!topTasks.length) {
    if (project.progress !== 0) await prisma.project.update({ where: { id: projectId }, data: { progress: 0 } });
    return;
  }

  let progress: number;
  if (project.progressMode === "EFFORT") {
    let totalH = 0, doneH = 0;
    for (const t of topTasks) {
      const h = t.estimatedHours || 1;
      totalH += h;
      doneH += h * (t.progress / 100);
    }
    progress = totalH ? Math.round((doneH / totalH) * 100) : 0;
  } else {
    progress = Math.round(topTasks.reduce((s: number, t: any) => s + t.progress, 0) / topTasks.length);
  }

  if (progress !== project.progress) {
    await prisma.project.update({ where: { id: projectId }, data: { progress } });
  }
}

// Cascading deadline sync: Subtask due dates -> Task due date -> Project deadline.
// Only applies where deadlineMode === DYNAMIC; LOCKED entities are left untouched
// (conflicts are surfaced separately via getProjectDeadlineConflict).
export async function recalcTaskDeadline(taskId: string, actorId?: string | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const subtasks = await prisma.task.findMany({ where: { parentTaskId: taskId } });
  if (subtasks.length) {
    const maxDue: Date | null = subtasks.reduce(
      (m: Date | null, t: any) => (!m || t.dueDate > m ? t.dueDate : m),
      null as Date | null
    );
    if (maxDue && maxDue.getTime() !== task.dueDate.getTime()) {
      const old = task.dueDate;
      await prisma.task.update({ where: { id: taskId }, data: { dueDate: maxDue } });
      await logActivity({
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
        action: "deadline_changed",
        detail: `${fmt(old)} → ${fmt(maxDue)} (через підзадачу)`,
        userId: actorId,
      });
      if (task.responsibleId) {
        await pushNotification({
          userId: task.responsibleId,
          type: "deadline_changed",
          title: "Дедлайн задачі змінено",
          message: `«${task.title}»: ${fmt(old)} → ${fmt(maxDue)}`,
          entityType: "task",
          entityId: task.id,
        });
      }
    }
  }

  if (task.parentTaskId) {
    await recalcTaskDeadline(task.parentTaskId, actorId);
  } else {
    await recalcProjectDeadline(task.projectId, actorId);
  }
}

export async function recalcProjectDeadline(projectId: string, actorId?: string | null) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deadlineMode !== "DYNAMIC") return;

  const topTasks = await prisma.task.findMany({ where: { projectId, parentTaskId: null } });
  if (!topTasks.length) return;

  const maxDue: Date | null = topTasks.reduce((m: Date | null, t: any) => (!m || t.dueDate > m ? t.dueDate : m), null as Date | null);
  if (maxDue && maxDue.getTime() !== project.deadline.getTime()) {
    const old = project.deadline;
    await prisma.project.update({ where: { id: projectId }, data: { deadline: maxDue } });
    await logActivity({
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      action: "deadline_changed",
      detail: `${fmt(old)} → ${fmt(maxDue)}`,
      userId: actorId,
    });

    const members = await prisma.projectMember.findMany({ where: { projectId } });
    const recipients = new Set([project.ownerId, ...members.map((m: any) => m.userId)]);
    for (const userId of recipients) {
      await pushNotification({
        userId,
        type: "deadline_changed",
        title: "Дедлайн проєкту змінено",
        message: `«${project.name}»: ${fmt(old)} → ${fmt(maxDue)}`,
        entityType: "project",
        entityId: project.id,
      });
    }
  }
}

// Locked-mode conflict: a top-level task's due date exceeds the fixed project deadline.
export async function getProjectDeadlineConflict(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deadlineMode !== "LOCKED") return null;

  const topTasks = await prisma.task.findMany({ where: { projectId, parentTaskId: null } });
  const maxDue: Date | null = topTasks.reduce((m: Date | null, t: any) => (!m || t.dueDate > m ? t.dueDate : m), null as Date | null);
  if (maxDue && maxDue.getTime() > project.deadline.getTime()) {
    const offender = topTasks.find((t: any) => t.dueDate.getTime() === maxDue.getTime());
    return { maxDue, offenderId: offender?.id, offenderTitle: offender?.title };
  }
  return null;
}

export async function computeProjectHealth(projectId: string): Promise<"ON_TRACK" | "AT_RISK" | "DELAYED"> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return "ON_TRACK";
  if (project.status === "COMPLETED" || project.status === "CANCELLED") return "ON_TRACK";

  const today = new Date();
  const tasks = await prisma.task.findMany({ where: { projectId } });
  const overdue = tasks.some(
    (t: any) => t.dueDate < today && t.status !== "COMPLETED" && t.status !== "CANCELLED"
  );
  if (today > project.deadline || overdue) return "DELAYED";

  const totalMs = project.deadline.getTime() - project.startDate.getTime() || 1;
  const elapsedMs = today.getTime() - project.startDate.getTime();
  const expected = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
  if (expected - project.progress > 15) return "AT_RISK";
  return "ON_TRACK";
}
