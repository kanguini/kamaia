import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsRepository {
  constructor(private prisma: PrismaService) {}

  async getProcessoReport(gabineteId: string, processoId: string) {
    return this.prisma.processo.findFirst({
      where: { id: processoId, gabineteId, deletedAt: null },
      include: {
        cliente: {
          select: { name: true, nif: true, email: true, phone: true, type: true },
        },
        advogado: {
          select: { firstName: true, lastName: true, email: true },
        },
        prazos: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'asc' },
          select: {
            title: true,
            type: true,
            status: true,
            dueDate: true,
            description: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            type: true,
            description: true,
            createdAt: true,
          },
        },
        documents: {
          where: { deletedAt: null },
          select: {
            title: true,
            category: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getClienteReport(gabineteId: string, clienteId: string) {
    return this.prisma.cliente.findFirst({
      where: { id: clienteId, gabineteId, deletedAt: null },
      include: {
        processos: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            processoNumber: true,
            title: true,
            type: true,
            status: true,
            stage: true,
            priority: true,
            createdAt: true,
          },
        },
        advogado: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async getPrazosReport(gabineteId: string, filters?: { status?: string; from?: Date; to?: Date }) {
    const where: any = {
      gabineteId,
      deletedAt: null,
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.from || filters?.to) {
      where.dueDate = {};
      if (filters.from) where.dueDate.gte = filters.from;
      if (filters.to) where.dueDate.lte = filters.to;
    }

    return this.prisma.prazo.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        processo: {
          select: { title: true, processoNumber: true },
        },
      },
    });
  }

  async getGabineteStats(gabineteId: string) {
    const [
      totalProcessos,
      activeProcessos,
      totalClientes,
      pendingPrazos,
      overduePrazos,
    ] = await Promise.all([
      this.prisma.processo.count({ where: { gabineteId, deletedAt: null } }),
      this.prisma.processo.count({
        where: { gabineteId, deletedAt: null, status: 'ACTIVO' },
      }),
      this.prisma.cliente.count({ where: { gabineteId, deletedAt: null } }),
      this.prisma.prazo.count({
        where: { gabineteId, deletedAt: null, status: 'PENDENTE' },
      }),
      this.prisma.prazo.count({
        where: {
          gabineteId,
          deletedAt: null,
          status: 'PENDENTE',
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      totalProcessos,
      activeProcessos,
      totalClientes,
      pendingPrazos,
      overduePrazos,
    };
  }
}
