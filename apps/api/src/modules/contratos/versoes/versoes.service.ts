import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ContratoEventoTipo,
  VersaoDireccao,
} from '@kamaia/shared-types';
import { renderMarkdownToHtml } from '../../../common/markdown';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoVersoesService {
  constructor(private readonly prisma: PrismaService) {}

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
   * NÃO permitido se a versão já foi assinada por qualquer parte.
   * Caso contrário (drafting normal), o markdown e o HTML render
   * actualizam-se atómicamente.
   */
  async editarCorpo(
    tenantId: string,
    contratoId: string,
    versaoId: string,
    dto: { corpoMarkdown: string; geradoPorIA?: boolean },
  ) {
    await this.assertContrato(tenantId, contratoId);
    const v = await this.prisma.contratoVersao.findFirst({
      where: { id: versaoId, contratoId },
      include: { assinaturas: { where: { estado: 'ASSINADA' }, take: 1 } },
    });
    if (!v) throw new NotFoundException('Versão not found');
    if (v.assinaturas.length > 0) {
      throw new BadRequestException(
        'Versão já assinada — não pode ser editada. Cria nova versão.',
      );
    }
    return this.prisma.contratoVersao.update({
      where: { id: versaoId },
      data: {
        corpoMarkdown: dto.corpoMarkdown,
        corpoHtml: renderMarkdownToHtml(dto.corpoMarkdown),
        geradoPorIA: dto.geradoPorIA ?? v.geradoPorIA,
      },
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
