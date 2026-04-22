import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ParseZodPipe } from '../../common/pipes/parse-zod.pipe';
import {
  createPublicContactSchema,
  type CreatePublicContactDto,
} from './public-contacts.dto';
import { PublicContactsService } from './public-contacts.service';

@Controller('public-contacts')
export class PublicContactsController {
  constructor(private readonly service: PublicContactsService) {}

  // Público: sem auth, mas com rate-limit agressivo por IP.
  // Limite tight: 3 submissões / hora / IP — suficiente para um advogado
  // genuíno a testar o formulário, bloqueia bots em massa.
  @Post()
  @HttpCode(200)
  @Throttle({
    short: { limit: 3, ttl: 3600_000 },
    long: { limit: 10, ttl: 86_400_000 },
  })
  @UsePipes(new ParseZodPipe(createPublicContactSchema))
  async submit(
    @Body() dto: CreatePublicContactDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    // Cloudflare / Railway proxy sets cf-connecting-ip or x-forwarded-for.
    const realIp =
      cfIp?.trim() || xff?.split(',')[0]?.trim() || ip;

    const { id } = await this.service.submit(dto, {
      ipAddress: realIp,
      userAgent,
    });

    return { ok: true, id };
  }
}
