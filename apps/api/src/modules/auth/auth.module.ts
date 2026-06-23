import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        // AUDIT fix: nunca cair em 'change-me-in-prod' silenciosamente.
        // Em produção, falha hard se JWT_SECRET ausente; em dev, gera
        // um warning visível ao arrancar.
        if (!secret || secret.length < 32) {
          if (isProd) {
            throw new Error(
              'JWT_SECRET ausente ou demasiado curto (<32 chars) — produção bloqueada por segurança.',
            );
          }
          // eslint-disable-next-line no-console
          console.warn(
            '[AUTH] ⚠ JWT_SECRET ausente/curto. A usar fallback de desenvolvimento — NÃO usar em produção.',
          );
        }
        return {
          secret: secret ?? 'kamaia-dev-only-secret-please-replace-32chars!!',
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h'),
          },
        };
      },
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
