import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload, KamaiaRole } from '@kamaia/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  ConvertAtendimentoDto,
  CreateAtendimentoDto,
  ListAtendimentosDto,
  UpdateAtendimentoDto,
  convertAtendimentoSchema,
  createAtendimentoSchema,
  listAtendimentosSchema,
  updateAtendimentoSchema,
} from './atendimentos.dto';
import { AtendimentosService } from './atendimentos.service';

@Controller('atendimentos')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class AtendimentosController {
  constructor(private service: AtendimentosService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listAtendimentosSchema)) query: ListAtendimentosDto,
  ) {
    const result = await this.service.findAll(
      gabineteId,
      user.role as KamaiaRole,
      user.sub,
      query,
    );
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'ATENDIMENTOS_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: result.data };
  }

  @Get('stats')
  async stats(@GabineteId() gabineteId: string, @CurrentUser() user: JwtPayload) {
    const result = await this.service.stats(
      gabineteId,
      user.role as KamaiaRole,
      user.sub,
    );
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'ATENDIMENTO_STATS_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: result.data };
  }

  @Get(':id')
  async findOne(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const result = await this.service.findById(gabineteId, id);
    if (!result.success) {
      const status =
        result.code === 'ATENDIMENTO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException({ error: result.error, code: result.code }, status);
    }
    return { data: result.data };
  }

  @Post()
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createAtendimentoSchema)) dto: CreateAtendimentoDto,
  ) {
    const result = await this.service.create(gabineteId, user.sub, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'ATENDIMENTO_CREATE_FAILED' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }

  @Put(':id')
  async update(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateAtendimentoSchema)) dto: UpdateAtendimentoDto,
  ) {
    const result = await this.service.update(gabineteId, user.sub, id, dto);
    if (!result.success) {
      const status =
        result.code === 'ATENDIMENTO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;
      throw new HttpException({ error: result.error, code: result.code }, status);
    }
    return { data: result.data };
  }

  @Post(':id/convert')
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  @UseGuards(RolesGuard)
  async convert(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(convertAtendimentoSchema)) dto: ConvertAtendimentoDto,
  ) {
    const result = await this.service.convert(gabineteId, user.sub, id, dto);
    if (!result.success) {
      const status =
        result.code === 'ATENDIMENTO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'QUOTA_EXCEEDED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;
      throw new HttpException({ error: result.error, code: result.code }, status);
    }
    return { data: result.data };
  }

  @Delete(':id')
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  @UseGuards(RolesGuard)
  async delete(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.service.delete(gabineteId, user.sub, id);
    if (!result.success) {
      const status =
        result.code === 'ATENDIMENTO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException({ error: result.error, code: result.code }, status);
    }
    return { data: { success: true } };
  }
}
