import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { KamaiaRole, JwtPayload } from '@kamaia/shared-types';
import {
  createCheckoutSchema,
  CreateCheckoutDto,
  portalSessionSchema,
  PortalSessionDto,
} from './billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plan')
  @UseGuards(JwtAuthGuard, GabineteGuard)
  async getCurrentPlan(@GabineteId() gabineteId: string) {
    const result = await this.billingService.getCurrentPlan(gabineteId);

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, GabineteGuard, RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async createCheckout(
    @GabineteId() gabineteId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ParseZodPipe(createCheckoutSchema)) body: CreateCheckoutDto,
  ) {
    const result = await this.billingService.createCheckoutSession(
      gabineteId,
      user.sub,
      body.plan,
      body.successUrl,
      body.cancelUrl,
    );

    if (!result.success) {
      const status =
        result.code === 'STRIPE_NOT_CONFIGURED' || result.code === 'PRICE_NOT_CONFIGURED'
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.BAD_REQUEST;

      throw new HttpException(
        { error: result.error, code: result.code },
        status,
      );
    }

    return { data: result.data };
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard, GabineteGuard, RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR)
  async createPortalSession(
    @GabineteId() gabineteId: string,
    @Body(new ParseZodPipe(portalSessionSchema)) body: PortalSessionDto,
  ) {
    const result = await this.billingService.createPortalSession(
      gabineteId,
      body.returnUrl,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'NO_SUBSCRIPTION'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { data: result.data };
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    const payload = req.rawBody;
    if (!payload) {
      return res.status(400).json({ error: 'Missing raw body' });
    }

    const result = await this.billingService.handleWebhook(payload, signature);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ received: true });
  }
}
