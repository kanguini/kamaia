import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Global porque o mailer é usado por vários domínios (convites,
 * notificações de vencimento, reset de password, etc.). Evita ter
 * de importar em cada módulo.
 */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
