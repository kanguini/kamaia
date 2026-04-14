import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('processo/:id')
  async processoReport(
    @GabineteId() gabineteId: string,
    @Param('id') processoId: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.generateProcessoReport(
      gabineteId,
      processoId,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="processo-${processoId}.html"`,
    );
    res.send(result.data);
  }

  @Get('cliente/:id')
  async clienteReport(
    @GabineteId() gabineteId: string,
    @Param('id') clienteId: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.generateClienteReport(
      gabineteId,
      clienteId,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'CLIENTE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="cliente-${clienteId}.html"`,
    );
    res.send(result.data);
  }

  @Get('prazos')
  async prazosReport(
    @GabineteId() gabineteId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const result = await this.reportsService.generatePrazosReport(
      gabineteId,
      { status, from, to },
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    res!.setHeader('Content-Type', 'text/html; charset=utf-8');
    res!.setHeader(
      'Content-Disposition',
      'inline; filename="relatorio-prazos.html"',
    );
    res!.send(result.data);
  }

  @Get('dashboard')
  async dashboardReport(
    @GabineteId() gabineteId: string,
    @Res() res: Response,
  ) {
    const result =
      await this.reportsService.generateDashboardReport(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="relatorio-executivo.html"',
    );
    res.send(result.data);
  }
}
