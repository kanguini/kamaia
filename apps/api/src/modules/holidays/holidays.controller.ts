import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { z } from 'zod';
import { HolidaysService } from './holidays.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole } from '@kamaia/shared-types';

const createHolidaySchema = z.object({
  name: z.string().min(1).max(200),
  date: z.string().datetime(),
  kind: z.enum(['NATIONAL', 'MUNICIPAL', 'RELIGIOUS', 'OTHER']).optional(),
  recurring: z.boolean().optional(),
  notes: z.string().optional(),
});

const computeDateSchema = z.object({
  startDate: z.string().datetime(),
  days: z.coerce.number().int().min(1).max(3650),
});

@Controller('holidays')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class HolidaysController {
  constructor(private svc: HolidaysService) {}

  @Get()
  async list(
    @GabineteId() gabineteId: string,
    @Query('year') year?: string,
  ) {
    const r = await this.svc.list(gabineteId, year ? parseInt(year, 10) : undefined);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { data: r.data };
  }

  @Get('compute-business-date')
  async computeBusinessDate(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(computeDateSchema)) q: { startDate: string; days: number },
  ) {
    const start = new Date(q.startDate);
    const result = await this.svc.addBusinessDays(gabineteId, start, q.days);
    const keys = await this.svc.holidayKeysForRange(
      gabineteId,
      start.getUTCFullYear(),
      result.getUTCFullYear(),
    );
    const hit = [...keys]
      .filter((k) => {
        const d = new Date(k);
        return d > start && d <= result;
      })
      .sort();
    return {
      data: {
        startDate: start.toISOString(),
        businessDays: q.days,
        resultDate: result.toISOString(),
        skippedHolidays: hit,
      },
    };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async create(
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(createHolidaySchema)) dto: z.infer<typeof createHolidaySchema>,
  ) {
    const r = await this.svc.createGabineteHoliday(gabineteId, dto);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { data: r.data };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async delete(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
  ) {
    const r = await this.svc.deleteGabineteHoliday(gabineteId, id);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'HOLIDAY_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }
}
