import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { z } from 'zod';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { LoginDto, LoginSchema, RegisterDto, RegisterSchema } from './auth.dto';
import { AuthService } from './auth.service';

const ForgotPasswordSchema = z.object({
  email: z.string().email().max(200),
});
const ResetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(200),
});

/**
 * AUDIT fix: rate limits dedicados (mais restritivos que o global
 * 10/min) — brute-force de credenciais fica inviável mesmo se o
 * atacante alterna User-Agent / IPs próximos. Justificação por
 * endpoint:
 *  - login: 5 tentativas/min por IP — alinhado com lockout de 5
 *    failed attempts no service
 *  - register: 3 tentativas/min por IP — evita enumeração via timing
 *    e criação massiva de contas
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Body(new ParseZodPipe(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
  ) {
    return this.auth.register(dto, req.ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ParseZodPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
  ) {
    return this.auth.login(dto, req.ip, req.get('user-agent'));
  }

  /**
   * Inicia recuperação de palavra-passe. Resposta uniforme (sucesso
   * mesmo quando email não existe) para evitar enumeração.
   *
   * Rate-limit agressivo (3/min por IP) — o caller honesto não
   * precisa de mais; o abusivo é travado.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(
    @Body(new ParseZodPipe(ForgotPasswordSchema))
    dto: z.infer<typeof ForgotPasswordSchema>,
  ) {
    return this.auth.forgotPassword(dto.email);
  }

  /**
   * Consome token de recuperação e define nova palavra-passe.
   * Erro com `code: 'INVALID_TOKEN'` quando token expirou/foi
   * usado — UI mostra mensagem para pedir novo link.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Body(new ParseZodPipe(ResetPasswordSchema))
    dto: z.infer<typeof ResetPasswordSchema>,
  ) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }
}
