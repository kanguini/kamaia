import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActoEstado,
  AuditAction,
  ComplianceContext,
  ContratoEventoTipo,
  EntityType,
  TipoContratoCategoria,
} from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceEngine } from './engine/compliance.engine';

/**
 * Orquestra a aplicação das regras de compliance a um contrato.
 *
 * - Constrói o `ComplianceContext` a partir dos dados do contrato
 * - Invoca o `ComplianceEngine`
 * - Persiste os actos detectados como `ContratoActoRegulatorio` com
 *   `estado=PENDENTE` e `detectadoAutomaticamente=true`
 * - Escreve evento `ACTO_DETECTADO` na timeline
 *
 * **Não actualiza actos previamente confirmados pelo utilizador.**
 * Se o utilizador marcou um IS como CONCLUIDO, uma re-avaliação não
 * o sobrepõe — só adiciona novos actos detectados.
 */
@Injectable()
export class ComplianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ComplianceEngine,
    private readonly audit: AuditService,
  ) {}

  /**
   * Avalia o contrato contra todas as regras e persiste novos actos
   * detectados. Idempotente: se a mesma regra já gerou um acto, não
   * duplica.
   */
  async avaliarContrato(contratoId: string, tenantId: string, actorUserId?: string) {
    const contrato = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId },
      include: {
        tipo: true,
        partes: { include: { entidade: true } },
        actosRegulatorios: true,
      },
    });
    if (!contrato) throw new NotFoundException('Contrato not found');

    const ctx = this.buildContext(contrato);
    const refDate = contrato.dataAssinatura ?? new Date();
    const detectados = this.engine.evaluate(ctx, refDate);

    const existentes = new Set(
      contrato.actosRegulatorios
        .filter((a) => a.detectadoAutomaticamente)
        .map((a) => a.regraId),
    );

    const novos = detectados.filter((d) => !existentes.has(d.regraId));

    if (novos.length === 0) {
      return { adicionados: 0, totalSugeridos: detectados.length };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const d of novos) {
        await tx.contratoActoRegulatorio.create({
          data: {
            contratoId,
            tipo: d.tipo,
            tgisVerbaNumero: d.tgisVerbaNumero,
            baseTributavel: d.baseTributavel,
            valorLiquidar: d.valorLiquidar,
            prazoLimite: d.prazoLimite,
            estado: ActoEstado.PENDENTE,
            observacoes: d.observacoes,
            detectadoAutomaticamente: true,
            regraId: d.regraId,
            regraVersao: d.regraVersao,
            referenciaLegal: d.referenciaLegal,
            disclaimer: d.disclaimer,
          },
        });
        await tx.contratoEvento.create({
          data: {
            contratoId,
            tipo: ContratoEventoTipo.ACTO_DETECTADO,
            resumo: `${d.tipo} detectado pela regra ${d.regraId}@${d.regraVersao}`,
            payload: { regraId: d.regraId, regraVersao: d.regraVersao, tipo: d.tipo } as object,
            actorTipo: 'COMPLIANCE_ENGINE',
            actorUserId,
          },
        });
      }
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.COMPLIANCE_RULE_TRIGGERED,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      afterData: { regras: novos.map((d) => ({ id: d.regraId, tipo: d.tipo })) },
    });

    return { adicionados: novos.length, totalSugeridos: detectados.length };
  }

  async marcarConcluido(
    actoId: string,
    tenantId: string,
    actorUserId: string,
    dto: { comprovativoId?: string; observacoes?: string; custoEmAKZ?: bigint },
  ) {
    const acto = await this.prisma.contratoActoRegulatorio.findFirst({
      where: { id: actoId, contrato: { tenantId } },
    });
    if (!acto) throw new NotFoundException('Acto not found');

    const updated = await this.prisma.contratoActoRegulatorio.update({
      where: { id: actoId },
      data: {
        estado: ActoEstado.CONCLUIDO,
        concluidoEm: new Date(),
        comprovativoId: dto.comprovativoId,
        observacoes: dto.observacoes ?? acto.observacoes,
        custoEmAKZ: dto.custoEmAKZ,
        responsavelId: actorUserId,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: acto.contratoId,
        tipo: ContratoEventoTipo.ACTO_CONCLUIDO,
        resumo: `${acto.tipo} marcado como concluído`,
        payload: { actoId, regraId: acto.regraId } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO_ACTO_REGULATORIO,
      entityId: actoId,
      beforeData: acto as object,
      afterData: updated as object,
    });

    return updated;
  }

  /** Lista actos por estado, com prazo a vencer — útil para dashboards. */
  async listarPendentes(tenantId: string, dentroDosProximosDias: number = 30) {
    const limite = new Date();
    limite.setDate(limite.getDate() + dentroDosProximosDias);
    return this.prisma.contratoActoRegulatorio.findMany({
      where: {
        contrato: { tenantId, deletedAt: null },
        estado: { in: [ActoEstado.PENDENTE, ActoEstado.EM_CURSO] },
        OR: [
          { prazoLimite: null },
          { prazoLimite: { lte: limite } },
        ],
      },
      include: {
        contrato: {
          select: { id: true, numeroInterno: true, titulo: true },
        },
      },
      orderBy: [{ prazoLimite: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
  }

  /**
   * Constrói o ComplianceContext a partir do estado do contrato em DB.
   * Heurísticas para detecção de objecto baseiam-se no tipo + título +
   * códigos. Numa v2, extracção IA enriqueceria estes booleans.
   */
  private buildContext(contrato: {
    id: string;
    tenantId: string;
    titulo: string;
    valor: bigint | null;
    moeda: string | null;
    valorEmAKZ: bigint | null;
    leiAplicavel: string | null;
    tipo: { codigo: string; categoria: string };
    partes: Array<{ entidade: { nacionalidadeCambial: string; paisResidencia: string } }>;
  }): ComplianceContext {
    const codigoUpper = contrato.tipo.codigo.toUpperCase();
    const tituloLower = contrato.titulo.toLowerCase();

    return {
      contratoId: contrato.id,
      tenantId: contrato.tenantId,
      tipoCodigo: contrato.tipo.codigo,
      categoria: contrato.tipo.categoria as TipoContratoCategoria,
      valor: contrato.valor,
      moeda: contrato.moeda,
      valorEmAKZ: contrato.valorEmAKZ,
      partesResidentes: contrato.partes.map(
        (p) => p.entidade.nacionalidadeCambial === 'RESIDENTE',
      ),
      paisesResidencia: contrato.partes.map((p) => p.entidade.paisResidencia),
      leiAplicavel: contrato.leiAplicavel,
      hasObjectoImovel:
        contrato.tipo.categoria === 'IMOBILIARIO' ||
        codigoUpper.includes('IMOVEL') ||
        codigoUpper.includes('ARRENDAMENTO') ||
        tituloLower.includes('imóvel') ||
        tituloLower.includes('arrendamento'),
      hasObjectoAutomovel:
        codigoUpper.includes('AUTOMOVEL') ||
        codigoUpper.includes('VEICULO') ||
        tituloLower.includes('automóvel') ||
        tituloLower.includes('viatura'),
      hasObjectoIP:
        codigoUpper.includes('IP') ||
        codigoUpper.includes('LICENCA') ||
        codigoUpper.includes('CESSAO_IP'),
      hasObjectoSocietario:
        codigoUpper.includes('PACTO_SOCIAL') ||
        codigoUpper.includes('FUSAO') ||
        codigoUpper.includes('CISAO') ||
        codigoUpper.includes('TRANSFORMACAO_SOCIEDADE'),
    };
  }
}
