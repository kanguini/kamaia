import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload } from '@kamaia/shared-types';
import { listUsersQuerySchema, ListUsersQueryDto } from './users.dto';
import { z } from 'zod';

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  oaaNumber: z.string().max(30).optional().nullable(),
  specialty: z.string().max(100).optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

@Controller('users')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async findAll(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(listUsersQuerySchema)) query: ListUsersQueryDto,
  ) {
    const result = await this.usersService.findAll(gabineteId, query);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'USERS_FETCH_FAILED' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('me')
  async getProfile(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.usersService.findById(gabineteId, user.sub);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.NOT_FOUND,
      );
    }

    return { data: result.data };
  }

  @Put('me')
  async updateProfile(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(updateProfileSchema))
    dto: z.infer<typeof updateProfileSchema>,
  ) {
    const result = await this.usersService.updateProfile(
      gabineteId,
      user.sub,
      dto,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Post('me/change-password')
  async changePassword(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(changePasswordSchema))
    dto: z.infer<typeof changePasswordSchema>,
  ) {
    const result = await this.usersService.changePassword(
      gabineteId,
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );

    if (!result.success) {
      const status =
        result.code === 'INVALID_PASSWORD'
          ? HttpStatus.UNAUTHORIZED
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: { success: true } };
  }

  @Get(':id')
  async findOne(
    @GabineteId() gabineteId: string,
    @Param('id') userId: string,
  ) {
    const result = await this.usersService.findById(gabineteId, userId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'USER_FETCH_FAILED' },
        result.code === 'USER_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }
}
