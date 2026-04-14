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
import { TimesheetsService } from './timesheets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import {
  createTimeEntrySchema,
  updateTimeEntrySchema,
  listTimeEntriesSchema,
  CreateTimeEntryDto,
  UpdateTimeEntryDto,
  ListTimeEntriesDto,
} from './timesheets.dto';

@Controller('timesheets')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class TimesheetsController {
  constructor(private timesheetsService: TimesheetsService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listTimeEntriesSchema)) query: ListTimeEntriesDto,
  ) {
    const result = await this.timesheetsService.findAll(
      gabineteId,
      user.sub,
      user.role,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'TIME_ENTRIES_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('summary')
  async getSummary(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const result = await this.timesheetsService.getSummary(
      gabineteId,
      user.sub,
      user.role,
      dateFrom,
      dateTo,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'SUMMARY_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('billing')
  async getBillingSummary(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query('month') month?: string,
  ) {
    const result = await this.timesheetsService.getBillingSummary(
      gabineteId,
      user.sub,
      user.role,
      month,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'BILLING_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post()
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createTimeEntrySchema)) dto: CreateTimeEntryDto,
  ) {
    const result = await this.timesheetsService.create(gabineteId, user.sub, dto);

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'TIME_ENTRY_CREATE_FAILED',
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
    @Body(new ParseZodPipe(updateTimeEntrySchema)) dto: UpdateTimeEntryDto,
  ) {
    const result = await this.timesheetsService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'TIME_ENTRY_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'TIME_ENTRY_UPDATE_FAILED',
        },
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
    const result = await this.timesheetsService.delete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'TIME_ENTRY_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'TIME_ENTRY_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }
}
