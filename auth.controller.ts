import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { registerSchema, loginSchema } from "../utils/validators";
import { AuthRequest } from "../middleware/auth";

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

function publicUser(u: { id: string; name: string; email: string; color: string }) {
  return { id: u.id, name: u.name, email: u.email, color: u.color };
}

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw new ApiError(409, "Користувач із такою поштою вже зареєстрований.");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email.toLowerCase(), passwordHash },
  });

  const token = signToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user) throw new ApiError(401, "Невірна пошта або пароль.");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Невірна пошта або пароль.");

  const token = signToken(user.id);
  res.json({ token, user: publicUser(user) });
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new ApiError(404, "Користувача не знайдено.");
  res.json({ user: publicUser(user) });
});
