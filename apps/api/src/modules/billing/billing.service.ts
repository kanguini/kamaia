import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  Result,
  ok,
  err,
  SubscriptionPlan,
  AuditAction,
  EntityType,
} from '@kamaia/shared-types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

const PLAN_PRICE_MAP: Record<string, string> = {
  // These should be configured via env vars in production
  PRO_INDIVIDUAL: 'price_pro_individual',
  PRO_BUSINESS: 'price_pro_business',
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: any = null;
  private readonly isEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.isEnabled = !!secretKey;
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
      this.logger.log('Stripe billing enabled');
    } else {
      this.logger.warn('Stripe not configured — billing disabled');
    }

    // Override price IDs from env
    const proIndividualPrice = this.configService.get<string>('STRIPE_PRICE_PRO_INDIVIDUAL');
    const proBusinessPrice = this.configService.get<string>('STRIPE_PRICE_PRO_BUSINESS');
    if (proIndividualPrice) PLAN_PRICE_MAP.PRO_INDIVIDUAL = proIndividualPrice;
    if (proBusinessPrice) PLAN_PRICE_MAP.PRO_BUSINESS = proBusinessPrice;
  }

  async getCurrentPlan(
    gabineteId: string,
  ): Promise<Result<{
    plan: string;
    status: string;
    stripeCustomerId: string | null;
    currentPeriodEnd: Date | null;
  }>> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { gabineteId },
      });

      const gabinete = await this.prisma.gabinete.findUnique({
        where: { id: gabineteId },
        select: { plan: true },
      });

      return ok({
        plan: gabinete?.plan || 'FREE',
        status: subscription?.status || 'ACTIVE',
        stripeCustomerId: subscription?.stripeCustomerId || null,
        currentPeriodEnd: subscription?.currentPeriodEnd || null,
      });
    } catch (error) {
      return err('Failed to get plan', 'PLAN_FETCH_FAILED');
    }
  }

  async createCheckoutSession(
    gabineteId: string,
    userId: string,
    plan: 'PRO_INDIVIDUAL' | 'PRO_BUSINESS',
    successUrl: string,
    cancelUrl: string,
  ): Promise<Result<{ checkoutUrl: string }>> {
    if (!this.stripe || !this.isEnabled) {
      return err(
        'Stripe nao configurado. Configure STRIPE_SECRET_KEY.',
        'STRIPE_NOT_CONFIGURED',
      );
    }

    try {
      const priceId = PLAN_PRICE_MAP[plan];
      if (!priceId || priceId.startsWith('price_pro_')) {
        return err(
          'Preco Stripe nao configurado para este plano',
          'PRICE_NOT_CONFIGURED',
        );
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;
      const subscription = await this.prisma.subscription.findUnique({
        where: { gabineteId },
      });

      if (subscription?.stripeCustomerId) {
        stripeCustomerId = subscription.stripeCustomerId;
      } else {
        const gabinete = await this.prisma.gabinete.findUnique({
          where: { id: gabineteId },
          select: { name: true, email: true },
        });

        const customer = await this.stripe.customers.create({
          name: gabinete?.name || undefined,
          email: gabinete?.email || undefined,
          metadata: { gabineteId },
        });

        stripeCustomerId = customer.id;

        // Upsert subscription record
        const now = new Date();
        const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await this.prisma.subscription.upsert({
          where: { gabineteId },
          create: {
            gabineteId,
            plan: 'FREE',
            status: 'ACTIVE',
            stripeCustomerId,
            currentPeriodStart: now,
            currentPeriodEnd: oneMonthLater,
          },
          update: { stripeCustomerId },
        });
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { gabineteId, userId, plan },
      });

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.SUBSCRIPTION,
        entityId: gabineteId,
        userId,
        gabineteId,
        newValue: { plan, checkoutSessionId: session.id },
      });

      return ok({ checkoutUrl: session.url! });
    } catch (error) {
      this.logger.error(`Checkout failed: ${(error as Error).message}`);
      return err('Failed to create checkout', 'CHECKOUT_FAILED');
    }
  }

  async createPortalSession(
    gabineteId: string,
    returnUrl: string,
  ): Promise<Result<{ portalUrl: string }>> {
    if (!this.stripe || !this.isEnabled) {
      return err('Stripe nao configurado', 'STRIPE_NOT_CONFIGURED');
    }

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { gabineteId },
      });

      if (!subscription?.stripeCustomerId) {
        return err('Sem subscricao activa', 'NO_SUBSCRIPTION');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      });

      return ok({ portalUrl: session.url });
    } catch (error) {
      return err('Failed to create portal session', 'PORTAL_FAILED');
    }
  }

  async handleWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<Result<void>> {
    if (!this.stripe || !this.isEnabled) {
      return err('Stripe not configured', 'STRIPE_NOT_CONFIGURED');
    }

    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      return err('Webhook secret not configured', 'WEBHOOK_SECRET_MISSING');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const gabineteId = session.metadata?.gabineteId;
          const plan = session.metadata?.plan as SubscriptionPlan;

          if (gabineteId && plan) {
            await this.activatePlan(gabineteId, plan, session.subscription as string);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as any;
          const gabineteId = sub.metadata?.gabineteId;

          if (gabineteId) {
            await this.prisma.subscription.update({
              where: { gabineteId },
              data: {
                status: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
              },
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as any;
          const gabineteId = sub.metadata?.gabineteId;

          if (gabineteId) {
            await this.prisma.subscription.update({
              where: { gabineteId },
              data: { status: 'CANCELLED', plan: 'FREE' },
            });
            await this.prisma.gabinete.update({
              where: { id: gabineteId },
              data: { plan: 'FREE' },
            });
          }
          break;
        }
      }

      return ok(undefined);
    } catch (error) {
      this.logger.error(`Webhook error: ${(error as Error).message}`);
      return err('Webhook processing failed', 'WEBHOOK_FAILED');
    }
  }

  private async activatePlan(
    gabineteId: string,
    plan: SubscriptionPlan,
    stripeSubscriptionId: string,
  ) {
    await this.prisma.subscription.update({
      where: { gabineteId },
      data: {
        plan,
        status: 'ACTIVE',
        stripeSubscriptionId,
      },
    });

    await this.prisma.gabinete.update({
      where: { id: gabineteId },
      data: { plan },
    });

    this.logger.log(`Plan activated: ${plan} for gabinete ${gabineteId}`);
  }
}
