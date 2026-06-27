import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ContratoEventoTipo,
  EntityType,
  VersaoDireccao,
} from '@kamaia/shared-types';
import { renderMarkdownToHtml } from '../../../common/markdown';
import { diffLines, type DiffResult } from '../../../common/text-diff';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoVersoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoVersao.findMany({
      where: { contratoId },
      orderBy: { ordem: 'desc' },
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      versao: string;
      direccao: VersaoDireccao;
      documentId?: string;
      hashSHA256?: string;
      comentario?: string;
      corpoMarkdown?: string;
      geradoPorIA?: boolean;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    // FK guard: documentId tem de pertencer ao tenant (espelha o
    // padrão de documentoInicialId em ContratosService.create).
    if (dto.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) throw new NotFoundException('Documento not found');
    }

    const last = await this.prisma.contratoVersao.findFirst({
      where: { contratoId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const ordem = (last?.ordem ?? 0) + 1;

    const versao = await this.prisma.contratoVersao.create({
      data: {
        contratoId,
        ordem,
        criadoPor: actorUserId,
        versao: dto.versao,
        direccao: dto.direccao,
        documentId: dto.documentId,
        hashSHA256: dto.hashSHA256,
        comentario: dto.comentario,
        corpoMarkdown: dto.corpoMarkdown,
        // Render HTML server-side a partir do markdown
        ...(dto.corpoMarkdown && { corpoHtml: renderMarkdownToHtml(dto.corpoMarkdown) }),
        geradoPorIA: dto.geradoPorIA ?? false,
        ...(dto.direccao === VersaoDireccao.ASSINADO_FINAL && {
          seloTemporal: new Date(),
        }),
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo:
          dto.direccao === VersaoDireccao.ENVIADO_CONTRAPARTE ||
          dto.direccao === VersaoDireccao.ENVIADO_CLIENTE
            ? ContratoEventoTipo.VERSAO_ENVIADA
            : dto.direccao === VersaoDireccao.RECEBIDO_CONTRAPARTE ||
                dto.direccao === VersaoDireccao.RECEBIDO_CLIENTE
              ? ContratoEventoTipo.VERSAO_RECEBIDA
              : ContratoEventoTipo.VERSAO_CRIADA,
        resumo: `${dto.versao} (${dto.direccao})`,
        payload: { versaoId: versao.id, direccao: dto.direccao } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return versao;
  }

  /**
   * Edita o corpo (markdown) de uma versão existente.
   *
   * Bloqueado quando há assinaturas:
   *  - ASSINADA: edit dispararia hash divergente para o que foi
   *    assinado (eleva a fraude jurídica) → bloqueado sempre, exige
   *    nova versão
   *  - PENDENTE (signature request enviado mas não assinado): edit
   *    pode mudar conteúdo entre o utilizador receber o link e
   *    assinar — também bloqueado por defeito
   *
   * Caso contrário (drafting normal), o markdown + HTML actualizam
   * atomicamente. `corpoHtml` é re-renderizado server-side via o
   * renderer canónico para garantir consistência com PDF/diff.
   */
  async editarCorpo(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    versaoId: string,
    dto: { corpoMarkdown: string; geradoPorIA?: boolean },
  ) {
    await this.assertContrato(tenantId, contratoId);
    const v = await this.prisma.contratoVersao.findFirst({
      where: { id: versaoId, contratoId },
      include: {
        assinaturas: {
          where: { estado: { in: ['ASSINADA', 'PENDENTE'] } },
          select: { id: true, estado: true, signatarioNome: true },
        },
      },
    });
    if (!v) throw new NotFoundException('Versão not found');

    const assinadas = v.assinaturas.filter((a) => a.estado === 'ASSINADA');
    const pendentes = v.assinaturas.filter((a) => a.estado === 'PENDENTE');

    if (assinadas.length > 0) {
      const nomes = assinadas.map((a) => a.signatarioNome).join(', ');
      throw new BadRequestException(
        `Versão já assinada por ${nomes} — editar agora invalidaria a integridade da assinatura. Cria nova versão para alterações.`,
      );
    }
    if (pendentes.length > 0) {
      const nomes = pendentes.map((a) => a.signatarioNome).join(', ');
      throw new BadRequestException(
        `Versão tem ${pendentes.length} pedido(s) de assinatura pendente(s) (${nomes}). Revoga-os primeiro ou cria nova versão para evitar discrepância entre o que viram e o que assinariam.`,
      );
    }

    const atualizada = await this.prisma.contratoVersao.update({
      where: { id: versaoId },
      data: {
        corpoMarkdown: dto.corpoMarkdown,
        corpoHtml: renderMarkdownToHtml(dto.corpoMarkdown),
        geradoPorIA: dto.geradoPorIA ?? v.geradoPorIA,
      },
    });
    // M3: edição de corpo (mesmo de draft) deixa rasto de auditoria.
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO_VERSAO,
      entityId: versaoId,
      afterData: { contratoId, geradoPorIA: atualizada.geradoPorIA },
    });
    return atualizada;
  }

  /**
   * Diff line-by-line entre duas versões do mesmo contrato.
   * Tipicamente usado no fluxo de negociação: "v3.0-contraparte"
   * versus "v2.0-interna" para ver o que mudou na ronda anterior.
   *
   * Se `versaoAnteriorId` for omitida, escolhe automaticamente a
   * versão imediatamente anterior em ordem.
   *
   * O diff é calculado on-demand (não cacheado) — o markdown é a fonte
   * de verdade; cachar diff invalidaria com cada edição.
   */
  async diff(
    tenantId: string,
    contratoId: string,
    versaoId: string,
    versaoAnteriorId?: string,
  ): Promise<DiffResult & { versaoNova: VersaoRef; versaoAnterior: VersaoRef }> {
    await this.assertContrato(tenantId, contratoId);

    const versaoNova = await this.prisma.contratoVersao.findFirst({
      where: { id: versaoId, contratoId },
      select: { id: true, ordem: true, versao: true, corpoMarkdown: true, createdAt: true },
    });
    if (!versaoNova) throw new NotFoundException('Versão not found');
    if (versaoNova.corpoMarkdown === null) {
      throw new BadRequestException(
        'Esta versão não tem corpo editável (provavelmente é importada como PDF). Diff só funciona em versões com markdown.',
      );
    }

    let versaoAnterior;
    if (versaoAnteriorId) {
      versaoAnterior = await this.prisma.contratoVersao.findFirst({
        where: { id: versaoAnteriorId, contratoId },
        select: { id: true, ordem: true, versao: true, corpoMarkdown: true, createdAt: true },
      });
    } else {
      // Auto-pick: versão imediatamente anterior (ordem < versaoNova.ordem) com corpoMarkdown
      versaoAnterior = await this.prisma.contratoVersao.findFirst({
        where: {
          contratoId,
          ordem: { lt: versaoNova.ordem },
          corpoMarkdown: { not: null },
        },
        orderBy: { ordem: 'desc' },
        select: { id: true, ordem: true, versao: true, corpoMarkdown: true, createdAt: true },
      });
    }

    if (!versaoAnterior) {
      // Primeiro draft — diff contra string vazia (tudo é adição)
      const result = diffLines('', versaoNova.corpoMarkdown);
      return {
        ...result,
        versaoNova: stripCorpo(versaoNova),
        versaoAnterior: {
          id: '',
          ordem: 0,
          versao: '(vazio)',
          createdAt: versaoNova.createdAt,
        },
      };
    }

    const result = diffLines(
      versaoAnterior.corpoMarkdown ?? '',
      versaoNova.corpoMarkdown,
    );

    return {
      ...result,
      versaoNova: stripCorpo(versaoNova),
      versaoAnterior: stripCorpo(versaoAnterior),
    };
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}

export interface VersaoRef {
  id: string;
  ordem: number;
  versao: string;
  createdAt: Date;
}

function stripCorpo(v: { id: string; ordem: number; versao: string; createdAt: Date }): VersaoRef {
  return { id: v.id, ordem: v.ordem, versao: v.versao, createdAt: v.createdAt };
}
