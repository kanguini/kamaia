import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { JwtPayload, KamaiaRole } from '@kamaia/shared-types';
import {
  listInvoicesSchema,
  previewDraftSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  ListInvoicesDto,
  PreviewDraftDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  RecordPaymentDto,
} from './invoices.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, GabineteGuard)
export class InvoicesController {
  constructor(private svc: InvoicesService) {}

  @Get()
  async list(
    @GabineteId() gabineteId: string,
    @Query(new ParseZodPipe(listInvoicesSchema)) q: ListInvoicesDto,
  ) {
    const r = await this.svc.list(gabineteId, q);
    return this.unwrap(r);
  }

  @Post('preview-draft')
  async previewDraft(
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(previewDraftSchema)) dto: PreviewDraftDto,
  ) {
    const r = await this.svc.previewDraft(gabineteId, dto);
    return this.unwrap(r);
  }

  @Get(':id')
  async findById(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const r = await this.svc.findById(gabineteId, id);
    return this.unwrap(r, { notFoundCodes: ['INVOICE_NOT_FOUND'] });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO, KamaiaRole.ADVOGADO_MEMBRO)
  async create(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createInvoiceSchema)) dto: CreateInvoiceDto,
  ) {
    const r = await this.svc.create(gabineteId, user.sub, dto);
    return this.unwrap(r, {
      notFoundCodes: ['CLIENTE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Put(':id')
  async update(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Body(new ParseZodPipe(updateInvoiceSchema)) dto: UpdateInvoiceDto,
  ) {
    const r = await this.svc.update(gabineteId, id, dto);
    return this.unwrap(r, {
      notFoundCodes: ['INVOICE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Post(':id/send')
  async send(@GabineteId() gabineteId: string, @Param('id') id: string) {
    const r = await this.svc.send(gabineteId, id);
    return this.unwrap(r, {
      notFoundCodes: ['INVOICE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async voidInvoice(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const r = await this.svc.voidInvoice(gabineteId, user.sub, id);
    return this.unwrap(r, {
      notFoundCodes: ['INVOICE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Post(':id/payments')
  async recordPayment(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ParseZodPipe(recordPaymentSchema)) dto: RecordPaymentDto,
  ) {
    const r = await this.svc.recordPayment(gabineteId, user.sub, id, dto);
    return this.unwrap(r, {
      notFoundCodes: ['INVOICE_NOT_FOUND'],
      badRequestDefault: true,
    });
  }

  @Get(':id/pdf')
  async exportPdf(
    @GabineteId() gabineteId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const r = await this.svc.exportPdf(gabineteId, id);
    if (!r.success) {
      throw new HttpException(
        { error: r.error, code: r.code },
        r.code === 'INVOICE_NOT_FOUND' ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="factura-${id}.pdf"`);
    res.send(r.data);
  }

  private unwrap(
    r: { success: boolean; data?: unknown; error?: string; code?: string },
    opts: { notFoundCodes?: string[]; badRequestDefault?: boolean } = {},
  ) {
    if (r.success) return { data: r.data };
    const notFound = opts.notFoundCodes?.includes(r.code || '') ?? false;
    throw new HttpException(
      { error: r.error, code: r.code },
      notFound
        ? HttpStatus.NOT_FOUND
        : opts.badRequestDefault
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
