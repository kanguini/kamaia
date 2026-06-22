import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ColaboradorTipoAcesso } from '@kamaia/shared-types';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Colaboradores externos por contrato — scoped EXTERNAL access.
 *
 * Fluxo:
 *  1. Owner cria colaborador → `create()` gera token + retorna URL com token raw
 *     (devolvido uma única vez, server só guarda hash)
 *  2. Owner partilha URL por email/WhatsApp (Resend stub se ausente)
 *  3. Colaborador acede a `/c/<token>` → backend valida hash + TTL
 *  4. Comentários e assinaturas associados a `colaboradorId`
 *
 * O token tem prefixo legível (8 chars) + secret (32 chars).
 * Formato URL: `https://app.kamaia.cc/c/<prefix>-<secret>`
 */
@Injectable()
export class ContratoColaboradoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoColaborador.findMany({
      where: { contratoId },
      orderBy: { convidadoEm: 'desc' },
      // Nunca devolver o tokenHash — só metadados visíveis ao owner
      select: {
        id: true,
        email: true,
        nome: true,
        tipoAcesso: true,
        estado: true,
        tokenPrefix: true,
        expiresAt: true,
        convidadoPor: true,
        convidadoEm: true,
        aceitouEm: true,
        revogadoEm: true,
        ultimaActividade: true,
        ipAddress: true,
      },
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      email: string;
      nome?: string;
      tipoAcesso: ColaboradorTipoAcesso;
      ttlDias?: number;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    // Gera token: prefix-secret
    const prefix = randomBytes(4).toString('hex');          // 8 chars
    const secret = randomBytes(24).toString('base64url');   // ~32 chars
    const token = `${prefix}-${secret}`;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const ttl = Math.min(dto.ttlDias ?? 30, 365);
    const expiresAt = new Date(Date.now() + ttl * 86400000);

    const col = await this.prisma.contratoColaborador.create({
      data: {
        contratoId,
        email: dto.email.toLowerCase().trim(),
        nome: dto.nome?.trim(),
        tipoAcesso: dto.tipoAcesso,
        tokenHash,
        tokenPrefix: prefix,
        expiresAt,
        convidadoPor: actorUserId,
      },
      select: {
        id: true,
        email: true,
        nome: true,
        tipoAcesso: true,
        estado: true,
        tokenPrefix: true,
        expiresAt: true,
        convidadoPor: true,
        convidadoEm: true,
      },
    });

    await this.webhooks.enqueueEvent(tenantId, 'contrato.colaborador_convidado', {
      contratoId,
      colaboradorId: col.id,
      email: col.email,
      tipoAcesso: col.tipoAcesso,
    });

    // Token devolvido UMA ÚNICA VEZ — owner mostra/copia.
    return { ...col, token };
  }

  async revogar(
    tenantId: string,
    _actorUserId: string,
    contratoId: string,
    colaboradorId: string,
  ) {
    await this.assertContrato(tenantId, contratoId);
    const col = await this.prisma.contratoColaborador.findFirst({
      where: { id: colaboradorId, contratoId },
    });
    if (!col) throw new NotFoundException('Colaborador not found');

    return this.prisma.contratoColaborador.update({
      where: { id: colaboradorId },
      data: {
        estado: 'REVOGADO',
        revogadoEm: new Date(),
      },
      select: {
        id: true, estado: true, revogadoEm: true,
      },
    });
  }

  /**
   * Resolução do token na rota pública `/c/<token>`.
   * Valida hash, TTL, estado. Devolve colaborador + contratoId.
   */
  async resolveToken(token: string, ip?: string, userAgent?: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const col = await this.prisma.contratoColaborador.findUnique({
      where: { tokenHash },
      include: {
        contrato: { select: { id: true, tenantId: true, numeroInterno: true, titulo: true } },
      },
    });
    if (!col) throw new UnauthorizedException('Token inválido');
    if (col.estado === 'REVOGADO') {
      throw new UnauthorizedException('Acesso revogado pelo proprietário');
    }
    if (col.expiresAt < new Date()) {
      // Marca como expirado se ainda não foi
      if (col.estado !== 'EXPIRADO') {
        await this.prisma.contratoColaborador.update({
          where: { id: col.id },
          data: { estado: 'EXPIRADO' },
        });
      }
      throw new UnauthorizedException('Acesso expirado');
    }

    // Marca primeiro acesso e regista actividade
    await this.prisma.contratoColaborador.update({
      where: { id: col.id },
      data: {
        estado: col.estado === 'PENDENTE' ? 'ACTIVO' : col.estado,
        aceitouEm: col.aceitouEm ?? new Date(),
        ultimaActividade: new Date(),
        ipAddress: ip ?? col.ipAddress,
        userAgent: userAgent ?? col.userAgent,
      },
    });

    return {
      colaboradorId: col.id,
      contratoId: col.contratoId,
      tenantId: col.contrato.tenantId,
      tipoAcesso: col.tipoAcesso,
      nome: col.nome,
      email: col.email,
      contrato: {
        numeroInterno: col.contrato.numeroInterno,
        titulo: col.contrato.titulo,
      },
    };
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    return c;
  }

  /** Garante que o colaborador tem o tipo de acesso suficiente. */
  static assertAccess(actual: ColaboradorTipoAcesso, required: ColaboradorTipoAcesso) {
    const order = ['LEITURA', 'COMENTARIO', 'ASSINATURA'] as const;
    if (order.indexOf(actual) < order.indexOf(required)) {
      throw new BadRequestException(
        `Acesso ${actual} insuficiente; requer ${required}.`,
      );
    }
  }
}
