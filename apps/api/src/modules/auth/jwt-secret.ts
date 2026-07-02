import { ConfigService } from '@nestjs/config';

/**
 * Resolução ÚNICA do JWT_SECRET — usada pelo JwtModule (assinatura) e
 * pela JwtStrategy (verificação). Auditoria: a strategy tinha o seu
 * próprio fallback ('change-me-in-prod'), diferente do fallback do
 * módulo — em dev sem JWT_SECRET, assinava-se com um segredo e
 * verificava-se com outro (auth 100% partida), e o verificador ficava
 * com um default fraco latente.
 *
 * Produção: falha HARD se ausente/curto. Dev: warning + fallback único.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  const isProd = config.get<string>('NODE_ENV') === 'production';
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
    return 'kamaia-dev-only-secret-please-replace-32chars!!';
  }
  return secret;
}
