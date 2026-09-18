import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("Сідування бази даних Scorpia…");

  const passwordHash = await bcrypt.hash("password123", 12);
  const [u1, u2, u3] = await Promise.all([
    prisma.user.upsert({
      where: { email: "you@scorpia.io" },
      update: {},
      create: { email: "you@scorpia.io", name: "Ви", color: "#5B7A22", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "anna@scorpia.io" },
      update: {},
      create: { email: "anna@scorpia.io", name: "Анна Коваль", color: "#B4791E", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "maksym@scorpia.io" },
      update: {},
      create: { email: "maksym@scorpia.io", name: "Максим Ткач", color: "#3D6FB4", passwordHash },
    }),
  ]);

  const today = new Date();

  const project = await prisma.project.create({
    data: {
      name: "Запуск вебсайту",
      description: "Новий корпоративний сайт компанії: дизайн, розробка, тестування, запуск.",
      status: "IN_PROGRESS",
      startDate: addDays(today, -5),
      deadline: addDays(today, 25),
      deadlineMode: "DYNAMIC",
      progressMode: "TASKS",
      ownerId: u1.id,
      members: { create: [{ userId: u1.id, role: "OWNER" }, { userId: u2.id, role: "MEMBER" }, { userId: u3.id, role: "MEMBER" }] },
    },
  });

  const design = await prisma.task.create({
    data: {
      projectId: project.id, title: "Дизайн", description: "UX/UI дизайн нового сайту.",
      status: "IN_PROGRESS", priority: "HIGH", progress: 0, progressMode: "AUTO", estimatedHours: 40,
      startDate: addDays(today, -5), dueDate: addDays(today, 3), responsibleId: u2.id,
    },
  });

  await prisma.task.createMany({
    data: [
      { projectId: project.id, parentTaskId: design.id, title: "Вайрфрейми", status: "COMPLETED", priority: "MEDIUM", progress: 100, progressMode: "MANUAL", estimatedHours: 8, startDate: addDays(today, -5), dueDate: addDays(today, -1), responsibleId: u2.id },
      { projectId: project.id, parentTaskId: design.id, title: "UI kit", status: "IN_PROGRESS", priority: "MEDIUM", progress: 60, progressMode: "MANUAL", estimatedHours: 8, startDate: addDays(today, -5), dueDate: addDays(today, 1), responsibleId: u2.id },
      { projectId: project.id, parentTaskId: design.id, title: "Прототип у Figma", status: "TODO", priority: "MEDIUM", progress: 10, progressMode: "MANUAL", estimatedHours: 8, startDate: addDays(today, -5), dueDate: addDays(today, 3), responsibleId: u2.id },
    ],
  });

  const frontend = await prisma.task.create({
    data: { projectId: project.id, title: "Розробка фронтенду", status: "TODO", priority: "HIGH", progress: 0, progressMode: "MANUAL", estimatedHours: 60, startDate: addDays(today, 3), dueDate: addDays(today, 12), responsibleId: u3.id },
  });
  const backend = await prisma.task.create({
    data: { projectId: project.id, title: "Розробка бекенду", status: "TODO", priority: "HIGH", progress: 0, progressMode: "MANUAL", estimatedHours: 50, startDate: today, dueDate: addDays(today, 14), responsibleId: u1.id },
  });
  const testing = await prisma.task.create({
    data: { projectId: project.id, title: "Тестування", status: "TODO", priority: "MEDIUM", progress: 0, progressMode: "MANUAL", estimatedHours: 20, startDate: addDays(today, 14), dueDate: addDays(today, 20), responsibleId: u2.id },
  });
  const launch = await prisma.task.create({
    data: { projectId: project.id, title: "Запуск", status: "TODO", priority: "URGENT", progress: 0, progressMode: "MANUAL", estimatedHours: 8, startDate: addDays(today, 20), dueDate: addDays(today, 22), responsibleId: u1.id },
  });

  await prisma.dependency.createMany({
    data: [
      { fromTaskId: design.id, toTaskId: frontend.id, type: "FS" },
      { fromTaskId: frontend.id, toTaskId: testing.id, type: "FS" },
      { fromTaskId: backend.id, toTaskId: testing.id, type: "FS" },
      { fromTaskId: testing.id, toTaskId: launch.id, type: "FS" },
    ],
  });

  await prisma.comment.create({
    data: {
      entityType: "task", entityId: design.id, authorId: u1.id,
      content: "Звертай увагу на мобільну версію — це головний вхід для клієнтів.",
    },
  });

  await prisma.activity.create({
    data: { entityType: "project", entityId: project.id, entityName: project.name, action: "created", detail: "Проєкт створено", userId: u1.id },
  });

  console.log("Готово. Тестові акаунти (пароль для всіх: password123):");
  console.log("  you@scorpia.io / anna@scorpia.io / maksym@scorpia.io");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
