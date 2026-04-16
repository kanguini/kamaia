import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import {
  createColumnSchema,
  updateColumnSchema,
  reorderColumnsSchema,
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  createCheckItemSchema,
  updateCheckItemSchema,
  createCommentSchema,
  CreateColumnDto,
  UpdateColumnDto,
  ReorderColumnsDto,
  CreateTaskDto,
  UpdateTaskDto,
  MoveTaskDto,
  CreateCheckItemDto,
  UpdateCheckItemDto,
  CreateCommentDto,
} from './tasks.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  // ── Column Endpoints ───────────────────────────────────

  @Get('columns')
  async getBoard(@GabineteId() gabineteId: string) {
    const result = await this.tasksService.getBoard(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'BOARD_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post('columns')
  async createColumn(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createColumnSchema)) dto: CreateColumnDto,
  ) {
    const result = await this.tasksService.createColumn(gabineteId, user.sub, dto);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'COLUMN_CREATE_FAILED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Put('columns/:id')
  async updateColumn(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateColumnSchema)) dto: UpdateColumnDto,
  ) {
    const result = await this.tasksService.updateColumn(gabineteId, user.sub, id, dto);

    if (!result.success) {
      const status =
        result.code === 'COLUMN_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'COLUMN_UPDATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete('columns/:id')
  async deleteColumn(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.tasksService.deleteColumn(gabineteId, user.sub, id);

    if (!result.success) {
      const status =
        result.code === 'COLUMN_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'COLUMN_NOT_EMPTY'
            ? HttpStatus.CONFLICT
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'COLUMN_DELETE_FAILED' },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Patch('columns/reorder')
  async reorderColumns(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(reorderColumnsSchema)) dto: ReorderColumnsDto,
  ) {
    const result = await this.tasksService.reorderColumns(gabineteId, user.sub, dto);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'COLUMNS_REORDER_FAILED' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  // ── Task Endpoints ─────────────────────────────────────

  @Post()
  async createTask(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createTaskSchema)) dto: CreateTaskDto,
  ) {
    const result = await this.tasksService.createTask(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'COLUMN_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TASK_CREATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Put(':id')
  async updateTask(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateTaskSchema)) dto: UpdateTaskDto,
  ) {
    const result = await this.tasksService.updateTask(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TASK_UPDATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete(':id')
  async deleteTask(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.tasksService.deleteTask(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'TASK_DELETE_FAILED' },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Patch(':id/move')
  async moveTask(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(moveTaskSchema)) dto: MoveTaskDto,
  ) {
    const result = await this.tasksService.moveTask(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : result.code === 'COLUMN_NOT_FOUND'
              ? HttpStatus.NOT_FOUND
              : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'TASK_MOVE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Get(':id')
  async getTaskDetail(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.tasksService.getTaskDetail(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'TASK_FETCH_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  // ── Checklist Endpoints ────────────────────────────────

  @Post(':id/checklist')
  async createCheckItem(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') taskId: string,
    @Body(new ParseZodPipe(createCheckItemSchema)) dto: CreateCheckItemDto,
  ) {
    const result = await this.tasksService.createCheckItem(
      gabineteId,
      user.sub,
      user.role,
      taskId,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'CHECK_ITEM_CREATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Patch(':id/checklist/:itemId')
  async updateCheckItem(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') taskId: string,
    @Param('itemId') itemId: string,
    @Body(new ParseZodPipe(updateCheckItemSchema)) dto: UpdateCheckItemDto,
  ) {
    const result = await this.tasksService.updateCheckItem(
      gabineteId,
      user.sub,
      user.role,
      taskId,
      itemId,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'CHECK_ITEM_UPDATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete(':id/checklist/:itemId')
  async deleteCheckItem(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') taskId: string,
    @Param('itemId') itemId: string,
  ) {
    const result = await this.tasksService.deleteCheckItem(
      gabineteId,
      user.sub,
      user.role,
      taskId,
      itemId,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'CHECK_ITEM_DELETE_FAILED' },
        status,
      );
    }

    return { data: { success: true } };
  }

  // ── Comment Endpoints ──────────────────────────────────

  @Post(':id/comments')
  async createComment(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') taskId: string,
    @Body(new ParseZodPipe(createCommentSchema)) dto: CreateCommentDto,
  ) {
    const result = await this.tasksService.createComment(
      gabineteId,
      user.sub,
      user.role,
      taskId,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code || 'COMMENT_CREATE_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }

  @Get(':id/comments')
  async getComments(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') taskId: string,
  ) {
    const result = await this.tasksService.getComments(
      gabineteId,
      user.sub,
      user.role,
      taskId,
    );

    if (!result.success) {
      const status =
        result.code === 'TASK_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        { error: result.error, code: result.code || 'COMMENTS_FETCH_FAILED' },
        status,
      );
    }

    return { data: result.data };
  }
}
