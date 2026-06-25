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
import { buildFindEntidadesTool } from './agent/tools/find-entidades.tool';
import { buildOpenContratoTool } from './agent/tools/open-contrato.tool';
import { buildListDatasChaveTool } from './agent/tools/list-datas-chave.tool';
import { buildListObrigacoesTool } from './agent/tools/list-obrigacoes.tool';

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
    // Tools de leitura (Sprint 1.2 + 1.3)
    this.registry.register(buildFindContratosTool(this.prisma));
    this.registry.register(buildFindEntidadesTool(this.prisma));
    this.registry.register(buildOpenContratoTool(this.prisma));
    this.registry.register(buildListDatasChaveTool(this.prisma));
    this.registry.register(buildListObrigacoesTool(this.prisma));
  }
}
