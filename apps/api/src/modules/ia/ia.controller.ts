import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { JwtPayload, Role, TenantContext } from '@kamaia/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  CreateConversationDto,
  CreateConversationSchema,
  ListConversationsQuery,
  ListConversationsQuerySchema,
  SendMessageDto,
  SendMessageSchema,
} from './ia.dto';
import { IaService } from './ia.service';
import { IaDraftingService } from './ia-drafting.service';

const DraftContratoSchema = z.object({
  contratoId: z.string().uuid(),
  versaoId: z.string().uuid().optional(),
  prompt: z.string().max(4000).optional(),
  novaVersao: z.boolean().optional(),
});

/**
 * Schema do payload do endpoint agêntico. Extends do envio normal
 * de mensagem com `pageContext` opcional para enriquecer o system
 * prompt com a página onde o utilizador está.
 */
const AgentStreamPayloadSchema = z.object({
  conteudo: z.string().min(1).max(4000),
  pageContext: z
    .object({
      type: z.string(),
    })
    .passthrough()
    .optional(),
});
type AgentStreamPayload = z.infer<typeof AgentStreamPayloadSchema>;

@Controller('ia')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class IaController {
  constructor(
    private readonly ia: IaService,
    private readonly drafting: IaDraftingService,
  ) {}

  /**
   * Drafting do corpo de um contrato com Claude. Persiste como nova
   * versão DRAFT_INTERNO marcada `geradoPorIA=true`, ou actualiza a
   * versão fornecida (se não estiver assinada). Apenas LEGAL_LEAD e
   * CONTRACT_MANAGER (e ADMIN) — exclui BUSINESS_USER porque o draft
   * pode contaminar uma versão activa.
   */
  @Post('draft-contrato')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER)
  async draftContrato(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(DraftContratoSchema))
    dto: z.infer<typeof DraftContratoSchema>,
  ) {
    return this.drafting.draftContrato(tenant.tenantId, user.sub, dto);
  }

  @Get('conversations')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async list(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(ListConversationsQuerySchema)) q: ListConversationsQuery,
  ) {
    return this.ia.list(tenant.tenantId, user.sub, q);
  }

  @Get('conversations/:id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async get(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.ia.get(tenant.tenantId, user.sub, id);
  }

  @Post('conversations')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(CreateConversationSchema)) dto: CreateConversationDto,
  ) {
    return this.ia.createConversation(tenant.tenantId, user.sub, dto);
  }

  @Post('conversations/:id/messages')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async send(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(SendMessageSchema)) dto: SendMessageDto,
  ) {
    return this.ia.sendMessage(tenant.tenantId, user.sub, id, dto);
  }

  /**
   * Variante streaming via Server-Sent Events.
   *
   * Cliente: usar EventSource ou fetch() + ReadableStream + parser SSE.
   * Formato: `event: <kind>\ndata: <JSON>\n\n` por chunk.
   *
   * Kinds emitidos:
   *  - user-msg: id da mensagem do utilizador
   *  - citations: array de chunks de legislação (apenas se RAG resolve)
   *  - text: { delta: "..." } chunk de texto (vários)
   *  - done: { assistantMessageId, modelo, tokensInput, tokensOutput }
   *  - error: { message }
   *
   * Reduz latência percebida de 5-10s para tempo-real letra-a-letra.
   */
  @Post('conversations/:id/messages/stream')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER)
  async stream(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(SendMessageSchema)) dto: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx/Vercel: desliga buffering
    res.flushHeaders();

    const write = (kind: string, data: unknown) => {
      res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const ev of this.ia.sendMessageStream(
        tenant.tenantId,
        user.sub,
        id,
        dto,
      )) {
        const { kind, ...rest } = ev;
        write(kind, rest);
        if (kind === 'done' || kind === 'error') break;
      }
    } catch (e) {
      write('error', {
        message: e instanceof Error ? e.message : 'Stream error',
      });
    } finally {
      res.end();
    }
  }

  /**
   * Endpoint agêntico — Claude com tools.
   *
   * Diferente do `/stream` (RAG Q&A inline):
   *  - Loop multi-turn com tools registadas no ToolRegistry
   *  - Frontend recebe `tool_use_start`, `tool_executing`, `tool_result`
   *    para renderizar acções em tempo real
   *  - pageContext é injectado no system prompt
   *
   * RBAC: aceita as mesmas roles que /stream para que o panel funcione
   * para todos os utilizadores autenticados. Cada tool aplica RBAC
   * individual interno via ToolRegistry.
   */
  @Post('conversations/:id/messages/agent-stream')
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async agentStream(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(AgentStreamPayloadSchema)) dto: AgentStreamPayload,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const write = (kind: string, data: unknown) => {
      res.write(`event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      for await (const ev of this.ia.sendMessageAgentStream(
        tenant.tenantId,
        user.sub,
        // user.role vem do JWT; o membership específico é validado
        // pelo TenantGuard antes de chegarmos aqui.
        tenant.role,
        id,
        { conteudo: dto.conteudo },
        dto.pageContext as never, // PageContext é union — passthrough Zod
      )) {
        const { kind, ...rest } = ev;
        write(kind, rest);
        if (kind === 'done' || kind === 'error') break;
      }
    } catch (e) {
      write('error', {
        message: e instanceof Error ? e.message : 'Stream error',
      });
    } finally {
      res.end();
    }
  }
}
