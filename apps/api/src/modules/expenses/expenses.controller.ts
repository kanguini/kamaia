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
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
  CreateExpenseDto,
  UpdateExpenseDto,
  ListExpensesDto,
} from './expenses.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listExpensesSchema)) query: ListExpensesDto,
  ) {
    const result = await this.expensesService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'EXPENSES_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post()
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createExpenseSchema)) dto: CreateExpenseDto,
  ) {
    const result = await this.expensesService.create(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'EXPENSE_CREATE_FAILED',
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
    @Body(new ParseZodPipe(updateExpenseSchema)) dto: UpdateExpenseDto,
  ) {
    const result = await this.expensesService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'EXPENSE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'EXPENSE_UPDATE_FAILED',
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
    const result = await this.expensesService.delete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'EXPENSE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'EXPENSE_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }
}
