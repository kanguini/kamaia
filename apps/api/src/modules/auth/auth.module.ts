import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { resolveJwtSecret } from './jwt-secret';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Resolução única (assinatura + verificação) — ver jwt-secret.ts.
        // Produção falha hard sem JWT_SECRET; dev usa fallback comum.
        secret: resolveJwtSecret(config),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
    }),
    AuditModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
