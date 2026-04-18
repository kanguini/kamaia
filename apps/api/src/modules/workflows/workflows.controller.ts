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
  Patch,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole } from '@kamaia/shared-types';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  upsertStageSchema,
  reorderStagesSchema,
  listWorkflowsSchema,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  UpsertStageDto,
  ReorderStagesDto,
  ListWorkflowsDto,
} from './workflows.dto';

@Controller('workflows')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  async list(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(listWorkflowsSchema)) query: ListWorkflowsDto,
  ) {
    const result = await this.workflowsService.list(gabineteId, query);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: result.data };
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async seed(@GabineteId() gabineteId: string) {
    const result = await this.workflowsService.seedDefaults(gabineteId);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: result.data };
  }

  @Get(':id')
  async findById(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const result = await this.workflowsService.findById(gabineteId, id);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'WORKFLOW_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: result.data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async create(
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(createWorkflowSchema)) dto: CreateWorkflowDto,
  ) {
    const result = await this.workflowsService.create(gabineteId, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async update(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateWorkflowSchema)) dto: UpdateWorkflowDto,
  ) {
    const result = await this.workflowsService.update(gabineteId, id, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'WORKFLOW_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async delete(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const result = await this.workflowsService.delete(gabineteId, id);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'WORKFLOW_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  @Post(':id/stages')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async addStage(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(upsertStageSchema)) dto: UpsertStageDto,
  ) {
    const result = await this.workflowsService.addStage(gabineteId, id, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'WORKFLOW_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }

  @Put('stages/:stageId')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async updateStage(
    @GabineteId() gabineteId: string,
    @Param('stageId') stageId: string,
    @Body(new ParseZodPipe(upsertStageSchema.partial())) dto: Partial<UpsertStageDto>,
  ) {
    const result = await this.workflowsService.updateStage(gabineteId, stageId, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'STAGE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }

  @Delete('stages/:stageId')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async deleteStage(
    @GabineteId() gabineteId: string,
    @Param('stageId') stageId: string,
  ) {
    const result = await this.workflowsService.deleteStage(gabineteId, stageId);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'STAGE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  @Patch(':id/stages/reorder')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async reorderStages(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(reorderStagesSchema)) dto: ReorderStagesDto,
  ) {
    const result = await this.workflowsService.reorderStages(gabineteId, id, dto);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'WORKFLOW_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: result.data };
  }
}
