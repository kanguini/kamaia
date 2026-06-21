import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  AddChunksDto,
  AddChunksSchema,
  CreateLegislationDto,
  CreateLegislationSchema,
  ListLegislationQuery,
  ListLegislationQuerySchema,
  SearchDto,
  SearchSchema,
} from './rag.dto';
import { RagService } from './rag.service';

@Controller('rag')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get('legislation')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async list(
    @Query(new ParseZodPipe(ListLegislationQuerySchema)) q: ListLegislationQuery,
  ) {
    return this.rag.list(q);
  }

  @Get('legislation/:id')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.rag.get(id);
  }

  @Post('legislation')
  @Roles(Role.ADMIN)
  async create(
    @Body(new ParseZodPipe(CreateLegislationSchema)) dto: CreateLegislationDto,
  ) {
    return this.rag.create(dto);
  }

  @Post('legislation/:id/chunks')
  @Roles(Role.ADMIN)
  async addChunks(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ParseZodPipe(AddChunksSchema)) dto: AddChunksDto,
  ) {
    return this.rag.addChunks(id, dto);
  }

  @Post('search')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER)
  async search(@Body(new ParseZodPipe(SearchSchema)) dto: SearchDto) {
    return this.rag.search(dto);
  }
}
