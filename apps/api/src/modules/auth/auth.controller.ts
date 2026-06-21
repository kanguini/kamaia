import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import { LoginDto, LoginSchema, RegisterDto, RegisterSchema } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ParseZodPipe(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
  ) {
    return this.auth.register(dto, req.ip);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ParseZodPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
  ) {
    return this.auth.login(dto, req.ip, req.get('user-agent'));
  }
}
