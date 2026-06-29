import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Role } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  CreateLegislationDto,
  CreateLegislationSchema,
  ListLegislationQuery,
  ListLegislationQuerySchema,
} from '../rag/rag.dto';
import { RagService } from '../rag/rag.service';
import { chunkConteudo } from './lex-ao.parse';
import { LexAoImportService } from './lex-ao-import.service';

const ImportarSchema = z.object({
  mode: z.enum(['full', 'incremental']).default('incremental'),
  orgaoFilter: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

/**
 * Vista navegável da legislação (Biblioteca → Legislação). Lê de
 * LegislationDocument (curada + importada do lex.ao) reutilizando o
 * RagService. O trigger de import é a rede de segurança para forçar/
 * refrescar o crawl quando necessário.
 */
@Controller('legislacao')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LegislacaoController {
  constructor(
    private readonly rag: RagService,
    private readonly lexAo: LexAoImportService,
  ) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async list(
    @Query(new ParseZodPipe(ListLegislationQuerySchema)) q: ListLegislationQuery,
  ) {
    return this.rag.list(q);
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.rag.get(id);
  }

  /**
   * Adicionar um diploma manualmente (ex. de um regulador que o lex.ao não
   * cobre). Fiável e sem scraping. Se houver texto, fragmenta-o para o
   * Dr. Kamaia poder citar. ADMIN/LEGAL_LEAD.
   */
  @Post()
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async criar(
    @Body(new ParseZodPipe(CreateLegislationSchema)) dto: CreateLegislationDto,
  ) {
    let doc: { id: string };
    try {
      doc = await this.rag.create(dto);
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Já existe um diploma com esse código ou link.',
        );
      }
      throw e;
    }
    if (dto.conteudo && dto.conteudo.trim().length > 0) {
      const trechos = chunkConteudo(dto.conteudo);
      if (trechos.length > 0) {
        await this.rag
          .addChunks(doc.id, {
            chunks: trechos.map((trecho, i) => ({ trecho, ordem: i })),
          })
          .catch(() => undefined);
      }
    }
    return doc;
  }

  /**
   * Força o crawl do lex.ao (full ou incremental). Rede de segurança
   * para o caso de a ingestão automática não ter corrido. Só ADMIN.
   */
  @Post('importar')
  @Roles(Role.ADMIN)
  async importar(
    @Query(new ParseZodPipe(ImportarSchema)) q: z.infer<typeof ImportarSchema>,
  ) {
    // Funciona com Redis (fila BullMQ) ou sem (corre em background no
    // próprio processo da API).
    const r = await this.lexAo.dispararImport(
      { mode: q.mode, orgaoFilter: q.orgaoFilter, limit: q.limit },
      'manual',
    );
    return { ok: r.estado !== 'ja-a-correr', ...r };
  }
}
