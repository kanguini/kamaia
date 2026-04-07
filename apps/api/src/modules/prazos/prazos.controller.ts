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
import { PrazosService } from './prazos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  createPrazoSchema,
  updatePrazoSchema,
  changeStatusSchema,
  listPrazosSchema,
  suggestPrazoSchema,
  CreatePrazoDto,
  UpdatePrazoDto,
  ChangeStatusDto,
  ListPrazosDto,
  SuggestPrazoDto,
} from './prazos.dto';

@Controller('prazos')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class PrazosController {
  constructor(private prazosService: PrazosService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listPrazosSchema)) query: ListPrazosDto,
  ) {
    const result = await this.prazosService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PRAZOS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('upcoming')
  async findUpcoming(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.prazosService.findUpcoming(
      gabineteId,
      user.sub,
      user.role,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'UPCOMING_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('suggest')
  async suggestDeadline(
    @Query(new ParseZodPipe(suggestPrazoSchema)) query: SuggestPrazoDto,
  ) {
    const result = await this.prazosService.suggestDeadline(query);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'SUGGEST_FAILED',
        },
        HttpStatus.BAD_REQUEST,
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
    const result = await this.prazosService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'PRAZO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PRAZO_FETCH_FAILED',
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
    @Body(new ParseZodPipe(createPrazoSchema)) dto: CreatePrazoDto,
  ) {
    const result = await this.prazosService.create(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PRAZO_CREATE_FAILED',
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
    @Body(new ParseZodPipe(updatePrazoSchema)) dto: UpdatePrazoDto,
  ) {
    const result = await this.prazosService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'PRAZO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PRAZO_UPDATE_FAILED',
        },
        status,
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
    const result = await this.prazosService.changeStatus(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto.status,
    );

    if (!result.success) {
      const status =
        result.code === 'PRAZO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'PRAZO_ALREADY_COMPLETED'
              ? HttpStatus.CONFLICT
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

  @Patch(':id/complete')
  async complete(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.prazosService.complete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'PRAZO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'PRAZO_ALREADY_COMPLETED'
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'COMPLETE_FAILED',
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
    const result = await this.prazosService.delete(gabineteId, user.sub, id);

    if (!result.success) {
      const status =
        result.code === 'PRAZO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PRAZO_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }
}
