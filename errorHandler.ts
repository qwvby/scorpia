import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Wrap async route handlers so thrown/rejected errors reach errorHandler
// instead of crashing the process or hanging the request.
export function asyncHandler(fn: (...args: any[]) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Маршрут не знайдено: ${req.method} ${req.path}` });
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Помилка валідації", details: err.errors });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err?.code === "P2002") {
    return res.status(409).json({ error: "Запис із такими унікальними полями вже існує." });
  }
  if (err?.code === "P2025") {
    return res.status(404).json({ error: "Запис не знайдено." });
  }
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера." });
}
