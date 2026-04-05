import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { GabinetesService } from './gabinetes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { updateGabineteSchema, UpdateGabineteDto } from './gabinetes.dto';
import { JwtPayload, KamaiaRole } from '@kamaia/shared-types';

@Controller('gabinetes')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class GabinetesController {
  constructor(private gabinetesService: GabinetesService) {}

  @Get('current')
  async getCurrent(@GabineteId() gabineteId: string) {
    const result = await this.gabinetesService.getCurrent(gabineteId);

    if (!result.success) {
      const status =
        result.code === 'GABINETE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'GABINETE_FETCH_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }

  @Put('current')
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  @UseGuards(RolesGuard)
  async updateCurrent(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(updateGabineteSchema)) dto: UpdateGabineteDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.gabinetesService.updateCurrent(
      gabineteId,
      user.sub,
      dto,
      ip,
      userAgent,
    );

    if (!result.success) {
      const status =
        result.code === 'GABINETE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;

      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'GABINETE_UPDATE_FAILED',
        },
        status,
      );
    }

    return { data: result.data };
  }
}
