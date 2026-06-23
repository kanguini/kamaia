import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * Mailer — wrapper fino sobre Resend.
 *
 * Comportamento:
 *  - Se `RESEND_API_KEY` está definida no env → envia de verdade
 *  - Se ausente (dev local, preview, testes) → loga o conteúdo e
 *    devolve um objecto "stubbed" para os call-sites não terem de
 *    fazer null-checks. Nada quebra.
 *
 * Decisão: NÃO falhamos hard se o envio falhar — o convite ainda é
 * útil porque o owner pode copiar o URL e partilhar por outro canal
 * (WhatsApp, presencial). Logamos o erro e seguimos.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appUrl: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.resend = key ? new Resend(key) : null;
    this.fromAddress =
      process.env.MAIL_FROM ?? 'Kamaia <noreply@kamaia.cc>';
    this.appUrl =
      process.env.APP_URL ?? 'https://app.kamaia.cc';

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY ausente — emails serão logados em vez de enviados.',
      );
    }
  }

  /**
   * Envia o convite a um colaborador externo com o link mágico.
   * O caller passa o token raw (não o hash) — o URL é só montado aqui.
   */
  async sendColaboradorInvite(params: {
    to: string;
    nome?: string | null;
    contratoTitulo: string;
    contratoNumero?: string | null;
    tipoAcesso: string;
    inviterNome?: string | null;
    token: string;
    expiresAt: Date;
  }) {
    const url = `${this.appUrl}/c/${params.token}`;
    const subject = `Acesso ao contrato${params.contratoNumero ? ` ${params.contratoNumero}` : ''}: ${params.contratoTitulo}`;
    const html = renderInviteHtml({ ...params, url });

    if (!this.resend) {
      this.logger.log(
        `[STUB] Convite para ${params.to} — URL: ${url} (expira ${params.expiresAt.toISOString()})`,
      );
      return { ok: true, stubbed: true, url };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to: params.to,
        subject,
        html,
      });
      this.logger.log(`Convite enviado para ${params.to} (id=${result.data?.id})`);
      return { ok: true, stubbed: false, id: result.data?.id, url };
    } catch (err) {
      // Não bloqueia o fluxo — owner pode copiar URL e partilhar manualmente
      this.logger.error(
        `Falhou envio para ${params.to}: ${(err as Error).message}`,
      );
      return { ok: false, stubbed: false, url, error: (err as Error).message };
    }
  }

  /**
   * Envio genérico de email (sem template). Usado pelo
   * NotificationDeliveryWorker para entregar alertas in-app que o
   * tenant configurou como EMAIL.
   *
   * Mesmo padrão graceful: se Resend não configurado, loga e devolve
   * stubbed=true; se falha, devolve ok=false sem throw.
   */
  async sendGeneric(params: {
    to: string;
    subject: string;
    text: string;
  }): Promise<{ ok: boolean; stubbed: boolean; id?: string; error?: string }> {
    const html = `<pre style="font-family: -apple-system, sans-serif; white-space: pre-wrap;">${params.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`;

    if (!this.resend) {
      this.logger.log(`[STUB] Email para ${params.to}: ${params.subject}`);
      return { ok: true, stubbed: true };
    }
    try {
      const result = await this.resend.emails.send({
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html,
        text: params.text,
      });
      return { ok: true, stubbed: false, id: result.data?.id };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Falhou envio genérico para ${params.to}: ${msg}`);
      return { ok: false, stubbed: false, error: msg };
    }
  }
}

function renderInviteHtml(p: {
  to: string;
  nome?: string | null;
  contratoTitulo: string;
  contratoNumero?: string | null;
  tipoAcesso: string;
  inviterNome?: string | null;
  url: string;
  expiresAt: Date;
}): string {
  const saudacao = p.nome ? `Olá ${escapeHtml(p.nome)},` : 'Olá,';
  const quem = p.inviterNome ? `${escapeHtml(p.inviterNome)} convidou-te` : 'Foste convidado(a)';
  const acesso = ACESSO_DESC[p.tipoAcesso] ?? p.tipoAcesso.toLowerCase();
  const numero = p.contratoNumero ? ` (${escapeHtml(p.contratoNumero)})` : '';

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Convite Kamaia</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f7f9; padding: 24px; color: #1a1a1a;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 28px;">
    <div style="font-size: 12px; letter-spacing: 0.12em; color: #6b7280; text-transform: uppercase;">Kamaia · CLM</div>
    <h1 style="font-size: 20px; margin: 12px 0 18px; font-weight: 600;">Acesso a um contrato</h1>
    <p style="margin: 0 0 12px; line-height: 1.55;">${saudacao}</p>
    <p style="margin: 0 0 12px; line-height: 1.55;">
      ${quem} a aceder ao contrato <strong>${escapeHtml(p.contratoTitulo)}</strong>${numero} no Kamaia.
    </p>
    <p style="margin: 0 0 18px; line-height: 1.55; color: #4b5563;">
      Nível de acesso: <strong>${acesso}</strong>.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${p.url}" style="display: inline-block; background: #111827; color: #fff; padding: 11px 18px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Abrir contrato
      </a>
    </p>
    <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">
      Este link é único e expira em ${p.expiresAt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}.
    </p>
    <p style="margin: 0; font-size: 11px; color: #9ca3af; word-break: break-all;">
      Caso o botão não funcione: ${p.url}
    </p>
    <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e5e7eb;" />
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">
      Kamaia — sistema operativo dos contratos. Se não esperavas este email, ignora-o.
    </p>
  </div>
</body>
</html>`;
}

const ACESSO_DESC: Record<string, string> = {
  LEITURA: 'apenas leitura',
  COMENTARIO: 'leitura + comentários',
  ASSINATURA: 'leitura + comentários + assinatura',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
