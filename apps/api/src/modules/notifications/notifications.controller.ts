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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { AlertsSchedulerService } from './alerts-scheduler.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  updatePreferencesSchema,
  subscribePushSchema,
  listNotificationsSchema,
  UpdatePreferencesDto,
  SubscribePushDto,
  ListNotificationsDto,
} from './notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class NotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private schedulerService: AlertsSchedulerService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listNotificationsSchema)) query: ListNotificationsDto,
  ) {
    const result = await this.notificationsService.listNotifications(
      user.sub,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'NOTIFICATIONS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationsService.getUnreadCount(user.sub);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'UNREAD_COUNT_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: { count: result.data } };
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationsService.getPreferences(user.sub);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PREFERENCES_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(updatePreferencesSchema)) dto: UpdatePreferencesDto,
  ) {
    const result = await this.notificationsService.updatePreferences(
      user.sub,
      gabineteId,
      dto,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PREFERENCES_UPDATE_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Post('push/subscribe')
  async subscribePush(
    @CurrentUser() user: JwtPayload,
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(subscribePushSchema)) dto: SubscribePushDto,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'];

    const result = await this.notificationsService.subscribePush(
      user.sub,
      gabineteId,
      dto,
      userAgent,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PUSH_SUBSCRIBE_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Delete('push/:id')
  async unsubscribePush(
    @CurrentUser() user: JwtPayload,
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
  ) {
    const result = await this.notificationsService.unsubscribePush(
      user.sub,
      gabineteId,
      id,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PUSH_UNSUBSCRIBE_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: { success: true } };
  }

  @Post('test')
  async sendTest(
    @CurrentUser() user: JwtPayload,
    @GabineteId() gabineteId: string,
  ) {
    const result = await this.notificationsService.sendTestNotification(
      gabineteId,
      user.sub,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'TEST_NOTIFICATION_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post('trigger-alerts')
  @Roles(KamaiaRole.SOCIO_GESTOR)
  @UseGuards(RolesGuard)
  async triggerAlerts() {
    const result = await this.schedulerService.runAlertsJob();
    return { data: result };
  }

  @Get('vapid-public-key')
  async getVapidPublicKey() {
    const publicKey = this.notificationsService.getVapidPublicKey();
    return { data: { publicKey } };
  }

  @Patch(':id/read')
  async markAsRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const result = await this.notificationsService.markAsRead(user.sub, id);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'MARK_READ_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: { success: true } };
  }
}
