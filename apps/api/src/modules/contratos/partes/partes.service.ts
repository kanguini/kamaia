import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContratoEventoTipo,
  PartePapel,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoPartesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoParte.findMany({
      where: { contratoId },
      include: { entidade: true },
      orderBy: { ordem: 'asc' },
    });
  }

  async add(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      entidadeId: string;
      papel: PartePapel;
      representanteNome?: string;
      representanteCargo?: string;
      representanteBI?: string;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    const parte = await this.prisma.contratoParte.create({
      data: { contratoId, ...dto },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.PARTE_ADICIONADA,
        resumo: `Parte adicionada: ${dto.papel}`,
        payload: { parteId: parte.id, papel: dto.papel } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return parte;
  }

  async remove(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    parteId: string,
  ) {
    await this.assertContrato(tenantId, contratoId);
    await this.prisma.contratoParte.delete({ where: { id: parteId } });
    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.PARTE_REMOVIDA,
        resumo: `Parte removida`,
        payload: { parteId } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });
    return { ok: true };
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}
