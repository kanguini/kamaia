import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  AssinaturaEstado,
  AssinaturaMetodo,
  AuditAction,
  canTransition,
  ContratoEstado,
  ContratoEventoTipo,
  EntityType,
} from '@kamaia/shared-types';
import { createHash } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { ComplianceService } from '../../compliance/compliance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Injectable()
export class ContratoAssinaturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly compliance: ComplianceService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(contratoId: string, tenantId?: string) {
    return this.prisma.contratoAssinatura.findMany({
      // Defense in depth: mesmo que o caller controlador já valide
      // tenant, filtramos via relação para evitar regressões futuras
      // se alguém chamar este service de outro sítio sem o check.
      where: {
        contratoId,
        ...(tenantId && { contrato: { tenantId, deletedAt: null } }),
      },
      orderBy: { solicitadaEm: 'desc' },
      // Não devolver a imagemBase64 na lista (pesado); só ao GET singular
      select: {
        id: true,
        contratoId: true,
        versaoId: true,
        parteId: true,
        colaboradorId: true,
        signatarioNome: true,
        signatarioEmail: true,
        signatarioBI: true,
        cargo: true,
        metodo: true,
        estado: true,
        hashContratoSnapshot: true,
        ipAddress: true,
        geoCidade: true,
        geoPais: true,
        solicitadaEm: true,
        assinadaEm: true,
        revogadaEm: true,
        observacoes: true,
      },
    });
  }

  async get(id: string, contratoId?: string, tenantId?: string) {
    // BUG fix (auditoria #2): chamadas antigas com `get(id)` apenas
    // permitiam um caller com posse de C1 ler uma assinatura de C2
    // (tenant diferente) se conseguisse o UUID. Aceita params extra
    // e valida que assinatura.contratoId + tenant batem.
    const a = await this.prisma.contratoAssinatura.findFirst({
      where: {
        id,
        ...(contratoId && { contratoId }),
        ...(tenantId && { contrato: { tenantId, deletedAt: null } }),
      },
    });
    if (!a) throw new NotFoundException('Assinatura not found');
    return a;
  }

  /**
   * Assina o contrato. Calcula hash do markdown da versão como prova
   * de não-alteração posterior. Quando todas as partes assinaram,
   * transita o contrato para ASSINADO.
   */
  async assinar(params: {
    contratoId: string;
    tenantId: string;
    versaoId: string;
    parteId?: string;
    colaboradorId?: string;
    signatarioNome: string;
    signatarioEmail?: string;
    signatarioBI?: string;
    cargo?: string;
    metodo: AssinaturaMetodo;
    imagemBase64?: string;
    ip?: string;
    userAgent?: string;
  }) {
    // AUDIT.10: defense in depth — valida cadeia versao → contrato
    // → tenant. Versão tem contratoId, mas precisamos garantir que o
    // contrato é do tenant. Atacante com UUID conhecido podia
    // assinar contrato de tenant alheio se este check faltasse.
    const versao = await this.prisma.contratoVersao.findFirst({
      where: {
        id: params.versaoId,
        contratoId: params.contratoId,
        contrato: { tenantId: params.tenantId, deletedAt: null },
      },
    });
    if (!versao) {
      throw new NotFoundException('Versão não pertence ao contrato neste tenant');
    }
    if (!versao.corpoMarkdown) {
      throw new BadRequestException(
        'Versão não tem conteúdo editável — assinar implica snapshot do corpo.',
      );
    }

    // H5: impede re-assinatura/spam — uma assinatura ASSINADA por
    // signatário (parte interna ou colaborador externo) por contrato.
    const identCond = params.parteId
      ? { parteId: params.parteId }
      : params.colaboradorId
        ? { colaboradorId: params.colaboradorId }
        : null;
    if (identCond) {
      const jaAssinou = await this.prisma.contratoAssinatura.findFirst({
        where: {
          contratoId: params.contratoId,
          estado: AssinaturaEstado.ASSINADA,
          ...identCond,
        },
        select: { id: true },
      });
      if (jaAssinou) {
        throw new BadRequestException(
          'Já existe uma assinatura registada para este signatário neste contrato.',
        );
      }
    }

    const hash = createHash('sha256').update(versao.corpoMarkdown).digest('hex');

    const a = await this.prisma.contratoAssinatura.create({
      data: {
        contratoId: params.contratoId,
        versaoId: params.versaoId,
        parteId: params.parteId,
        colaboradorId: params.colaboradorId,
        signatarioNome: params.signatarioNome,
        signatarioEmail: params.signatarioEmail,
        signatarioBI: params.signatarioBI,
        cargo: params.cargo,
        metodo: params.metodo,
        estado: AssinaturaEstado.ASSINADA,
        imagemBase64: params.imagemBase64,
        hashContratoSnapshot: hash,
        ipAddress: params.ip,
        userAgent: params.userAgent,
        assinadaEm: new Date(),
      },
      select: {
        id: true, signatarioNome: true, metodo: true, estado: true,
        hashContratoSnapshot: true, assinadaEm: true,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: params.contratoId,
        tipo: ContratoEventoTipo.COMENTARIO,
        resumo: `Assinatura recebida de ${params.signatarioNome}`,
        payload: { assinaturaId: a.id, metodo: a.metodo } as object,
        actorTipo: params.colaboradorId ? 'EXTERNAL' : 'USER',
      },
    });

    // H6: trilha de auditoria canónica do ato (mais sensível do sistema),
    // incluindo identidade externa + IP/UA para assinaturas por convite.
    await this.audit.log({
      tenantId: params.tenantId,
      action: AuditAction.CREATE,
      entityType: EntityType.CONTRATO,
      entityId: params.contratoId,
      afterData: {
        evento: 'ASSINATURA',
        assinaturaId: a.id,
        versaoId: params.versaoId,
        externo: !!params.colaboradorId,
        colaboradorId: params.colaboradorId,
        parteId: params.parteId,
        signatarioNome: params.signatarioNome,
        signatarioEmail: params.signatarioEmail,
        metodo: params.metodo,
        hashContratoSnapshot: a.hashContratoSnapshot,
      },
      ip: params.ip,
      userAgent: params.userAgent,
    });

    await this.webhooks.enqueueEvent(params.tenantId, 'contrato.assinatura_recebida', {
      contratoId: params.contratoId,
      assinaturaId: a.id,
      versaoId: params.versaoId,
      signatarioNome: params.signatarioNome,
      hashContratoSnapshot: a.hashContratoSnapshot,
    });

    // Verifica se TODAS as partes principais já assinaram
    await this.maybeTransitionToAssinado(params.contratoId, params.tenantId);

    return a;
  }

  /**
   * Se todas as partes do contrato têm pelo menos uma assinatura,
   * transita o contrato para ASSINADO (apenas a primeira vez).
   */
  private async maybeTransitionToAssinado(contratoId: string, tenantId: string) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { partes: true, assinaturas: { where: { estado: 'ASSINADA' } } },
    });
    if (!contrato) return;
    if (contrato.estado !== ContratoEstado.PRONTO_ASSINATURA) return;

    const partesPrincipais = contrato.partes.filter(
      (p) => p.papel === 'PARTE_PRINCIPAL' || p.papel === 'CONTRAPARTE',
    );
    const partesAssinadas = new Set(
      contrato.assinaturas.map((a) => a.parteId).filter(Boolean) as string[],
    );

    const allSigned = partesPrincipais.every((p) => partesAssinadas.has(p.id));
    if (!allSigned) return;

    // BUG fix (auditoria #6): validar canTransition antes do update.
    // O early-return acima já cobre o caso normal (só PRONTO_ASSINATURA
    // → ASSINADO), mas defendemos contra mudanças futuras à state
    // machine que tornem essa transição ilegal.
    if (!canTransition(contrato.estado as ContratoEstado, ContratoEstado.ASSINADO)) {
      // Log warn-level — não falhar silenciosamente
      return;
    }

    await this.prisma.contrato.update({
      where: { id: contratoId },
      data: { estado: ContratoEstado.ASSINADO, dataAssinatura: new Date() },
    });
    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo: ContratoEventoTipo.ESTADO_ALTERADO,
        resumo: 'PRONTO_ASSINATURA → ASSINADO (todas as partes assinaram)',
        payload: { de: 'PRONTO_ASSINATURA', para: 'ASSINADO' } as object,
        actorTipo: 'SYSTEM',
      },
    });

    // H3: este é o caminho REAL de assinatura — tem de auditar e correr
    // o motor de compliance (TGIS/registos/AGT despoletados pela
    // assinatura). Antes só o transitar() manual o fazia.
    await this.audit.log({
      tenantId,
      action: AuditAction.STATE_TRANSITION,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      beforeData: { estado: ContratoEstado.PRONTO_ASSINATURA },
      afterData: { estado: ContratoEstado.ASSINADO, via: 'all-parties-signed' },
    });

    await this.webhooks.enqueueEvent(tenantId, 'contrato.assinado', {
      contratoId,
      via: 'all-parties-signed',
    });

    // H4: se este contrato é uma adenda, devolve o pai EM_ADENDA → ACTIVO
    // (o sub-ciclo fecha-se ao assinar a adenda). Sem isto o pai ficava
    // preso em EM_ADENDA para sempre.
    if (contrato.parentContratoId) {
      const pai = await this.prisma.contrato.findUnique({
        where: { id: contrato.parentContratoId },
        select: { id: true, estado: true, tenantId: true },
      });
      if (
        pai &&
        pai.estado === ContratoEstado.EM_ADENDA &&
        canTransition(ContratoEstado.EM_ADENDA, ContratoEstado.ACTIVO)
      ) {
        await this.prisma.contrato.update({
          where: { id: pai.id },
          data: { estado: ContratoEstado.ACTIVO },
        });
        await this.prisma.contratoEvento.create({
          data: {
            contratoId: pai.id,
            tipo: ContratoEventoTipo.ESTADO_ALTERADO,
            resumo: `EM_ADENDA → ACTIVO (adenda ${contrato.numeroInterno} assinada)`,
            payload: { de: ContratoEstado.EM_ADENDA, para: ContratoEstado.ACTIVO } as object,
            actorTipo: 'SYSTEM',
          },
        });
        await this.audit.log({
          tenantId: pai.tenantId,
          action: AuditAction.STATE_TRANSITION,
          entityType: EntityType.CONTRATO,
          entityId: pai.id,
          beforeData: { estado: ContratoEstado.EM_ADENDA },
          afterData: { estado: ContratoEstado.ACTIVO },
        });
      }
    }

    // Compliance corre por último — não deve bloquear a transição.
    await this.compliance.avaliarContrato(contratoId, tenantId);
  }
}
