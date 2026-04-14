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
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  createClienteSchema,
  updateClienteSchema,
  listClientesSchema,
  CreateClienteDto,
  UpdateClienteDto,
  ListClientesDto,
} from './clientes.dto';

@Controller('clientes')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class ClientesController {
  constructor(
    private clientesService: ClientesService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(listClientesSchema)) query: ListClientesDto,
  ) {
    const result = await this.clientesService.findAll(gabineteId, query);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CLIENTES_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get(':id')
  async findOne(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const result = await this.clientesService.findById(gabineteId, id);

    if (!result.success) {
      const status =
        result.code === 'CLIENTE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CLIENTE_FETCH_FAILED',
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
    @Body(new ParseZodPipe(createClienteSchema)) dto: CreateClienteDto,
  ) {
    const result = await this.clientesService.create(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'QUOTA_EXCEEDED' ? HttpStatus.FORBIDDEN : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CLIENTE_CREATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Put(':id')
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  @UseGuards(RolesGuard)
  async update(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateClienteSchema)) dto: UpdateClienteDto,
  ) {
    const result = await this.clientesService.update(gabineteId, user.sub, id, dto);

    if (!result.success) {
      const status =
        result.code === 'CLIENTE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CLIENTE_UPDATE_FAILED',
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
    const result = await this.clientesService.delete(gabineteId, user.sub, id);

    if (!result.success) {
      const status =
        result.code === 'CLIENTE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CLIENTE_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }

  // ── Interactions (CRM Flow) ────────────────────────────

  @Get(':id/interactions')
  async getInteractions(
    @GabineteId() gabineteId: string,
    @Param('id') clienteId: string,
  ) {
    const interactions = await this.prisma.clienteInteraction.findMany({
      where: { gabineteId, clienteId, deletedAt: null },
      orderBy: { date: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return { data: interactions };
  }

  @Post(':id/interactions')
  async addInteraction(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') clienteId: string,
    @Body() body: { type: string; notes?: string; date?: string },
  ) {
    if (!body.type) {
      throw new HttpException(
        { error: 'Tipo de interaccao obrigatorio', code: 'VALIDATION_ERROR' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const interaction = await this.prisma.clienteInteraction.create({
      data: {
        gabineteId,
        clienteId,
        userId: user.sub,
        type: body.type,
        notes: body.notes,
        date: body.date ? new Date(body.date) : new Date(),
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return { data: interaction };
  }
}
