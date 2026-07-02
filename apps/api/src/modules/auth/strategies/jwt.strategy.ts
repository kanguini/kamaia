import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { JwtPayload } from '@kamaia/shared-types';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { resolveJwtSecret } from '../jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Mesma resolução do JwtModule (assinatura) — ver jwt-secret.ts.
      secretOrKey: resolveJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload;
  }
}
