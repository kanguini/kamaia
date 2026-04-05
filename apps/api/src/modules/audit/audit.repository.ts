import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AuditLogEntry } from '@kamaia/shared-types';

@Injectable()
export class AuditRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: AuditLogEntry & { userAgent?: string }) {
    return this.prisma.auditLog.create({
      data: {
        gabineteId: data.gabineteId,
        userId: data.userId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        oldValue: data.oldValue as Prisma.InputJsonValue | undefined,
        newValue: data.newValue as Prisma.InputJsonValue | undefined,
        ipAddress: data.ip,
        userAgent: data.userAgent,
      },
    });
  }
}
