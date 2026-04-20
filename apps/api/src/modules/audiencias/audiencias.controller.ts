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
import { AudienciasService } from './audiencias.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  JwtPayload,
  AUDIENCIA_TYPE_LABELS,
  AUDIENCIA_STATUS_LABELS,
  AUDIENCIA_ALLOWED_TRANSITIONS,
} from '@kamaia/shared-types';
import {
  createAudienciaSchema,
  updateAudienciaSchema,
  markHeldSchema,
  postponeSchema,
  cancelSchema,
  listAudienciasSchema,
  CreateAudienciaDto,
  UpdateAudienciaDto,
  MarkHeldDto,
  PostponeDto,
  CancelDto,
  ListAudienciasDto,
} from './audiencias.dto';

@Controller('audiencias')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class AudienciasController {
  constructor(private audienciasService: AudienciasService) {}

  // Vocabulário — tipos, estados e transições permitidas (consumido pela UI).
  @Get('vocabulary')
  async getVocabulary() {
    return {
      data: {
        typeLabels: AUDIENCIA_TYPE_LABELS,
        statusLabels: AUDIENCIA_STATUS_LABELS,
        allowedTransitions: AUDIENCIA_ALLOWED_TRANSITIONS,
      },
    };
  }

  @Get('upcoming')
  async findUpcoming(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.audienciasService.findUpcoming(
      gabineteId,
      user.sub,
      user.role,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'UPCOMING_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listAudienciasSchema)) query: ListAudienciasDto,
  ) {
    const result = await this.audienciasService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIAS_FETCH_FAILED' },
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
    const result = await this.audienciasService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_FETCH_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Post()
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createAudienciaSchema)) dto: CreateAudienciaDto,
  ) {
    const result = await this.audienciasService.create(
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
        { error: result.error, code: result.code || 'AUDIENCIA_CREATE_FAILED' },
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
    @Body(new ParseZodPipe(updateAudienciaSchema)) dto: UpdateAudienciaDto,
  ) {
    const result = await this.audienciasService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'AUDIENCIA_IMMUTABLE'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_UPDATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  // ── Transições do ciclo de vida ───────────────────────────

  @Post(':id/held')
  async markHeld(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(markHeldSchema)) dto: MarkHeldDto,
  ) {
    const result = await this.audienciasService.markHeld(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'INVALID_TRANSITION'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_MARK_HELD_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Post(':id/postpone')
  async postpone(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(postponeSchema)) dto: PostponeDto,
  ) {
    const result = await this.audienciasService.postpone(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'INVALID_TRANSITION'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_POSTPONE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Post(':id/cancel')
  async cancel(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(cancelSchema)) dto: CancelDto,
  ) {
    const result = await this.audienciasService.cancel(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'INVALID_TRANSITION'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_CANCEL_FAILED' },
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
    const result = await this.audienciasService.delete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'AUDIENCIA_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'AUDIENCIA_DELETE_FAILED' },
        status,
      );
    }

    return { data: { success: true } };
  }
}
