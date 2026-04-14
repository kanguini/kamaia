import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IaRepository, ListConversationsParams } from './ia.repository';
import { AuditService } from '../audit/audit.service';
import { RagService } from '../rag/rag.service';
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
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Tu es o Kamaia IA, um assistente juridico especializado em direito angolano.

REGRAS:
- Responde SEMPRE em portugues de Angola
- Quando citas legislacao, inclui a referencia completa (diploma, artigo, numero)
- Se nao tens certeza, diz claramente que e uma orientacao geral e recomenda consulta com advogado
- Nunca inventes artigos ou leis que nao existas — se nao sabes, diz "nao tenho informacao precisa sobre este artigo"
- Sê conciso mas completo
- Formata com markdown (bold, listas numeradas, italico)
- No final, adiciona sempre: "_Aviso: Esta orientacao e informativa e nao substitui aconselhamento juridico formal._"

LEGISLACAO ANGOLANA QUE CONHECES:
- Constituicao da Republica de Angola (2010)
- Codigo Civil (Decreto n.o 47 344)
- Codigo de Processo Civil angolano
- Lei Geral do Trabalho (Lei n.o 7/15)
- Lei das Sociedades Comerciais (Lei n.o 1/04)
- Codigo Penal angolano
- Codigo de Processo Penal
- Lei do Notariado e Registo
- Lei das Execucoes Fiscais
- Legislacao da ARSEG (seguros)
- Lei do Arrendamento Urbano
- Estatuto da Ordem dos Advogados de Angola

PRAZOS PROCESSUAIS COMUNS:
- Contestacao em accao ordinaria civel: 20 dias uteis (Art. 486.o CPC)
- Recurso de sentenca civel: 30 dias (Art. 685.o CPC)
- Accao de reintegracao laboral: 90 dias (Art. 198.o LGT)
- Recurso de decisao arbitral: 30 dias (Lei de Arbitragem)`;

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly isGeminiEnabled: boolean;

  constructor(
    private iaRepository: IaRepository,
    private auditService: AuditService,
    private configService: ConfigService,
    private ragService: RagService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.isGeminiEnabled = !!apiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Gemini AI enabled (gemini-2.0-flash)');
    } else {
      this.logger.warn('Gemini AI not configured — using mock responses');
    }
  }

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

      // 4. Generate AI response (Gemini or mock fallback)
      const previousMessages = conversation.messages || [];
      const assistantContent = await this.generateResponse(content, previousMessages);

      // 5. Create assistant message
      const assistantMessage = await this.iaRepository.createMessage(
        conversationId,
        {
          role: 'assistant',
          content: assistantContent,
          tokenCount: Math.ceil(assistantContent.length / 4),
          model: this.isGeminiEnabled ? 'gemini-2.0-flash' : 'mock-v1',
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

  private async generateResponse(
    userContent: string,
    previousMessages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    // Try Gemini first
    if (this.isGeminiEnabled && this.genAI) {
      try {
        // RAG: retrieve relevant legislation context
        let enrichedPrompt = SYSTEM_PROMPT;
        try {
          const ragResult = await this.ragService.retrieveContext(userContent, 5);
          if (ragResult.success && ragResult.data.length > 0) {
            const ragContext = this.ragService.formatContextForPrompt(ragResult.data);
            enrichedPrompt = SYSTEM_PROMPT + ragContext;
            this.logger.debug(
              `RAG injected ${ragResult.data.length} chunks into prompt`,
            );
          }
        } catch (ragError) {
          this.logger.warn(`RAG retrieval skipped: ${(ragError as Error).message}`);
          // Continue without RAG — graceful degradation
        }

        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-lite',
          systemInstruction: enrichedPrompt,
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.3,
          },
        });

        // Build chat history from previous messages
        const history = previousMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
          parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history });

        const result = await chat.sendMessage(userContent);
        const response = result.response.text();

        if (response && response.length > 0) {
          return response;
        }
      } catch (error) {
        this.logger.error(`Gemini API error: ${(error as Error).message}`);
        // Fall through to mock
      }
    }

    // Fallback mock response
    return (
      `Obrigado pela sua questao sobre direito angolano.\n\n` +
      `Para uma resposta precisa, recomendo consultar a legislacao relevante ou contactar um advogado especializado.\n\n` +
      `_Nota: O assistente IA esta em modo de demonstracao. Configure a GEMINI_API_KEY para activar respostas reais._`
    );
  }
}
