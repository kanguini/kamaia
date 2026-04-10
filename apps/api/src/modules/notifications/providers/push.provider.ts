import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';

export interface ProviderResult {
  status: 'SENT' | 'FAILED' | 'DRY_RUN';
  metadata?: any;
  errorMessage?: string;
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);
  public readonly isEnabled: boolean;
  public readonly publicKey: string;

  constructor(config: ConfigService) {
    this.publicKey = config.get<string>('VAPID_PUBLIC_KEY', '');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY', '');
    const subject = config.get<string>(
      'VAPID_SUBJECT',
      'mailto:alerts@kamaia.ao',
    );
    this.isEnabled = !!(this.publicKey && privateKey);
    if (this.isEnabled) {
      webpush.setVapidDetails(subject, this.publicKey, privateKey);
      this.logger.log('Push provider enabled (VAPID)');
    } else {
      this.logger.warn('Push provider in DRY_RUN mode');
    }
  }

  async sendToSubscription(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: { title: string; body: string; url?: string; icon?: string },
  ): Promise<ProviderResult> {
    if (!this.isEnabled) {
      this.logger.debug(
        `[DRY_RUN] Push to ${subscription.endpoint}: ${payload.title}`,
      );
      return {
        status: 'DRY_RUN',
        metadata: { reason: 'VAPID not configured', payload },
      };
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        },
        JSON.stringify(payload),
      );
      return { status: 'SENT', metadata: {} };
    } catch (err: any) {
      this.logger.error(`Push send failed: ${err.message}`);
      // 410 Gone = subscription expired
      const expired = err.statusCode === 410 || err.statusCode === 404;
      return {
        status: 'FAILED',
        errorMessage: err.message,
        metadata: { expired, statusCode: err.statusCode },
      };
    }
  }
}
