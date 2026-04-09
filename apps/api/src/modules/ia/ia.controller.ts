import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { IaService } from './ia.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import {
  createConversationSchema,
  sendMessageSchema,
  listConversationsSchema,
  CreateConversationDto,
  SendMessageDto,
  ListConversationsDto,
} from './ia.dto';

@Controller('ia')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class IaController {
  constructor(private iaService: IaService) {}

  @Get('conversations')
  async listConversations(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ParseZodPipe(listConversationsSchema))
    query: ListConversationsDto,
  ) {
    const result = await this.iaService.findConversations(
      gabineteId,
      user.sub,
      query,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CONVERSATIONS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('quota')
  async getQuota(
    @GabineteId() gabineteId: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    const result = await this.iaService.getQuota(gabineteId);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'QUOTA_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('conversations/:id')
  async getConversation(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.iaService.findConversation(
      gabineteId,
      user.sub,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'CONVERSATION_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CONVERSATION_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Post('conversations')
  async createConversation(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createConversationSchema))
    dto: CreateConversationDto,
  ) {
    const result = await this.iaService.createConversation(
      gabineteId,
      user.sub,
      dto,
    );

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CONVERSATION_CREATE_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.iaService.deleteConversation(
      gabineteId,
      user.sub,
      id,
    );

    if (!result.success) {
      const status =
        result.code === 'CONVERSATION_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'CONVERSATION_DELETE_FAILED',
        },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') conversationId: string,
    @Body(new ParseZodPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    const result = await this.iaService.sendMessage(
      gabineteId,
      user.sub,
      conversationId,
      dto.content,
    );

    if (!result.success) {
      const status =
        result.code === 'CONVERSATION_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : result.code === 'QUOTA_EXCEEDED'
            ? HttpStatus.PAYMENT_REQUIRED
            : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'MESSAGE_SEND_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }
}
