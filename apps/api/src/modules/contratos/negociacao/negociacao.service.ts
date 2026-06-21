import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContratoEventoTipo,
  NegociacaoPontoCriticidade,
  NegociacaoPontoEstado,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoNegociacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoNegociacaoPonto.findMany({
      where: { contratoId },
      orderBy: [{ estado: 'asc' }, { criticidade: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      clausulaRef: string;
      titulo: string;
      resumo: string;
      posicaoNos?: string;
      posicaoContraparte?: string;
      criticidade?: NegociacaoPontoCriticidade;
      versaoIntroduzidaId?: string;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    const ponto = await this.prisma.contratoNegociacaoPonto.create({
      data: {
        contratoId,
        createdBy: actorUserId,
        ...dto,
        criticidade: dto.criticidade ?? NegociacaoPontoCriticidade.MEDIA,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.NEGOCIACAO_PONTO_ABERTO,
        resumo: dto.titulo,
        payload: { pontoId: ponto.id } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return ponto;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    pontoId: string,
    dto: Partial<{
      titulo: string;
      resumo: string;
      posicaoNos: string;
      posicaoContraparte: string;
      acordoFinal: string;
      estado: NegociacaoPontoEstado;
      criticidade: NegociacaoPontoCriticidade;
      versaoResolvidaId: string;
    }>,
  ) {
    await this.assertContrato(tenantId, contratoId);

    const before = await this.prisma.contratoNegociacaoPonto.findFirst({
      where: { id: pontoId, contratoId },
    });
    if (!before) throw new NotFoundException('Ponto not found');

    const after = await this.prisma.contratoNegociacaoPonto.update({
      where: { id: pontoId },
      data: dto,
    });

    if (
      dto.estado &&
      [
        NegociacaoPontoEstado.ACEITE,
        NegociacaoPontoEstado.REJEITADO,
        NegociacaoPontoEstado.RETIRADO,
      ].includes(dto.estado)
    ) {
      await this.prisma.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.NEGOCIACAO_PONTO_RESOLVIDO,
          resumo: `${before.titulo} → ${dto.estado}`,
          payload: { pontoId, estado: dto.estado } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
    }

    return after;
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}
