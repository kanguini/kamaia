import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { listUsersQuerySchema, ListUsersQueryDto } from './users.dto';

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
        {
          error: result.error,
          code: result.code || 'USERS_FETCH_FAILED',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get(':id')
  async findOne(@GabineteId() gabineteId: string, @Param('id') userId: string) {
    const result = await this.usersService.findById(gabineteId, userId);

    if (!result.success) {
      const status =
        result.code === 'USER_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'USER_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }
}
