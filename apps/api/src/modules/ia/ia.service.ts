import { Injectable } from '@nestjs/common';
import { IaRepository, ListConversationsParams } from './ia.repository';
import { AuditService } from '../audit/audit.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  PLAN_LIMITS,
  SubscriptionPlan,
} from '@kamaia/shared-types';
import { CreateConversationDto } from './ia.dto';

@Injectable()
export class IaService {
  constructor(
    private iaRepository: IaRepository,
    private auditService: AuditService,
  ) {}

  async findConversations(
    gabineteId: string,
    userId: string,
    params: ListConversationsParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.iaRepository.findConversations(
        gabineteId,
        userId,
        params.cursor,
        params.limit,
      );
      return ok(result);
    } catch (error) {
      return err('Failed to fetch conversations', 'CONVERSATIONS_FETCH_FAILED');
    }
  }

  async findConversation(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<any>> {
    try {
      const conversation = await this.iaRepository.findConversation(
        gabineteId,
        userId,
        id,
      );

      if (!conversation) {
        return err('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      return ok(conversation);
    } catch (error) {
      return err('Failed to fetch conversation', 'CONVERSATION_FETCH_FAILED');
    }
  }

  async createConversation(
    gabineteId: string,
    userId: string,
    dto: CreateConversationDto,
  ): Promise<Result<any>> {
    try {
      const conversation = await this.iaRepository.createConversation({
        gabineteId,
        userId,
        title: dto.title,
        context: dto.context,
        contextId: dto.contextId,
      });

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.AI_CONVERSATION,
        entityId: conversation.id,
        userId,
        gabineteId,
        newValue: {
          title: conversation.title,
          context: conversation.context,
        },
      });

      return ok(conversation);
    } catch (error) {
      return err('Failed to create conversation', 'CONVERSATION_CREATE_FAILED');
    }
  }

  async deleteConversation(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.iaRepository.findConversation(
        gabineteId,
        userId,
        id,
      );
      if (!existing) {
        return err('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      await this.iaRepository.softDeleteConversation(gabineteId, userId, id);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.AI_CONVERSATION,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete conversation', 'CONVERSATION_DELETE_FAILED');
    }
  }

  async sendMessage(
    gabineteId: string,
    userId: string,
    conversationId: string,
    content: string,
  ): Promise<Result<{ userMessage: any; assistantMessage: any }>> {
    try {
      // 1. Verify conversation exists and belongs to user
      const conversation = await this.iaRepository.findConversation(
        gabineteId,
        userId,
        conversationId,
      );

      if (!conversation) {
        return err('Conversation not found', 'CONVERSATION_NOT_FOUND');
      }

      // 2. Check quota
      const usageQuota = await this.iaRepository.getUsageQuota(gabineteId);
      if (!usageQuota) {
        return err('Usage quota not found', 'QUOTA_NOT_FOUND');
      }

      const plan = usageQuota.gabinete.plan as SubscriptionPlan;
      const planLimit = PLAN_LIMITS[plan].aiQueries;
      const usedQueries = usageQuota.aiQueriesUsed;

      if (planLimit !== -1 && usedQueries >= planLimit) {
        return err(
          'Limite de consultas IA atingido. Faca upgrade para Pro para continuar.',
          'QUOTA_EXCEEDED',
        );
      }

      // 3. Create user message
      const userMessage = await this.iaRepository.createMessage(conversationId, {
        role: 'user',
        content,
        tokenCount: Math.ceil(content.length / 4),
      });

      // 4. Generate mock response
      const assistantContent = this.generateMockResponse(content, conversation);

      // 5. Create assistant message
      const assistantMessage = await this.iaRepository.createMessage(
        conversationId,
        {
          role: 'assistant',
          content: assistantContent,
          tokenCount: Math.ceil(assistantContent.length / 4),
          model: 'mock-v1',
        },
      );

      // 6. Auto-title if conversation has no title
      if (!conversation.title) {
        const autoTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await this.iaRepository.updateConversationTitle(
          conversationId,
          autoTitle,
        );
      }

      // 7. Increment aiQueriesUsed
      await this.iaRepository.incrementAiQueries(gabineteId);

      // 8. Audit log
      await this.auditService.log({
        action: AuditAction.AI_QUERY,
        entity: EntityType.AI_CONVERSATION,
        entityId: conversationId,
        userId,
        gabineteId,
        newValue: {
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
      });

      // 9. Return both messages
      return ok({ userMessage, assistantMessage });
    } catch (error) {
      return err('Failed to send message', 'MESSAGE_SEND_FAILED');
    }
  }

  async getQuota(
    gabineteId: string,
  ): Promise<Result<{ used: number; limit: number; remaining: number }>> {
    try {
      const usageQuota = await this.iaRepository.getUsageQuota(gabineteId);
      if (!usageQuota) {
        return err('Usage quota not found', 'QUOTA_NOT_FOUND');
      }

      const plan = usageQuota.gabinete.plan as SubscriptionPlan;
      const planLimit = PLAN_LIMITS[plan].aiQueries;
      const used = usageQuota.aiQueriesUsed;

      const remaining = planLimit === -1 ? -1 : Math.max(0, planLimit - used);

      return ok({
        used,
        limit: planLimit,
        remaining,
      });
    } catch (error) {
      return err('Failed to get quota', 'QUOTA_FETCH_FAILED');
    }
  }

  private generateMockResponse(content: string, _conversation: unknown): string {
    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes('prazo') ||
      lowerContent.includes('contestar') ||
      lowerContent.includes('recurso')
    ) {
      return (
        `Com base na legislacao angolana, posso indicar os seguintes prazos processuais relevantes:\n\n` +
        `1. **Contestacao em accao ordinaria civel** — 20 dias uteis a contar da citacao (Art. 486.o CPC)\n` +
        `2. **Recurso de sentenca civel** — 30 dias a contar da notificacao (Art. 685.o CPC)\n` +
        `3. **Accao de reintegracao laboral** — 90 dias apos despedimento (Art. 198.o LGT)\n\n` +
        `Para um calculo preciso, recomendo indicar a data do evento processual em causa.\n\n` +
        `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
      );
    }

    if (
      lowerContent.includes('despedimento') ||
      lowerContent.includes('trabalho') ||
      lowerContent.includes('laboral')
    ) {
      return (
        `De acordo com a Lei Geral do Trabalho (Lei n.o 7/15), o despedimento deve cumprir requisitos formais rigorosos:\n\n` +
        `1. **Processo disciplinar previo** — obrigatorio para despedimento com justa causa\n` +
        `2. **Comunicacao escrita** — fundamentacao detalhada dos motivos\n` +
        `3. **Direito de defesa** — o trabalhador deve ser ouvido antes da decisao\n` +
        `4. **Indemnizacao** — se o despedimento for declarado ilicito, o trabalhador tem direito a reintegracao ou indemnizacao\n\n` +
        `O prazo para impugnar o despedimento e de 90 dias (Art. 198.o LGT).\n\n` +
        `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
      );
    }

    if (
      lowerContent.includes('contrato') ||
      lowerContent.includes('clausula') ||
      lowerContent.includes('acordo')
    ) {
      return (
        `Na analise de contratos ao abrigo do direito angolano, e importante considerar:\n\n` +
        `1. **Capacidade das partes** — Art. 67.o e seguintes do Codigo Civil\n` +
        `2. **Objecto licito e determinado** — requisito de validade essencial\n` +
        `3. **Forma legal** — alguns contratos exigem escritura publica ou documento autenticado\n` +
        `4. **Clausulas abusivas** — verificacao de equilibrio contratual\n\n` +
        `Recomendo a analise detalhada do contrato especifico para identificar eventuais riscos.\n\n` +
        `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
      );
    }

    if (
      lowerContent.includes('artigo') ||
      lowerContent.includes('lei') ||
      lowerContent.includes('codigo') ||
      lowerContent.includes('legislacao')
    ) {
      return (
        `A legislacao angolana relevante para esta questao inclui:\n\n` +
        `- **Constituicao da Republica de Angola** (2010) — direitos fundamentais\n` +
        `- **Codigo Civil** (Decreto n.o 47 344, actualizado) — obrigacoes e contratos\n` +
        `- **Codigo de Processo Civil** — procedimentos judiciais civeis\n` +
        `- **Lei Geral do Trabalho** (Lei n.o 7/15) — relacoes laborais\n` +
        `- **Lei das Sociedades Comerciais** (Lei n.o 1/04) — direito societario\n\n` +
        `Para uma resposta mais precisa, por favor indique o diploma ou artigo especifico que pretende consultar.\n\n` +
        `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
      );
    }

    if (
      lowerContent.includes('sociedade') ||
      lowerContent.includes('empresa') ||
      lowerContent.includes('comercial')
    ) {
      return (
        `No ambito do direito comercial angolano, a Lei das Sociedades Comerciais (Lei n.o 1/04) regula:\n\n` +
        `1. **Tipos societarios** — SQ (Sociedade por Quotas), SA (Sociedade Anonima), SNC, etc.\n` +
        `2. **Constituicao** — requisitos de escritura publica e registo comercial\n` +
        `3. **Capital social** — minimo legal conforme tipo de sociedade\n` +
        `4. **Orgaos sociais** — gerencia (SQ) ou administracao (SA)\n\n` +
        `Indique o tipo de sociedade e a questao especifica para uma orientacao mais detalhada.\n\n` +
        `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
      );
    }

    // Default response
    return (
      `Obrigado pela sua questao. Com base no enquadramento juridico angolano, posso indicar que:\n\n` +
      `Esta materia e regulada por legislacao especifica que deve ser analisada em detalhe, considerando:\n\n` +
      `- O contexto factual concreto do caso\n` +
      `- A jurisdicao e tribunal competente\n` +
      `- Os prazos processuais aplicaveis\n` +
      `- A jurisprudencia relevante dos tribunais angolanos\n\n` +
      `Recomendo formular a questao com mais detalhe para que eu possa fornecer uma orientacao mais precisa.\n\n` +
      `_Nota: Esta e uma resposta simulada. A integracao com IA real sera activada em breve._`
    );
  }
}
