import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

export interface ProviderResult {
  status: 'SENT' | 'FAILED' | 'DRY_RUN';
  metadata?: any;
  errorMessage?: string;
}

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private twilio: Twilio | null = null;
  private fromNumber: string;
  public readonly isEnabled: boolean;

  constructor(config: ConfigService) {
    const sid = config.get<string>('TWILIO_ACCOUNT_SID');
    const token = config.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = config.get<string>('TWILIO_PHONE_NUMBER', '');
    this.isEnabled = !!(sid && token && this.fromNumber);
    if (this.isEnabled) {
      this.twilio = new Twilio(sid!, token!);
      this.logger.log('SMS provider enabled (Twilio)');
    } else {
      this.logger.warn('SMS provider in DRY_RUN mode (Twilio not configured)');
    }
  }

  async send(to: string, body: string): Promise<ProviderResult> {
    if (!this.isEnabled || !this.twilio) {
      this.logger.debug(`[DRY_RUN] SMS to ${to}: ${body}`);
      return {
        status: 'DRY_RUN',
        metadata: {
          reason: 'Twilio not configured',
          to,
          body,
        },
      };
    }
    try {
      const msg = await this.twilio.messages.create({
        from: this.fromNumber,
        to,
        body,
      });
      return { status: 'SENT', metadata: { sid: msg.sid } };
    } catch (err: any) {
      this.logger.error(`SMS send failed: ${err.message}`);
      return { status: 'FAILED', errorMessage: err.message };
    }
  }
}
