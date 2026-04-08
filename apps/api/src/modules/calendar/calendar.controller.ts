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
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import {
  listEventsSchema,
  createEventSchema,
  updateEventSchema,
  ListEventsDto,
  CreateEventDto,
  UpdateEventDto,
} from './calendar.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get('events')
  async listEvents(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listEventsSchema)) query: ListEventsDto,
  ) {
    const result = await this.calendarService.findByDateRange(
      gabineteId,
      user.sub,
      user.role,
      query.startDate,
      query.endDate,
      {
        type: query.type,
        processoId: query.processoId,
      },
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CALENDAR_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('events/:id')
  async getEvent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.calendarService.findById(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'CALENDAR_EVENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CALENDAR_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Post('events')
  async createEvent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createEventSchema)) dto: CreateEventDto,
  ) {
    const result = await this.calendarService.create(
      gabineteId,
      user.sub,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CALENDAR_CREATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Put('events/:id')
  async updateEvent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateEventSchema)) dto: UpdateEventDto,
  ) {
    const result = await this.calendarService.update(
      gabineteId,
      user.sub,
      user.role,
      id,
      dto,
    );

    if (!result.success) {
      const status =
        result.code === 'CALENDAR_EVENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CALENDAR_UPDATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Delete('events/:id')
  async deleteEvent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.calendarService.delete(
      gabineteId,
      user.sub,
      user.role,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'CALENDAR_EVENT_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'ACCESS_DENIED'
            ? HttpStatus.FORBIDDEN
            : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CALENDAR_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }
}
