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
    // BUG fix (auditoria #3): delete por ID-só permitia que um caller
    // com posse de C1 apagasse parteId que pertencesse a C2 (no mesmo
    // tenant). deleteMany com filtro {id, contratoId} é seguro: se
    // não bate, count=0 e levantamos 404.
    const r = await this.prisma.contratoParte.deleteMany({
      where: { id: parteId, contratoId },
    });
    if (r.count === 0) {
      throw new NotFoundException('Parte não pertence a este contrato');
    }
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
