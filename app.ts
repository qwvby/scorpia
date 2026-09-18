import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes";
import projectRoutes from "./routes/project.routes";
import taskRoutes from "./routes/task.routes";
import dependencyRoutes from "./routes/dependency.routes";
import commentRoutes from "./routes/comment.routes";
import notificationRoutes from "./routes/notification.routes";
import activityRoutes from "./routes/activity.routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  // Stricter limiter on auth endpoints to slow down credential stuffing / brute force.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
  app.use("/api/auth", authLimiter, authRoutes);

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
  app.use("/api", apiLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true, service: "scorpia-backend" }));

  app.use("/api/projects", projectRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/dependencies", dependencyRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/activity", activityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
