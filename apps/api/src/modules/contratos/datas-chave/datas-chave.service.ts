import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContratoEventoTipo,
  DataChaveTipo,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoDatasChaveService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoDataChave.findMany({
      where: { contratoId },
      orderBy: { data: 'asc' },
    });
  }

  async add(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      tipo: DataChaveTipo;
      data: Date;
      descricao?: string;
      alertaDias?: number[];
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    const dataChave = await this.prisma.contratoDataChave.create({
      data: { contratoId, ...dto },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.DATA_CHAVE_ADICIONADA,
        resumo: `${dto.tipo} em ${dto.data.toISOString().slice(0, 10)}`,
        payload: { dataChaveId: dataChave.id, tipo: dto.tipo } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return dataChave;
  }

  async marcarCumprida(
    tenantId: string,
    actorUserId: string,
    dataChaveId: string,
  ) {
    const dc = await this.prisma.contratoDataChave.findFirst({
      where: { id: dataChaveId, contrato: { tenantId } },
    });
    if (!dc) throw new NotFoundException('DataChave not found');

    const updated = await this.prisma.contratoDataChave.update({
      where: { id: dataChaveId },
      data: { cumprida: true, cumpridaEm: new Date(), cumpridaPor: actorUserId },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: dc.contratoId,
        tipo: ContratoEventoTipo.DATA_CHAVE_CUMPRIDA,
        resumo: `${dc.tipo} cumprida`,
        payload: { dataChaveId } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return updated;
  }

  /** Para o scanner global (worker BullMQ) — usado pelo serviço de alertas. */
  async listVencendoEm(tenantId: string, dias: number) {
    const agora = new Date();
    const limite = new Date(agora);
    limite.setDate(limite.getDate() + dias);
    return this.prisma.contratoDataChave.findMany({
      where: {
        contrato: { tenantId, deletedAt: null },
        cumprida: false,
        data: { gte: agora, lte: limite },
      },
      include: {
        contrato: {
          select: { id: true, numeroInterno: true, titulo: true, responsavelId: true },
        },
      },
      orderBy: { data: 'asc' },
    });
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}
