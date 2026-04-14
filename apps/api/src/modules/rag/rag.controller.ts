import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import { IngestService, IngestTextInput } from './ingest.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { KamaiaRole, LegislationCategory } from '@kamaia/shared-types';

@Controller('rag')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class RagController {
  constructor(
    private ragService: RagService,
    private ingestService: IngestService,
  ) {}

  // ── List documents ─────────────────────────────────────
  @Get('documents')
  async listDocuments(@GabineteId() _gabineteId: string) {
    const result = await this.ragService.listDocuments();

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  // ── Get single document ────────────────────────────────
  @Get('documents/:id')
  async getDocument(
    @GabineteId() _gabineteId: string,
    @Param('id') id: string,
  ) {
    const result = await this.ragService.getDocument(id);

    if (!result.success) {
      const status =
        result.code === 'RAG_DOC_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: result.data };
  }

  // ── Delete document ────────────────────────────────────
  @Delete('documents/:id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async deleteDocument(
    @GabineteId() _gabineteId: string,
    @Param('id') id: string,
  ) {
    const result = await this.ragService.deleteDocument(id);

    if (!result.success) {
      const status =
        result.code === 'RAG_DOC_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: { success: true } };
  }

  // ── Semantic search (debug/test) ───────────────────────
  @Get('search')
  async search(
    @GabineteId() _gabineteId: string,
    @Query('q') query: string,
    @Query('limit') limitStr?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        { error: 'Query parameter "q" is required', code: 'MISSING_QUERY' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 5;
    const result = await this.ragService.retrieveContext(query, limit);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  // ── RAG stats ──────────────────────────────────────────
  @Get('stats')
  async getStats(@GabineteId() _gabineteId: string) {
    const result = await this.ragService.getStats();

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  // ── Ingest text ────────────────────────────────────────
  @Post('ingest/text')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async ingestText(
    @GabineteId() _gabineteId: string,
    @Body()
    body: {
      title: string;
      shortName: string;
      reference: string;
      category: LegislationCategory;
      content: string;
      sourceUrl?: string;
    },
  ) {
    if (!body.title || !body.shortName || !body.reference || !body.content) {
      throw new HttpException(
        {
          error: 'Missing required fields: title, shortName, reference, content',
          code: 'VALIDATION_ERROR',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.ingestService.ingestText(body as IngestTextInput);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  // ── Ingest PDF ─────────────────────────────────────────
  @Post('ingest/pdf')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async ingestPDF(
    @GabineteId() _gabineteId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      title: string;
      shortName: string;
      reference: string;
      category: LegislationCategory;
      sourceUrl?: string;
    },
  ) {
    if (!file) {
      throw new HttpException(
        { error: 'PDF file is required', code: 'MISSING_FILE' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!body.title || !body.shortName || !body.reference) {
      throw new HttpException(
        {
          error: 'Missing required fields: title, shortName, reference',
          code: 'VALIDATION_ERROR',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.ingestService.ingestPDF(file.buffer, {
      title: body.title,
      shortName: body.shortName,
      reference: body.reference,
      category: body.category || LegislationCategory.OUTRO,
      sourceUrl: body.sourceUrl,
    });

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }
}
