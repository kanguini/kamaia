import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  UploadDocumentDto,
  UpdateDocumentDto,
  ListDocumentsDto,
} from './documents.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listDocumentsSchema)) query: ListDocumentsDto,
  ) {
    const result = await this.documentsService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'DOCUMENTS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('storage')
  async getStorageUsage(@GabineteId() gabineteId: string) {
    const result = await this.documentsService.getStorageUsage(gabineteId);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'STORAGE_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    // Parse metadata from form-data (comes as strings)
    let metadata: UploadDocumentDto;
    try {
      metadata = uploadDocumentSchema.parse({
        title: body.title,
        category: body.category,
        processoId: body.processoId || undefined,
      });
    } catch (error: any) {
      throw new HttpException(
        {
          error: 'VALIDATION_ERROR',
          code: 'INVALID_METADATA',
          details: error.errors || error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.documentsService.upload(
      gabineteId,
      user.sub,
      file,
      metadata,
    );

    if (!result.success) {
      const status =
        result.code === 'QUOTA_EXCEEDED'
          ? HttpStatus.PAYMENT_REQUIRED
          : result.code === 'FILE_TOO_LARGE' ||
              result.code === 'INVALID_FILE_TYPE'
            ? HttpStatus.BAD_REQUEST
            : result.code === 'PROCESSO_NOT_FOUND'
              ? HttpStatus.NOT_FOUND
              : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'UPLOAD_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Get(':id/download')
  async download(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const result = await this.documentsService.download(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'DOCUMENT_NOT_FOUND' || result.code === 'FILE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'DOWNLOAD_FAILED',
        },
        status,
      );
    }

    const { filePath, mimeType, originalName } = result.data;

    response.setHeader('Content-Type', mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${originalName}"`,
    );
    response.sendFile(filePath);
  }

  @Get(':id')
  async findOne(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.documentsService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'DOCUMENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'DOCUMENT_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Put(':id')
  async update(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateDocumentSchema)) dto: UpdateDocumentDto,
  ) {
    const result = await this.documentsService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'DOCUMENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'DOCUMENT_UPDATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete(':id')
  @Roles(KamaiaRole.SOCIO_GESTOR)
  @UseGuards(RolesGuard)
  async delete(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.documentsService.delete(
      gabineteId,
      user.sub,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'DOCUMENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'DOCUMENT_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }
}
