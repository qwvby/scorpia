import { Response } from "express";
import { prisma } from "../config/db";
import { asyncHandler } from "../middleware/errorHandler";
import { AuthRequest } from "../middleware/auth";

export const listActivity = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
  const where: any = {};
  if (entityType && entityId) {
    where.entityType = entityType;
    where.entityId = entityId;
  }
  const activity = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, color: true } } },
  });
  res.json({ activity });
});
