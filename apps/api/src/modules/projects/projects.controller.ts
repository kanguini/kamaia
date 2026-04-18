import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload, KamaiaRole } from '@kamaia/shared-types';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  addMemberSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  fromTemplateSchema,
  CreateProjectDto,
  UpdateProjectDto,
  ListProjectsDto,
  AddMemberDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  FromTemplateDto,
} from './projects.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Get()
  async list(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(listProjectsSchema)) q: ListProjectsDto,
  ) {
    const r = await this.svc.list(gabineteId, q);
    return this.unwrap(r);
  }

  // ── Templates ───────────────────────────────────────
  // Must come before `:id` routes so Nest doesn't treat "templates" as an id.
  @Get('templates')
  async listTemplates() {
    return { data: this.svc.listTemplates() };
  }

  @Post('from-template')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO, KamaiaRole.ADVOGADO_MEMBRO)
  async createFromTemplate(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(fromTemplateSchema)) dto: FromTemplateDto,
  ) {
    const r = await this.svc.createFromTemplate(gabineteId, user.sub, dto);
    return this.unwrap(r, {
      notFoundCodes: ['TEMPLATE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Get(':id')
  async findById(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const r = await this.svc.findById(gabineteId, id);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO, KamaiaRole.ADVOGADO_MEMBRO)
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createProjectSchema)) dto: CreateProjectDto,
  ) {
    const r = await this.svc.create(gabineteId, user.sub, dto);
    return this.unwrap(r, { badRequestDefault: true });
  }

  @Put(':id')
  async update(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateProjectSchema)) dto: UpdateProjectDto,
  ) {
    const r = await this.svc.update(gabineteId, user.sub, id, dto);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async delete(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const r = await this.svc.delete(gabineteId, user.sub, id);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'PROJECT_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  // ── Members ──────────────────────────────────────────
  @Post(':id/members')
  async addMember(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(addMemberSchema)) dto: AddMemberDto,
  ) {
    const r = await this.svc.addMember(gabineteId, id, dto);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    const r = await this.svc.removeMember(gabineteId, id, userId);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'PROJECT_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  // ── Milestones ───────────────────────────────────────
  @Post(':id/milestones')
  async addMilestone(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(createMilestoneSchema)) dto: CreateMilestoneDto,
  ) {
    const r = await this.svc.addMilestone(gabineteId, id, dto);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Put('milestones/:milestoneId')
  async updateMilestone(
    @GabineteId() gabineteId: string,
    @Param('milestoneId') milestoneId: string,
    @Body(new ParseZodPipe(updateMilestoneSchema)) dto: UpdateMilestoneDto,
  ) {
    const r = await this.svc.updateMilestone(gabineteId, milestoneId, dto);
    return this.unwrap(r, { notFoundCodes: ['MILESTONE_NOT_FOUND'] });
  }

  @Delete('milestones/:milestoneId')
  async deleteMilestone(
    @GabineteId() gabineteId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    const r = await this.svc.deleteMilestone(gabineteId, milestoneId);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'MILESTONE_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  // ── Budget roll-up ───────────────────────────────────
  @Get(':id/budget')
  async budget(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const r = await this.svc.getBudget(gabineteId, id);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Get(':id/burndown')
  async burndown(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const r = await this.svc.getBurndown(gabineteId, id);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  // ── Linked processos ────────────────────────────────
  @Get(':id/linkable-processos')
  async linkableProcessos(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Query('search') search?: string,
  ) {
    const r = await this.svc.listLinkableProcessos(gabineteId, id, search);
    return this.unwrap(r, { notFoundCodes: ['PROJECT_NOT_FOUND'] });
  }

  @Post(':id/processos/:processoId')
  async linkProcesso(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Param('processoId') processoId: string,
  ) {
    const r = await this.svc.linkProcesso(gabineteId, id, processoId);
    return this.unwrap(r, {
      notFoundCodes: ['PROJECT_NOT_FOUND', 'PROCESSO_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Delete(':id/processos/:processoId')
  async unlinkProcesso(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Param('processoId') processoId: string,
  ) {
    const r = await this.svc.unlinkProcesso(gabineteId, id, processoId);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'PROCESSO_NOT_LINKED' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  private unwrap(
    r: { success: boolean; data?: unknown; error?: string; code?: string },
    opts: { notFoundCodes?: string[]; badRequestDefault?: boolean } = {},
  ) {
    if (r.success) return { data: r.data };
    const notFound = opts.notFoundCodes?.includes(r.code || '') ?? false;
    throw new HttpException(
      { error: r.error, code: r.code },
      notFound
        ? HttpStatus.NOT_FOUND
        : opts.badRequestDefault
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
