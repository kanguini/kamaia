import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  AssinaturaEstado,
  AssinaturaMetodo,
  ContratoEstado,
  ContratoEventoTipo,
} from '@kamaia/shared-types';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Injectable()
export class ContratoAssinaturasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(contratoId: string) {
    return this.prisma.contratoAssinatura.findMany({
      where: { contratoId },
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

  async get(id: string) {
    const a = await this.prisma.contratoAssinatura.findUnique({
      where: { id },
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
    const versao = await this.prisma.contratoVersao.findUnique({
      where: { id: params.versaoId },
    });
    if (!versao || versao.contratoId !== params.contratoId) {
      throw new NotFoundException('Versão não pertence ao contrato');
    }
    if (!versao.corpoMarkdown) {
      throw new BadRequestException(
        'Versão não tem conteúdo editável — assinar implica snapshot do corpo.',
      );
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
    await this.webhooks.enqueueEvent(tenantId, 'contrato.assinado', {
      contratoId,
      via: 'all-parties-signed',
    });
  }
}
