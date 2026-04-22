import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import type { CreatePublicContactDto } from './public-contacts.dto';

interface SubmitContext {
  ipAddress?: string;
  userAgent?: string;
}

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

@Injectable()
export class PublicContactsService {
  private readonly logger = new Logger(PublicContactsService.name);
  private readonly turnstileSecret: string | undefined;
  private readonly notifyEmail: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
    config: ConfigService,
  ) {
    this.turnstileSecret = config.get<string>('TURNSTILE_SECRET_KEY');
    this.notifyEmail = config.get<string>(
      'CONTACT_NOTIFY_EMAIL',
      'heldermaiato@outlook.com',
    );

    if (!this.turnstileSecret) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY not set — CAPTCHA verification will be bypassed (dev mode only)',
      );
    }
  }

  async submit(dto: CreatePublicContactDto, ctx: SubmitContext) {
    // 1) Verify Cloudflare Turnstile token
    await this.verifyTurnstile(dto.turnstileToken, ctx.ipAddress);

    // 2) Persist to DB (source of truth — email is best-effort)
    const submission = await this.prisma.publicContactSubmission.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        gabinete: dto.gabinete?.trim() || null,
        plan: dto.plan?.trim() || null,
        message: dto.message.trim(),
        consentedAt: new Date(),
        ipAddress: ctx.ipAddress?.slice(0, 50) || null,
        userAgent: ctx.userAgent?.slice(0, 500) || null,
        emailStatus: 'PENDING',
      },
    });

    // 3) Fire-and-update email dispatch
    this.dispatchEmail(submission.id, dto).catch((err) => {
      this.logger.error(
        `Unexpected failure dispatching contact email ${submission.id}: ${err?.message || err}`,
      );
    });

    return { id: submission.id };
  }

  private async verifyTurnstile(token: string, ip?: string): Promise<void> {
    if (!this.turnstileSecret) {
      // Dev/fallback: accept if no secret configured. In production Railway
      // will always have the secret set and this branch never executes.
      return;
    }
    try {
      const body = new URLSearchParams();
      body.set('secret', this.turnstileSecret);
      body.set('response', token);
      if (ip) body.set('remoteip', ip);

      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      const data = (await res.json()) as TurnstileResponse;

      if (!data.success) {
        this.logger.warn(
          `Turnstile rejected: ${(data['error-codes'] || []).join(',')}`,
        );
        throw new BadRequestException({
          error: 'CAPTCHA_FAILED',
          code: 'CAPTCHA_FAILED',
          message: 'Verificação anti-bot falhou. Recarrega a página e tenta novamente.',
        });
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Turnstile verify error: ${err?.message || err}`);
      throw new BadRequestException({
        error: 'CAPTCHA_ERROR',
        code: 'CAPTCHA_ERROR',
        message: 'Não foi possível validar a verificação anti-bot. Tenta novamente.',
      });
    }
  }

  private async dispatchEmail(id: string, dto: CreatePublicContactDto) {
    const subject = `[Kamaia] Novo contacto de ${dto.name}`;
    const html = this.buildEmailHtml(dto);

    const result = await this.email.send(this.notifyEmail, subject, html);

    await this.prisma.publicContactSubmission.update({
      where: { id },
      data: {
        emailStatus: result.status,
        emailError: result.errorMessage || null,
      },
    });
  }

  private buildEmailHtml(dto: CreatePublicContactDto): string {
    const rows = [
      ['Nome', dto.name],
      ['Email', dto.email],
      dto.phone ? ['Telefone', dto.phone] : null,
      dto.gabinete ? ['Gabinete', dto.gabinete] : null,
      dto.plan ? ['Plano interessado', dto.plan] : null,
    ].filter(Boolean) as [string, string][];

    const tr = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 10px;border:1px solid #eee"><strong>${escape(
            k,
          )}</strong></td><td style="padding:6px 10px;border:1px solid #eee">${escape(v)}</td></tr>`,
      )
      .join('');

    return `
      <h2>Novo contacto do site</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${tr}</table>
      <h3>Mensagem</h3>
      <p style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">${escape(
        dto.message,
      )}</p>
      <hr/>
      <p style="color:#888;font-size:12px">Enviado via kamaia.cc · RGPD/Lei 22/11 consentimento recolhido.</p>
    `.trim();
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
