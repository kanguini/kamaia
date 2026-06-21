import { Injectable, NotFoundException } from '@nestjs/common';
import { ContratoEventoTipo } from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoEventosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, contratoId: string, limit: number = 100) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    return this.prisma.contratoEvento.findMany({
      where: { contratoId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async comentar(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    texto: string,
  ) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');

    return this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.COMENTARIO,
        resumo: texto.slice(0, 500),
        payload: { texto } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });
  }
}
