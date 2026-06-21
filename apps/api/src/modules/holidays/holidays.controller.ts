import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@kamaia/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { YearParam, YearParamSchema } from './holidays.dto';
import { HolidaysService } from './holidays.service';

@Controller('holidays')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get(':year')
  @Roles(Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER, Role.BUSINESS_USER, Role.VIEWER, Role.EXTERNAL)
  async list(@Param(new ParseZodPipe(YearParamSchema)) params: YearParam) {
    return { year: params.year, holidays: this.holidays.list(params.year) };
  }
}
