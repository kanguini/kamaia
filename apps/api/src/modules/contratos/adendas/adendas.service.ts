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
  ContratoOrigem,
  EntityType,
} from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Adendas — modificações ao contrato vigente.
 *
 * Modelo: a adenda é ela própria um `Contrato` com `parentContratoId`
 * a apontar para o original. O `Contrato.adendas` (relation oposta) lista
 * todas as alterações vigentes.
 *
 * Regras:
 *   - O pai tem de estar em `ACTIVO` para receber adendas
 *   - A adenda herda partes (e datas-chave se pedido)
 *   - O pai transita temporariamente para `EM_ADENDA`; volta a `ACTIVO`
 *     quando a adenda for assinada
 *   - A adenda segue o seu próprio ciclo de estados
 */
@Injectable()
export class ContratoAdendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(tenantId: string, parentId: string) {
    await this.assertContrato(tenantId, parentId);
    return this.prisma.contrato.findMany({
      where: { tenantId, parentContratoId: parentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        tipo: { select: { codigo: true, nome: true } },
        _count: { select: { versoes: true, actosRegulatorios: true } },
      },
    });
  }

  async criar(
    tenantId: string,
    actorUserId: string,
    parentId: string,
    dto: {
      titulo: string;
      descricao?: string;
      herdarPartes?: boolean;
      valor?: bigint;
      moeda?: string;
      dataTermo?: Date;
    },
  ) {
    const parent = await this.prisma.contrato.findFirst({
      where: { id: parentId, tenantId, deletedAt: null },
      include: { partes: true },
    });
    if (!parent) throw new NotFoundException('Contrato pai não encontrado');
    if (parent.estado !== ContratoEstado.ACTIVO) {
      throw new BadRequestException(
        `Adenda só pode ser criada sobre contrato ACTIVO (estado actual: ${parent.estado})`,
      );
    }
    if (parent.parentContratoId) {
      throw new BadRequestException(
        'Não é permitido criar adendas sobre adendas. ' +
          'Crie a nova adenda directamente sobre o contrato original.',
      );
    }

    const adenda = await this.prisma.$transaction(async (tx) => {
      // Race-safe: lock por (tenant + parent) já que adendas só
      // colidem dentro do conjunto do mesmo parent.
      const numeroInterno = await this.gerarNumeroAdendaNaTransaction(
        tx,
        tenantId,
        parent.numeroInterno,
      );

      const a = await tx.contrato.create({
        data: {
          tenantId,
          numeroInterno,
          titulo: dto.titulo,
          descricao: dto.descricao,
          tipoId: parent.tipoId,
          carteiraId: parent.carteiraId,
          parentContratoId: parent.id,
          estado: ContratoEstado.DRAFTING,
          origem: ContratoOrigem.ADENDA,
          modoEngajamento: 'D',
          valor: dto.valor ?? parent.valor,
          moeda: dto.moeda ?? parent.moeda,
          leiAplicavel: parent.leiAplicavel,
          foro: parent.foro,
          dataTermo: dto.dataTermo ?? parent.dataTermo,
          createdBy: actorUserId,
        },
      });

      if (dto.herdarPartes ?? true) {
        for (const [ordem, p] of parent.partes.entries()) {
          await tx.contratoParte.create({
            data: {
              contratoId: a.id,
              entidadeId: p.entidadeId,
              papel: p.papel,
              representanteNome: p.representanteNome,
              representanteCargo: p.representanteCargo,
              ordem,
            },
          });
        }
      }

      // Eventos: adenda criada + pai transita para EM_ADENDA
      await tx.contratoEvento.create({
        data: {
          contratoId: a.id,
          tipo: ContratoEventoTipo.CRIADO,
          resumo: `Adenda ${numeroInterno} criada sobre ${parent.numeroInterno}`,
          payload: { parentContratoId: parent.id } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      await tx.contratoEvento.create({
        data: {
          contratoId: parent.id,
          tipo: ContratoEventoTipo.ADENDA_CRIADA,
          resumo: `Adenda ${numeroInterno} criada`,
          payload: { adendaId: a.id, numeroInterno } as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      // BUG fix (auditoria #5): transição do parent passava sem
      // validação do canTransition — podia mover de qualquer estado
      // para EM_ADENDA. Cláusula do criar() já garante que parent
      // está ACTIVO, mas validamos defensivamente para audit trail.
      if (canTransition(parent.estado as ContratoEstado, ContratoEstado.EM_ADENDA)) {
        await tx.contrato.update({
          where: { id: parent.id },
          data: { estado: ContratoEstado.EM_ADENDA },
        });
        await tx.contratoEvento.create({
          data: {
            contratoId: parent.id,
            tipo: ContratoEventoTipo.ESTADO_ALTERADO,
            resumo: `${parent.estado} → EM_ADENDA (adenda ${numeroInterno} criada)`,
            payload: {
              de: parent.estado,
              para: ContratoEstado.EM_ADENDA,
              adendaId: a.id,
            } as object,
            actorUserId,
            actorTipo: 'USER',
          },
        });
      }

      return a;
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.CONTRATO,
      entityId: adenda.id,
      afterData: { parentContratoId: parent.id, numeroInterno: adenda.numeroInterno },
    });

    await this.webhooks.enqueueEvent(tenantId, 'contrato.criado', {
      contratoId: adenda.id,
      numeroInterno: adenda.numeroInterno,
      titulo: adenda.titulo,
      isAdenda: true,
      parentContratoId: parent.id,
    });

    return adenda;
  }

  private async assertContrato(tenantId: string, id: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }

  /**
   * Numeração de adenda: `{numeroPai}-A{seq:2}`.
   * Ex: CT-2026-00042 → CT-2026-00042-A01
   *
   * Race-safe: usa advisory lock cuja key é o hash do numeroPai —
   * adendas de parents diferentes não bloqueiam entre si.
   */
  private async gerarNumeroAdendaNaTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    numeroPai: string,
  ): Promise<string> {
    const prefixo = `${numeroPai}-A`;
    // Lock por (tenant, parent) — chave composta para evitar
    // contenção global no tenant. hashtext aceita só uma string,
    // concatenamos com separador improvável de aparecer em IDs.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}::${numeroPai}`}))`;

    const existentes = await tx.contrato.findMany({
      where: { tenantId, numeroInterno: { startsWith: prefixo } },
      select: { numeroInterno: true },
    });
    let seq = existentes.length + 1;
    for (let i = 0; i < 10; i++) {
      const candidato = `${prefixo}${seq.toString().padStart(2, '0')}`;
      if (!existentes.some((e) => e.numeroInterno === candidato)) return candidato;
      seq += 1;
    }
    return `${prefixo}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  }
}
