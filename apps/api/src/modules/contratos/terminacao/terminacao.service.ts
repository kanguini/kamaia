import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  canTransition,
  ContratoEstado,
  ContratoEventoTipo,
  EntityType,
  TerminacaoTipo,
} from '@kamaia/shared-types';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Injectable()
export class ContratoTerminacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async registar(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      tipo: TerminacaoTipo;
      dataEfectiva: Date;
      motivacao?: string;
      documentoId?: string;
      obrigacoesPosTermo?: object;
    },
  ) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    const estadoActual = c.estado as ContratoEstado;
    if (estadoActual === ContratoEstado.TERMINADO || estadoActual === ContratoEstado.ARQUIVADO) {
      throw new BadRequestException('Contrato já terminado');
    }

    // Respeita o grafo da state machine: TERMINADO só é alcançável a
    // partir de EM_TERMINACAO. Estados terminais "normais" (ACTIVO,
    // EM_DISPUTA) passam pelo intermédio EM_TERMINACAO na mesma tx.
    const directo = canTransition(estadoActual, ContratoEstado.TERMINADO);
    const viaIntermedio =
      !directo && canTransition(estadoActual, ContratoEstado.EM_TERMINACAO);
    if (!directo && !viaIntermedio) {
      throw new BadRequestException(
        `Não é possível terminar um contrato em estado ${estadoActual}.`,
      );
    }

    // Valida FK do documento (se fornecido) contra o tenant — evita
    // referência cruzada a documento de outro tenant.
    if (dto.documentoId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentoId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) throw new NotFoundException('Documento not found');
    }

    const term = await this.prisma.$transaction(async (tx) => {
      const t = await tx.contratoTerminacao.create({
        data: {
          contratoId,
          createdBy: actorUserId,
          ...dto,
        },
      });
      if (viaIntermedio) {
        await tx.contrato.update({
          where: { id: contratoId },
          data: { estado: ContratoEstado.EM_TERMINACAO },
        });
        await tx.contratoEvento.create({
          data: {
            contratoId,
            tipo: ContratoEventoTipo.ESTADO_ALTERADO,
            resumo: `${estadoActual} → EM_TERMINACAO (terminação iniciada)`,
            payload: { de: estadoActual, para: ContratoEstado.EM_TERMINACAO } as object,
            actorUserId,
            actorTipo: 'USER',
          },
        });
      }
      await tx.contrato.update({
        where: { id: contratoId },
        data: { estado: ContratoEstado.TERMINADO },
      });
      await tx.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.TERMINADO,
          resumo: `Terminado: ${dto.tipo}`,
          payload: dto as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      return t;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.STATE_TRANSITION,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      beforeData: { estado: estadoActual },
      afterData: { estado: ContratoEstado.TERMINADO, tipo: dto.tipo },
    });

    await this.webhooks.enqueueEvent(tenantId, 'contrato.terminado', {
      contratoId,
      numeroInterno: c.numeroInterno,
      tipoTerminacao: dto.tipo,
      dataEfectiva: dto.dataEfectiva.toISOString(),
    });

    return term;
  }

  async get(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    return this.prisma.contratoTerminacao.findUnique({
      where: { contratoId },
    });
  }
}
