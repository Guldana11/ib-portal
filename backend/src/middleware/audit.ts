import { Request } from 'express';
import prisma from '../config/database';

interface AuditLogParams {
  userId?: string;
  action: string;
  entityId?: string;
  metadata?: object;
  req: Request;
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityId: params.entityId,
        metadata: params.metadata as any,
        ipAddress: params.req.ip || params.req.socket.remoteAddress,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
