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
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TramitacoesService } from './tramitacoes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  JwtPayload,
  TRAMITACAO_ACTO_TYPES,
  TRAMITACAO_TEMPLATES,
  TRAMITACAO_AUTOR_LABELS,
  TRAMITACAO_CATEGORY_LABELS,
} from '@kamaia/shared-types';
import {
  createTramitacaoSchema,
  updateTramitacaoSchema,
  listTramitacoesSchema,
  registerFromTemplateSchema,
  CreateTramitacaoDto,
  UpdateTramitacaoDto,
  ListTramitacoesDto,
  RegisterFromTemplateDto,
} from './tramitacoes.dto';

@Controller('tramitacoes')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class TramitacoesController {
  constructor(private tramitacoesService: TramitacoesService) {}

  // Vocabulário controlado + templates — consumido pelo modal "Registar Acto"
  @Get('vocabulary')
  async getVocabulary() {
    return {
      data: {
        actoTypes: TRAMITACAO_ACTO_TYPES,
        categoryLabels: TRAMITACAO_CATEGORY_LABELS,
        autorLabels: TRAMITACAO_AUTOR_LABELS,
        templates: TRAMITACAO_TEMPLATES,
      },
    };
  }

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listTramitacoesSchema)) query: ListTramitacoesDto,
  ) {
    const result = await this.tramitacoesService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACOES_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get(':id')
  async findOne(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.tramitacoesService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'TRAMITACAO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACAO_FETCH_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Post()
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createTramitacaoSchema)) dto: CreateTramitacaoDto,
  ) {
    const result = await this.tramitacoesService.create(
      gabineteId,
      user.sub,
      user.role,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACAO_CREATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Post('from-template')
  async createFromTemplate(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(registerFromTemplateSchema))
    dto: RegisterFromTemplateDto,
  ) {
    const result = await this.tramitacoesService.createFromTemplate(
      gabineteId,
      user.sub,
      user.role,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TEMPLATE_NOT_FOUND' ||
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACAO_CREATE_FAILED' },
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
    @Body(new ParseZodPipe(updateTramitacaoSchema)) dto: UpdateTramitacaoDto,
  ) {
    const result = await this.tramitacoesService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TRAMITACAO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACAO_UPDATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete(':id')
  async delete(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.tramitacoesService.delete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'TRAMITACAO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'TRAMITACAO_DELETE_FAILED' },
        status,
      );
    }

    return { data: { success: true } };
  }
}
