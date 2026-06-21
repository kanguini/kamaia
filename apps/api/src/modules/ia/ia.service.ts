import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AIMessageRole, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateConversationDto,
  ListConversationsQuery,
  SendMessageDto,
} from './ia.dto';

const STUB_DISCLAIMER =
  'Esta resposta é um placeholder. O conector ao Claude (Anthropic) ainda ' +
  'não está configurado — defina `ANTHROPIC_API_KEY` para activar respostas ' +
  'reais com citações à legislação angolana.';

@Injectable()
export class IaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createConversation(
    tenantId: string,
    userId: string,
    dto: CreateConversationDto,
  ) {
    const conv = await this.prisma.aIConversation.create({
      data: {
        tenantId,
        userId,
        titulo: dto.titulo,
        contexto: dto.contexto as object | undefined,
      },
    });
    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.CREATE,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conv.id,
    });
    return conv;
  }

  async list(tenantId: string, userId: string, q: ListConversationsQuery) {
    const where: Prisma.AIConversationWhereInput = {
      tenantId,
      userId,
    };
    const rows = await this.prisma.aIConversation.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: { updatedAt: 'desc' },
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, userId: string, id: string) {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id, tenantId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async sendMessage(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conv = await this.prisma.aIConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const userMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.USER,
        conteudo: dto.conteudo,
      },
    });

    // ────────────────────────────────────────────────────────────────
    // STUB. Ponto de integração com Claude:
    //
    //   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    //   const citados = await ragService.search(dto.conteudo, { topK: 8 });
    //   const seedContext = buildLegislationContext(citados);
    //   const reply = await anthropic.messages.create({
    //     model: 'claude-opus-4-7',
    //     system: SYSTEM_PROMPT_LEGISLACAO_AO,
    //     messages: [...history, { role: 'user', content: dto.conteudo }],
    //   });
    //
    // Por agora respondemos com um placeholder determinístico e
    // disclaimer visível para o utilizador final.
    // ────────────────────────────────────────────────────────────────
    const respostaConteudo =
      `Recebi a tua pergunta: "${dto.conteudo.slice(0, 200)}".\n\n` +
      `${STUB_DISCLAIMER}`;

    const assistantMsg = await this.prisma.aIMessage.create({
      data: {
        conversationId,
        role: AIMessageRole.ASSISTANT,
        conteudo: respostaConteudo,
        modelo: 'stub-placeholder',
        tokensInput: 0,
        tokensOutput: 0,
      },
    });

    await this.prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      actorUserId: userId,
      action: AuditAction.IA_QUERY,
      entityType: EntityType.AI_CONVERSATION,
      entityId: conversationId,
    });

    return { user: userMsg, assistant: assistantMsg };
  }
}
