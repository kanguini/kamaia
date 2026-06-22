import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ComentarioAutorTipo,
  ContratoEventoTipo,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

@Injectable()
export class ContratoComentariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(
    contratoId: string,
    opts: { versaoId?: string; clausulaRef?: string; includeResolved?: boolean } = {},
  ) {
    return this.prisma.contratoComentario.findMany({
      where: {
        contratoId,
        ...(opts.versaoId && { versaoId: opts.versaoId }),
        ...(opts.clausulaRef && { clausulaRef: opts.clausulaRef }),
        ...(!opts.includeResolved && { resolvido: false }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Criar comentário. O caller decide o `autorTipo` consoante a origem
   * (user autenticado vs colaborador externo via token).
   */
  async create(params: {
    contratoId: string;
    tenantId: string;
    versaoId?: string;
    clausulaRef: string;
    parentComentarioId?: string;
    autorTipo: ComentarioAutorTipo;
    autorUserId?: string;
    autorColaboradorId?: string;
    autorNome: string;
    texto: string;
  }) {
    const com = await this.prisma.contratoComentario.create({
      data: {
        contratoId: params.contratoId,
        versaoId: params.versaoId,
        clausulaRef: params.clausulaRef,
        parentComentarioId: params.parentComentarioId,
        autorTipo: params.autorTipo,
        autorUserId: params.autorUserId,
        autorColaboradorId: params.autorColaboradorId,
        autorNome: params.autorNome,
        texto: params.texto,
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId: params.contratoId,
        tipo: ContratoEventoTipo.COMENTARIO,
        resumo: `${params.autorNome}: ${params.texto.slice(0, 120)}`,
        payload: {
          comentarioId: com.id,
          clausulaRef: params.clausulaRef,
          autorTipo: params.autorTipo,
        } as object,
        actorUserId: params.autorUserId,
        actorTipo: params.autorTipo === 'COLABORADOR' ? 'EXTERNAL' : 'USER',
      },
    });

    await this.webhooks.enqueueEvent(params.tenantId, 'contrato.comentario_adicionado', {
      contratoId: params.contratoId,
      comentarioId: com.id,
      clausulaRef: params.clausulaRef,
      autorTipo: params.autorTipo,
      autorNome: params.autorNome,
    });

    return com;
  }

  async resolver(
    contratoId: string,
    comentarioId: string,
    actorUserId: string,
  ) {
    const com = await this.prisma.contratoComentario.findFirst({
      where: { id: comentarioId, contratoId },
    });
    if (!com) throw new NotFoundException('Comentário not found');
    return this.prisma.contratoComentario.update({
      where: { id: comentarioId },
      data: {
        resolvido: true,
        resolvidoEm: new Date(),
        resolvidoPor: actorUserId,
      },
    });
  }
}
