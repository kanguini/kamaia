import { Module, OnModuleInit } from '@nestjs/common';
import { CONTRATOS_HERANCA_FIRST } from '@kamaia/shared-types';
import { AuditModule } from '../audit/audit.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { ComplianceService } from '../compliance/compliance.service';
import { ContratosModule } from '../contratos/contratos.module';
import { ContratosService } from '../contratos/contratos.service';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { DocumentsModule } from '../documents/documents.module';
import { EntidadesModule } from '../entidades/entidades.module';
import { EntidadesService } from '../entidades/entidades.service';
import { PrismaService } from '../prisma/prisma.service';
import { RagModule } from '../rag/rag.module';
import { RagService } from '../rag/rag.service';
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
import { buildFindOrCreateEntidadeTool } from './agent/tools/find-or-create-entidade.tool';
import { buildCreateContratoTool } from './agent/tools/create-contrato.tool';
import { buildConsultarLegislacaoTool } from './agent/tools/consultar-legislacao.tool';

@Module({
  imports: [
    RagModule,
    AuditModule,
    ContratosModule,
    EntidadesModule,
    ComplianceModule,
    CustomFieldsModule,
    DocumentsModule,
  ],
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
    private readonly contratosService: ContratosService,
    private readonly entidadesService: EntidadesService,
    private readonly complianceService: ComplianceService,
    private readonly customFieldsService: CustomFieldsService,
    private readonly ragService: RagService,
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

    // Consulta jurídica — fundamenta as respostas na legislação angolana
    // carregada (base do Dr. Kamaia como agente de consulta).
    this.registry.register(buildConsultarLegislacaoTool(this.ragService));

    // Tools de mutação (Sprint 1.4). find-or-create-entidade mantém-se
    // (útil para registar as partes de um contrato herdado).
    this.registry.register(
      buildFindOrCreateEntidadeTool(this.prisma, this.entidadesService),
    );
    // Criar contrato de raiz fica DESLIGADO em herança-first — a IA não
    // redige/cria contratos novos nesta fase (só ajuda a gerir/consultar).
    if (!CONTRATOS_HERANCA_FIRST) {
      this.registry.register(
        buildCreateContratoTool(
          this.prisma,
          this.contratosService,
          this.complianceService,
          this.customFieldsService,
        ),
      );
    }
  }
}
