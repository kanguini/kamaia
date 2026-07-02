import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { z } from 'zod';
import { Role, TenantContext } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { DocumentsService } from '../documents/documents.service';
import {
  CreateLegislationDto,
  CreateLegislationSchema,
  ListLegislationQuery,
  ListLegislationQuerySchema,
  UpdateLegislationDto,
  UpdateLegislationSchema,
} from '../rag/rag.dto';
import { RagService } from '../rag/rag.service';
import { chunkConteudo } from './lex-ao.parse';
import { LexAoImportService } from './lex-ao-import.service';

const ImportarSchema = z.object({
  mode: z.enum(['full', 'incremental', 'reguladores']).default('incremental'),
  orgaoFilter: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

const ImportarPdfSchema = z.object({
  documentId: z.string().uuid(),
  titulo: z.string().min(2).max(300),
  diploma: z.string().min(2).max(200),
  orgao: z.string().max(200).optional(),
  ano: z.coerce.number().int().min(1900).max(2200).optional(),
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
    private readonly documents: DocumentsService,
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
  // ESCRITA no corpus GLOBAL (auditoria C7): Role de tenant não chega —
  // o acervo é partilhado por todos os tenants e um ADMIN self-service
  // podia envenenar a "lei" citada aos outros. PlatformAdminGuard
  // restringe aos curadores (PLATFORM_ADMIN_EMAILS, fail-closed).
  @Post()
  @UseGuards(PlatformAdminGuard)
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
   * Importar um diploma a partir de um PDF já carregado (via POST
   * /documents). Extrai o texto (pdf-parse), cria o diploma e indexa-o
   * (chunks + embeddings) para o Dr. Kamaia citar. Fonte autêntica → sem
   * invenção. ADMIN/LEGAL_LEAD.
   */
  @Post('importar-pdf')
  @UseGuards(PlatformAdminGuard)
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async importarPdf(
    @Tenant() tenant: TenantContext,
    @Body(new ParseZodPipe(ImportarPdfSchema))
    dto: z.infer<typeof ImportarPdfSchema>,
  ) {
    const { buffer, mimeType } = await this.documents.getBytes(
      tenant.tenantId,
      dto.documentId,
    );
    if (!mimeType.toLowerCase().includes('pdf')) {
      throw new BadRequestException('O documento carregado não é um PDF.');
    }
    let conteudo = '';
    try {
      const parsed = await pdfParse(buffer);
      conteudo = (parsed.text ?? '').replace(/\r/g, '').trim();
    } catch (e) {
      throw new BadRequestException(
        `Não foi possível ler o PDF: ${(e as Error).message}`,
      );
    }
    if (conteudo.length < 50) {
      throw new BadRequestException(
        'Não consegui extrair texto do PDF (pode ser digitalizado/imagem). Nesse caso, cole o texto manualmente.',
      );
    }
    const doc = await this.rag.create({
      titulo: dto.titulo,
      diploma: dto.diploma,
      orgao: dto.orgao,
      ano: dto.ano,
      fonte: 'CURADO',
      conteudo,
    });
    const trechos = chunkConteudo(conteudo);
    await this.rag.replaceChunks(
      doc.id,
      trechos.map((trecho, i) => ({ trecho, ordem: i })),
    );
    return { id: doc.id, caracteres: conteudo.length, chunks: trechos.length };
  }

  /**
   * Transcrever / editar um diploma (texto integral + metadados). Quando o
   * `conteudo` muda, os chunks são re-indexados para o Dr. Kamaia citar a
   * nova transcrição. ADMIN/LEGAL_LEAD.
   */
  @Patch(':id')
  @UseGuards(PlatformAdminGuard)
  @Roles(Role.ADMIN, Role.LEGAL_LEAD)
  async editar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(UpdateLegislationSchema)) dto: UpdateLegislationDto,
  ) {
    await this.rag.update(id, dto);
    if (dto.conteudo !== undefined) {
      const trechos = dto.conteudo ? chunkConteudo(dto.conteudo) : [];
      await this.rag.replaceChunks(
        id,
        trechos.map((trecho, i) => ({ trecho, ordem: i })),
      );
    }
    return this.rag.get(id);
  }

  /**
   * Força o crawl da fonte (full ou incremental). Rede de segurança para
   * o caso de a ingestão automática não ter corrido. Só ADMIN.
   */
  @Post('importar')
  @UseGuards(PlatformAdminGuard)
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
