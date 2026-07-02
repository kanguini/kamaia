import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@kamaia/shared-types';

/**
 * Guard de operador da PLATAFORMA (não do tenant).
 *
 * Contexto (auditoria C7): o corpus de legislação (LegislationDocument)
 * é GLOBAL — todos os tenants consomem o mesmo acervo via Dr. Kamaia.
 * Proteger a escrita apenas com Role.ADMIN significava que o ADMIN de
 * QUALQUER tenant self-service podia envenenar a "lei" citada a todos
 * os outros (desinformação jurídica + prompt injection no contexto RAG).
 *
 * A escrita fica restrita à allowlist PLATFORM_ADMIN_EMAILS (emails
 * separados por vírgula, case-insensitive). FAIL-CLOSED: sem a env
 * definida, ninguém escreve — configurá-la no Railway é o acto
 * deliberado de nomear curadores do acervo.
 *
 * Usar SEMPRE em conjunto com JwtAuthGuard (lê request.user do JWT).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const raw = this.config.get<string>('PLATFORM_ADMIN_EMAILS', '');
    const allowlist = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (
      !user?.email ||
      allowlist.length === 0 ||
      !allowlist.includes(user.email.toLowerCase())
    ) {
      throw new ForbiddenException(
        'A curadoria da legislação é reservada a operadores da plataforma.',
      );
    }
    return true;
  }
}
