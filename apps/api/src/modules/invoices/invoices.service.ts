import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Result, ok, err, AuditAction, EntityType } from '@kamaia/shared-types';
import {
  PreviewDraftDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  RecordPaymentDto,
  ListInvoicesDto,
} from './invoices.dto';

/**
 * Invoicing core — aggregates billable TimeEntries + Expenses into an
 * Invoice, locks them by FK so they can't be double-billed, and manages
 * the lifecycle (draft → sent → paid). All totals are stored in centavos
 * (AOA × 100) to avoid float rounding.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(gabineteId: string, params: ListInvoicesDto): Promise<Result<any>> {
    try {
      const where: any = { gabineteId, deletedAt: null };
      if (params.status) where.status = params.status;
      if (params.clienteId) where.clienteId = params.clienteId;
      if (params.processoId) where.processoId = params.processoId;
      if (params.search) {
        where.OR = [
          { number: { contains: params.search, mode: 'insensitive' } },
          { notes: { contains: params.search, mode: 'insensitive' } },
        ];
      }

      const rows = await this.prisma.invoice.findMany({
        where,
        take: params.limit + 1,
        ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
        orderBy: { issueDate: 'desc' },
        include: {
          cliente: { select: { id: true, name: true, nif: true } },
          processo: { select: { id: true, processoNumber: true, title: true } },
          _count: { select: { items: true, payments: true } },
        },
      });

      const hasMore = rows.length > params.limit;
      const data = hasMore ? rows.slice(0, -1) : rows;
      const nextCursor = hasMore ? data[data.length - 1].id : null;
      return ok({ data, total: data.length, nextCursor });
    } catch (e) {
      return err('Failed to list invoices', 'INVOICES_LIST_FAILED');
    }
  }

  async findById(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id, gabineteId, deletedAt: null },
        include: {
          cliente: true,
          processo: { select: { id: true, processoNumber: true, title: true } },
          project: { select: { id: true, code: true, name: true } },
          items: { orderBy: { position: 'asc' } },
          payments: { orderBy: { paidAt: 'desc' } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          gabinete: {
            select: {
              name: true,
              nif: true,
              address: true,
              phone: true,
              email: true,
              logoUrl: true,
            },
          },
        },
      });
      if (!invoice) return err('Invoice not found', 'INVOICE_NOT_FOUND');
      return ok(invoice);
    } catch (e) {
      return err('Failed to fetch invoice', 'INVOICE_FETCH_FAILED');
    }
  }

  /**
   * Returns the billable material available for the given cliente/date
   * range — entries & expenses that haven't been invoiced yet. This is
   * what populates the "nova factura" wizard before emitting.
   */
  async previewDraft(
    gabineteId: string,
    dto: PreviewDraftDto,
  ): Promise<Result<any>> {
    try {
      const processoFilter: any = { clienteId: dto.clienteId };
      if (dto.processoId) processoFilter.id = dto.processoId;
      if (dto.projectId) processoFilter.projectId = dto.projectId;

      const processos = await this.prisma.processo.findMany({
        where: { ...processoFilter, gabineteId, deletedAt: null },
        select: {
          id: true,
          processoNumber: true,
          title: true,
          feeType: true,
          feeAmount: true,
        },
      });
      const processoIds = processos.map((p) => p.id);
      if (processoIds.length === 0) {
        return ok({ timeEntries: [], expenses: [], processos: [] });
      }

      const dateRange = {
        gte: new Date(dto.dateFrom),
        lte: new Date(dto.dateTo),
      };

      const [timeEntries, expenses] = await Promise.all([
        this.prisma.timeEntry.findMany({
          where: {
            gabineteId,
            processoId: { in: processoIds },
            billable: true,
            invoiceId: null,
            deletedAt: null,
            date: dateRange,
          },
          include: {
            processo: {
              select: { id: true, processoNumber: true, title: true, feeAmount: true },
            },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: 'asc' },
        }),
        this.prisma.expense.findMany({
          where: {
            gabineteId,
            processoId: { in: processoIds },
            invoiceId: null,
            deletedAt: null,
            date: dateRange,
          },
          include: {
            processo: {
              select: { id: true, processoNumber: true, title: true },
            },
          },
          orderBy: { date: 'asc' },
        }),
      ]);

      return ok({ timeEntries, expenses, processos });
    } catch (e) {
      return err('Failed to preview draft', 'DRAFT_PREVIEW_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateInvoiceDto,
  ): Promise<Result<any>> {
    try {
      // Validate cliente exists
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: dto.clienteId, gabineteId, deletedAt: null },
      });
      if (!cliente) return err('Cliente not found', 'CLIENTE_NOT_FOUND');

      // Fetch entries/expenses to bill (and assert ownership)
      const [timeEntries, expenses] = await Promise.all([
        dto.timeEntryIds?.length
          ? this.prisma.timeEntry.findMany({
              where: {
                id: { in: dto.timeEntryIds },
                gabineteId,
                invoiceId: null,
                deletedAt: null,
              },
              include: {
                processo: { select: { processoNumber: true, title: true, feeAmount: true } },
              },
            })
          : Promise.resolve([]),
        dto.expenseIds?.length
          ? this.prisma.expense.findMany({
              where: {
                id: { in: dto.expenseIds },
                gabineteId,
                invoiceId: null,
                deletedAt: null,
              },
              include: {
                processo: { select: { processoNumber: true, title: true } },
              },
            })
          : Promise.resolve([]),
      ]);

      if (
        (dto.timeEntryIds?.length ?? 0) !== timeEntries.length ||
        (dto.expenseIds?.length ?? 0) !== expenses.length
      ) {
        return err(
          'Some entries are already billed or do not exist',
          'ENTRIES_LOCKED',
        );
      }

      // Build items
      const items: {
        kind: 'TIME' | 'EXPENSE' | 'CUSTOM';
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        sourceId: string | null;
      }[] = [];

      for (const t of timeEntries) {
        const hours = t.durationMinutes / 60;
        const rate =
          t.hourlyRate ?? t.processo.feeAmount ?? dto.defaultHourlyRate ?? 0;
        const total = Math.round(hours * rate);
        items.push({
          kind: 'TIME',
          description: `${t.processo.processoNumber} · ${t.processo.title} — ${t.description ?? t.category}`,
          quantity: Number(hours.toFixed(2)),
          unitPrice: rate,
          total,
          sourceId: t.id,
        });
      }

      for (const e of expenses) {
        items.push({
          kind: 'EXPENSE',
          description: `${e.processo.processoNumber} · ${e.description}`,
          quantity: 1,
          unitPrice: e.amount,
          total: e.amount,
          sourceId: e.id,
        });
      }

      for (const c of dto.customItems ?? []) {
        const total = Math.round(c.quantity * c.unitPrice);
        items.push({
          kind: 'CUSTOM',
          description: c.description,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          total,
          sourceId: null,
        });
      }

      if (items.length === 0) {
        return err('Invoice has no items', 'NO_ITEMS');
      }

      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const taxRate = dto.taxRate ?? 14;
      const taxAmount = Math.round((subtotal * taxRate) / 100);
      const total = subtotal + taxAmount;

      const number = await this.nextInvoiceNumber(gabineteId);

      const invoice = await this.prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            gabineteId,
            clienteId: dto.clienteId,
            processoId: dto.processoId ?? null,
            projectId: dto.projectId ?? null,
            number,
            status: 'DRAFT',
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            taxRate,
            subtotal,
            taxAmount,
            total,
            notes: dto.notes ?? null,
            termsText: dto.termsText ?? null,
            createdById: userId,
            items: {
              create: items.map((i, idx) => ({ ...i, position: idx })),
            },
          },
        });

        // Lock the source rows
        if (timeEntries.length) {
          await tx.timeEntry.updateMany({
            where: { id: { in: timeEntries.map((t) => t.id) } },
            data: { invoiceId: inv.id },
          });
        }
        if (expenses.length) {
          await tx.expense.updateMany({
            where: { id: { in: expenses.map((e) => e.id) } },
            data: { invoiceId: inv.id },
          });
        }

        return inv;
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROCESSO, // closest generic entity until INVOICE is added
        entityId: invoice.id,
        userId,
        gabineteId,
        newValue: { kind: 'invoice', number, total },
      });

      return this.findById(gabineteId, invoice.id);
    } catch (e) {
      return err('Failed to create invoice', 'INVOICE_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.prisma.invoice.findFirst({
        where: { id, gabineteId, deletedAt: null },
      });
      if (!existing) return err('Invoice not found', 'INVOICE_NOT_FOUND');
      if (existing.status !== 'DRAFT') {
        return err('Only DRAFT invoices can be edited', 'NOT_EDITABLE');
      }

      const data: any = {
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.termsText !== undefined && { termsText: dto.termsText }),
      };
      if (dto.taxRate !== undefined) {
        const taxAmount = Math.round((existing.subtotal * dto.taxRate) / 100);
        data.taxRate = dto.taxRate;
        data.taxAmount = taxAmount;
        data.total = existing.subtotal + taxAmount;
      }

      const updated = await this.prisma.invoice.update({
        where: { id },
        data,
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to update invoice', 'INVOICE_UPDATE_FAILED');
    }
  }

  async send(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const inv = await this.prisma.invoice.findFirst({
        where: { id, gabineteId, deletedAt: null },
      });
      if (!inv) return err('Invoice not found', 'INVOICE_NOT_FOUND');
      if (inv.status !== 'DRAFT') {
        return err('Only DRAFT invoices can be sent', 'INVALID_STATE');
      }
      const updated = await this.prisma.invoice.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      return ok(updated);
    } catch (e) {
      return err('Failed to send invoice', 'INVOICE_SEND_FAILED');
    }
  }

  async voidInvoice(
    gabineteId: string,
    userId: string,
    id: string,
  ): Promise<Result<any>> {
    try {
      const inv = await this.prisma.invoice.findFirst({
        where: { id, gabineteId, deletedAt: null },
      });
      if (!inv) return err('Invoice not found', 'INVOICE_NOT_FOUND');
      if (inv.status === 'PAID') {
        return err('Cannot void a paid invoice', 'INVALID_STATE');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id },
          data: { status: 'VOID', voidedAt: new Date() },
        });
        // Unlock sources so the work can be re-billed
        await tx.timeEntry.updateMany({
          where: { invoiceId: id },
          data: { invoiceId: null },
        });
        await tx.expense.updateMany({
          where: { invoiceId: id },
          data: { invoiceId: null },
        });
      });
      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        newValue: { kind: 'invoice-void', number: inv.number },
      });
      return ok({ id, status: 'VOID' });
    } catch (e) {
      return err('Failed to void invoice', 'INVOICE_VOID_FAILED');
    }
  }

  async recordPayment(
    gabineteId: string,
    userId: string,
    invoiceId: string,
    dto: RecordPaymentDto,
  ): Promise<Result<any>> {
    try {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, gabineteId, deletedAt: null },
      });
      if (!inv) return err('Invoice not found', 'INVOICE_NOT_FOUND');
      if (inv.status === 'VOID') {
        return err('Cannot pay a void invoice', 'INVALID_STATE');
      }

      const newAmountPaid = inv.amountPaid + dto.amount;
      let newStatus = inv.status;
      let paidAt: Date | null = inv.paidAt;
      if (newAmountPaid >= inv.total) {
        newStatus = 'PAID';
        paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      const [payment] = await this.prisma.$transaction([
        this.prisma.invoicePayment.create({
          data: {
            invoiceId,
            amount: dto.amount,
            paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
            method: dto.method ?? null,
            reference: dto.reference ?? null,
            notes: dto.notes ?? null,
            recordedById: userId,
          },
        }),
        this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
            paidAt,
          },
        }),
      ]);

      return ok({ payment, newStatus, newAmountPaid });
    } catch (e) {
      return err('Failed to record payment', 'PAYMENT_FAILED');
    }
  }

  /** "2026/0001" — incremented per gabinete per year. */
  private async nextInvoiceNumber(gabineteId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { gabineteId, number: { startsWith: `${year}/` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `${year}/${seq}`;
  }

  /**
   * Renders the invoice to a PDF buffer using pdfkit.
   */
  async exportPdf(gabineteId: string, id: string): Promise<Result<Buffer>> {
    try {
      const r = await this.findById(gabineteId, id);
      if (!r.success) return r as Result<Buffer>;
      const inv = r.data as any;

      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const done = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      // Header — gabinete
      doc
        .fontSize(18)
        .fillColor('#111')
        .text(inv.gabinete?.name ?? 'Gabinete', { align: 'left' });
      doc.fontSize(9).fillColor('#737373');
      if (inv.gabinete?.nif) doc.text(`NIF: ${inv.gabinete.nif}`);
      if (inv.gabinete?.address) doc.text(inv.gabinete.address);
      if (inv.gabinete?.email) doc.text(inv.gabinete.email);
      if (inv.gabinete?.phone) doc.text(inv.gabinete.phone);
      doc.moveDown(1);

      // Invoice title row
      doc
        .fontSize(22)
        .fillColor('#111')
        .text(`Factura ${inv.number}`, { align: 'right' });
      doc
        .fontSize(10)
        .fillColor('#737373')
        .text(
          `Emissão: ${new Date(inv.issueDate).toLocaleDateString('pt-AO')}`,
          { align: 'right' },
        );
      if (inv.dueDate) {
        doc.text(
          `Vencimento: ${new Date(inv.dueDate).toLocaleDateString('pt-AO')}`,
          { align: 'right' },
        );
      }
      doc.moveDown(1);

      // Cliente
      doc.fontSize(11).fillColor('#111').text('PARA:', { continued: false });
      doc.fontSize(11).fillColor('#111').text(inv.cliente.name);
      doc.fontSize(9).fillColor('#737373');
      if (inv.cliente.nif) doc.text(`NIF: ${inv.cliente.nif}`);
      if (inv.cliente.address) doc.text(inv.cliente.address);
      if (inv.cliente.email) doc.text(inv.cliente.email);
      doc.moveDown(1);

      // Items table
      const colDesc = 40;
      const colQty = 330;
      const colPrice = 400;
      const colTotal = 490;
      let y = doc.y;
      doc.fontSize(9).fillColor('#111');
      doc.text('Descrição', colDesc, y, { width: colQty - colDesc - 10 });
      doc.text('Qtd', colQty, y, { width: 50, align: 'right' });
      doc.text('Preço', colPrice, y, { width: 80, align: 'right' });
      doc.text('Total', colTotal, y, { width: 80, align: 'right' });
      y += 14;
      doc.moveTo(colDesc, y).lineTo(570, y).strokeColor('#E5E5E3').stroke();
      y += 6;

      doc.fontSize(9).fillColor('#333');
      for (const it of inv.items) {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }
        doc.text(it.description, colDesc, y, { width: colQty - colDesc - 10 });
        doc.text(
          Number(it.quantity).toLocaleString('pt-AO', {
            maximumFractionDigits: 2,
          }),
          colQty,
          y,
          { width: 50, align: 'right' },
        );
        doc.text(
          (it.unitPrice / 100).toLocaleString('pt-AO'),
          colPrice,
          y,
          { width: 80, align: 'right' },
        );
        doc.text((it.total / 100).toLocaleString('pt-AO'), colTotal, y, {
          width: 80,
          align: 'right',
        });
        const descHeight = doc.heightOfString(it.description, {
          width: colQty - colDesc - 10,
        });
        y += Math.max(14, descHeight + 4);
      }

      // Totals
      y += 10;
      doc.moveTo(colPrice, y).lineTo(570, y).strokeColor('#E5E5E3').stroke();
      y += 8;
      doc.fontSize(10).fillColor('#111');
      const writeTotalRow = (label: string, valueAkz: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, colPrice, y, { width: 80, align: 'right' });
        doc.text(valueAkz, colTotal, y, { width: 80, align: 'right' });
        y += 14;
      };
      writeTotalRow(
        'Subtotal',
        `${(inv.subtotal / 100).toLocaleString('pt-AO')} ${inv.currency}`,
      );
      writeTotalRow(
        `IVA (${inv.taxRate}%)`,
        `${(inv.taxAmount / 100).toLocaleString('pt-AO')} ${inv.currency}`,
      );
      writeTotalRow(
        'TOTAL',
        `${(inv.total / 100).toLocaleString('pt-AO')} ${inv.currency}`,
        true,
      );
      if (inv.amountPaid > 0) {
        writeTotalRow(
          'Pago',
          `${(inv.amountPaid / 100).toLocaleString('pt-AO')} ${inv.currency}`,
        );
        writeTotalRow(
          'Em dívida',
          `${((inv.total - inv.amountPaid) / 100).toLocaleString('pt-AO')} ${inv.currency}`,
          true,
        );
      }

      // Footer
      if (inv.notes) {
        doc.moveDown(2).font('Helvetica');
        doc.fontSize(9).fillColor('#737373').text('Notas:', colDesc);
        doc.fillColor('#333').text(inv.notes, colDesc);
      }
      if (inv.termsText) {
        doc.moveDown(1).font('Helvetica');
        doc.fontSize(9).fillColor('#737373').text('Termos & Condições:', colDesc);
        doc.fillColor('#333').text(inv.termsText, colDesc);
      }

      doc.end();
      const buffer = await done;
      return ok(buffer);
    } catch (e) {
      return err('Failed to export PDF', 'INVOICE_PDF_FAILED');
    }
  }
}
