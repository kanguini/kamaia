import {
  Controller,
  Get,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { KamaiaRole } from '@kamaia/shared-types';

@Controller('backup')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class BackupController {
  constructor(private backupService: BackupService) {}

  /** Data integrity stats */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async getStats(@GabineteId() _gabineteId: string) {
    const result = await this.backupService.getDataStats();

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  /** Full data export (JSON download) */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async exportData(
    @GabineteId() gabineteId: string,
    @Res() res: Response,
  ) {
    const result = await this.backupService.exportGabineteData(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const filename = `kamaia-export-${gabineteId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(result.data, null, 2));
  }
}
