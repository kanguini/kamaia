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
    opts: {
      versaoId?: string;
      clausulaRef?: string;
      includeResolved?: boolean;
      /**
       * Defense in depth: caller deve passar quando a chamada vem de
       * via autenticada. Quando vem da rota pública /c/:token a
       * resolução do token já garante o scoping, por isso é opcional.
       */
      tenantId?: string;
    } = {},
  ) {
    return this.prisma.contratoComentario.findMany({
      where: {
        contratoId,
        ...(opts.tenantId && { contrato: { tenantId: opts.tenantId, deletedAt: null } }),
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
    // AUDIT.9: defense in depth — service valida que o contratoId
    // pertence ao tenant antes de criar. Sem isto, um caller mal
    // intencionado (ou bug futuro) podia injectar contratoId de
    // outro tenant e o comentário ficava "órfão" naquele contrato.
    const c = await this.prisma.contrato.findFirst({
      where: { id: params.contratoId, tenantId: params.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');

    // FK guard: versaoId / parentComentarioId têm de pertencer a ESTE
    // contrato — impede referência cruzada (ex.: thread sob comentário
    // de outro contrato/tenant).
    if (params.versaoId) {
      const v = await this.prisma.contratoVersao.findFirst({
        where: { id: params.versaoId, contratoId: params.contratoId },
        select: { id: true },
      });
      if (!v) throw new NotFoundException('Versão não pertence a este contrato');
    }
    if (params.parentComentarioId) {
      const pai = await this.prisma.contratoComentario.findFirst({
        where: { id: params.parentComentarioId, contratoId: params.contratoId },
        select: { id: true },
      });
      if (!pai) {
        throw new NotFoundException('Comentário pai não pertence a este contrato');
      }
    }

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
