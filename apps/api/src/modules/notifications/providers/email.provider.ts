import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface ProviderResult {
  status: 'SENT' | 'FAILED' | 'DRY_RUN';
  metadata?: any;
  errorMessage?: string;
}

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private resend: Resend | null = null;
  private fromEmail: string;
  public readonly isEnabled: boolean;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.fromEmail = config.get<string>(
      'RESEND_FROM_EMAIL',
      'Kamaia <alerts@kamaia.ao>',
    );
    this.isEnabled = !!apiKey;
    if (this.isEnabled) {
      this.resend = new Resend(apiKey);
      this.logger.log('Email provider enabled (Resend)');
    } else {
      this.logger.warn(
        'Email provider in DRY_RUN mode (RESEND_API_KEY not set)',
      );
    }
  }

  async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<ProviderResult> {
    if (!this.isEnabled || !this.resend) {
      this.logger.debug(`[DRY_RUN] Email to ${to}: ${subject}`);
      return {
        status: 'DRY_RUN',
        metadata: {
          reason: 'RESEND_API_KEY not configured',
          to,
          subject,
        },
      };
    }
    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
      return { status: 'SENT', metadata: { id: result.data?.id } };
    } catch (err: any) {
      this.logger.error(`Email send failed: ${err.message}`);
      return { status: 'FAILED', errorMessage: err.message };
    }
  }
}
