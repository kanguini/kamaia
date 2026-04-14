import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ProcessosService } from './processos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  createProcessoSchema,
  updateProcessoSchema,
  changeStageSchema,
  changeStatusSchema,
  createEventSchema,
  listProcessosSchema,
  listEventsSchema,
  CreateProcessoDto,
  UpdateProcessoDto,
  ChangeStageDto,
  ChangeStatusDto,
  CreateEventDto,
  ListProcessosDto,
  ListEventsDto,
} from './processos.dto';

@Controller('processos')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class ProcessosController {
  constructor(private processosService: ProcessosService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listProcessosSchema)) query: ListProcessosDto,
  ) {
    const result = await this.processosService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PROCESSOS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('kanban')
  async kanban(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: string,
  ) {
    const advogadoId = user.role === KamaiaRole.ADVOGADO_MEMBRO ? user.sub : undefined;
    const result = await this.processosService.findForKanban(gabineteId, type, advogadoId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: 'KANBAN_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('pipeline')
  async pipeline(@GabineteId() gabineteId: string) {
    const result = await this.processosService.getPipelineCounts(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: 'PIPELINE_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('tags')
  async getTags(@GabineteId() gabineteId: string) {
    const result = await this.processosService.getAllTags(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: 'TAGS_FETCH_FAILED' },
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
    const result = await this.processosService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PROCESSO_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Post()
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  @UseGuards(RolesGuard)
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createProcessoSchema)) dto: CreateProcessoDto,
  ) {
    const result = await this.processosService.create(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'QUOTA_EXCEEDED' ? HttpStatus.FORBIDDEN : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PROCESSO_CREATE_FAILED',
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
    @Body(new ParseZodPipe(updateProcessoSchema)) dto: UpdateProcessoDto,
  ) {
    const result = await this.processosService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
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
        {
          error: result.error,
          code: result.code || 'PROCESSO_UPDATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Patch(':id/stage')
  async changeStage(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(changeStageSchema)) dto: ChangeStageDto,
  ) {
    const result = await this.processosService.changeStage(
      gabineteId,
      user.sub,
      user.role,
      id,
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
        {
          error: result.error,
          code: result.code || 'STAGE_CHANGE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Patch(':id/lifecycle')
  async changeLifecycle(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: { lifecycle: string },
  ) {
    const result = await this.processosService.changeLifecycle(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto.lifecycle,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'LIFECYCLE_CHANGE_FAILED' },
        result.code === 'PROCESSO_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Patch(':id/status')
  async changeStatus(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(changeStatusSchema)) dto: ChangeStatusDto,
  ) {
    const result = await this.processosService.changeStatus(
      gabineteId,
      user.sub,
      user.role,
      id,
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
        {
          error: result.error,
          code: result.code || 'STATUS_CHANGE_FAILED',
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
    const result = await this.processosService.delete(gabineteId, user.sub, id);

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PROCESSO_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Get(':id/events')
  async getEvents(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') processoId: string,
    @Query(new ParseZodPipe(listEventsSchema)) query: ListEventsDto,
  ) {
    const result = await this.processosService.getEvents(
      gabineteId,
      user.sub,
      user.role,
      processoId,
      query.cursor,
      query.limit,
    );

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'EVENTS_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Post(':id/events')
  async addEvent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') processoId: string,
    @Body(new ParseZodPipe(createEventSchema)) dto: CreateEventDto,
  ) {
    const result = await this.processosService.addEvent(
      gabineteId,
      user.sub,
      user.role,
      processoId,
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
        {
          error: result.error,
          code: result.code || 'EVENT_CREATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }
}
