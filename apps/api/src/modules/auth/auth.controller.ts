import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  loginWithProviderSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  LoginDto,
  RegisterDto,
  RefreshDto,
  LoginWithProviderDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.dto';
import { JwtPayload } from '@kamaia/shared-types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ParseZodPipe(registerSchema)) dto: RegisterDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.register(dto, ip, userAgent);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'REGISTRATION_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Post('login')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async login(
    @Body(new ParseZodPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(dto, ip, userAgent);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'LOGIN_FAILED',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { data: result.data };
  }

  @Post('login-with-provider')
  async loginWithProvider(
    @Body(new ParseZodPipe(loginWithProviderSchema)) dto: LoginWithProviderDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.loginWithProvider(dto, ip, userAgent);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'PROVIDER_LOGIN_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: result.data };
  }

  @Post('forgot-password')
  @Throttle({ short: { ttl: 60000, limit: 3 } })
  async forgotPassword(
    @Body(new ParseZodPipe(forgotPasswordSchema)) dto: ForgotPasswordDto,
  ) {
    // Always 200 — don't leak whether the email exists.
    await this.authService.forgotPassword(dto.email);
    return { data: { sent: true } };
  }

  @Post('reset-password')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async resetPassword(
    @Body(new ParseZodPipe(resetPasswordSchema)) dto: ResetPasswordDto,
  ) {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code || 'RESET_FAILED' },
        result.code === 'INVALID_TOKEN' ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_REQUEST,
      );
    }
    return { data: { success: true } };
  }

  @Post('refresh')
  async refresh(@Body(new ParseZodPipe(refreshSchema)) dto: RefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'REFRESH_FAILED',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { data: result.data };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, GabineteGuard)
  async logout(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.logout(user.sub, ip, userAgent);

    if (!result.success) {
      throw new HttpException(
        {
          error: result.error,
          code: result.code || 'LOGOUT_FAILED',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { data: { success: true } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, GabineteGuard)
  async getMe(@CurrentUser() user: JwtPayload) {
    return { data: user };
  }
}
