import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { LoginDto, LoginSchema, RegisterDto, RegisterSchema } from './auth.dto';
import { AuthService } from './auth.service';

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
}
