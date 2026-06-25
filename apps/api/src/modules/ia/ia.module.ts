import { Module, OnModuleInit } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../prisma/prisma.service';
import { RagModule } from '../rag/rag.module';
import { ClaudeProvider } from './claude.provider';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { IaDraftingService } from './ia-drafting.service';
import { AgentService } from './agent/agent.service';
import { ToolRegistry } from './agent/tool-registry';
import { buildFindContratosTool } from './agent/tools/find-contratos.tool';

@Module({
  imports: [RagModule, AuditModule],
  controllers: [IaController],
  providers: [
    IaService,
    IaDraftingService,
    ClaudeProvider,
    AgentService,
    ToolRegistry,
  ],
  exports: [IaService, IaDraftingService, AgentService, ToolRegistry],
})
export class IaModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Regista todas as tools ao arrancar o módulo. Manter as
   * construções centralizadas aqui evita injecções circulares
   * (tools como funções tomam services como args, não como
   * dependências NestJS) e dá-nos um sítio único para auditar
   * que capacidades estão expostas ao LLM.
   */
  onModuleInit() {
    this.registry.register(buildFindContratosTool(this.prisma));
  }
}
