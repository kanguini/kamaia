import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Result, ok, err } from '@kamaia/shared-types';
import * as crypto from 'crypto';

@Injectable()
export class PortalService {
  private readonly portalSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.portalSecret =
      this.configService.get<string>('PORTAL_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'kamaia-portal-secret';
  }

  /**
   * Generate a portal access token for a client.
   * The token is a signed HMAC of clienteId + gabineteId + expiry.
   */
  generateAccessToken(
    clienteId: string,
    gabineteId: string,
    expiresInHours: number = 720, // 30 days default
  ): { token: string; expiresAt: Date } {
    const expiresAt = new Date(
      Date.now() + expiresInHours * 60 * 60 * 1000,
    );
    const payload = `${clienteId}:${gabineteId}:${expiresAt.getTime()}`;
    const signature = crypto
      .createHmac('sha256', this.portalSecret)
      .update(payload)
      .digest('hex');

    const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
    return { token, expiresAt };
  }

  /**
   * Validate a portal access token and return clienteId + gabineteId.
   */
  validateAccessToken(
    token: string,
  ): Result<{ clienteId: string; gabineteId: string }> {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');

      if (parts.length !== 4) {
        return err('Token invalido', 'INVALID_TOKEN');
      }

      const [clienteId, gabineteId, expiryStr, signature] = parts;
      const expiry = parseInt(expiryStr, 10);

      if (Date.now() > expiry) {
        return err('Token expirado', 'TOKEN_EXPIRED');
      }

      const payload = `${clienteId}:${gabineteId}:${expiryStr}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.portalSecret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        return err('Token invalido', 'INVALID_TOKEN');
      }

      return ok({ clienteId, gabineteId });
    } catch {
      return err('Token invalido', 'INVALID_TOKEN');
    }
  }

  /**
   * Get client portal overview — their data, processos, prazos.
   */
  async getPortalOverview(
    clienteId: string,
    gabineteId: string,
  ): Promise<Result<any>> {
    try {
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: clienteId, gabineteId, deletedAt: null },
        select: {
          id: true,
          name: true,
          type: true,
          email: true,
          phone: true,
        },
      });

      if (!cliente) {
        return err('Cliente nao encontrado', 'CLIENTE_NOT_FOUND');
      }

      const processos = await this.prisma.processo.findMany({
        where: { clienteId, gabineteId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          processoNumber: true,
          title: true,
          type: true,
          status: true,
          stage: true,
          priority: true,
          court: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const processoIds = processos.map((p) => p.id);

      const prazos = processoIds.length
        ? await this.prisma.prazo.findMany({
            where: {
              processoId: { in: processoIds },
              gabineteId,
              deletedAt: null,
            },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              dueDate: true,
              processo: {
                select: { title: true, processoNumber: true },
              },
            },
          })
        : [];

      const documents = processoIds.length
        ? await this.prisma.document.findMany({
            where: {
              processoId: { in: processoIds },
              gabineteId,
              deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              category: true,
              fileSize: true,
              createdAt: true,
            },
          })
        : [];

      return ok({
        cliente,
        processos,
        prazos,
        documents,
        stats: {
          totalProcessos: processos.length,
          activeProcessos: processos.filter((p) => p.status === 'ACTIVO')
            .length,
          pendingPrazos: prazos.filter((p) => p.status === 'PENDENTE').length,
          totalDocuments: documents.length,
        },
      });
    } catch (error) {
      return err('Failed to load portal', 'PORTAL_LOAD_FAILED');
    }
  }

  /**
   * Get a specific processo detail for the client.
   */
  async getPortalProcesso(
    clienteId: string,
    gabineteId: string,
    processoId: string,
  ): Promise<Result<any>> {
    try {
      const processo = await this.prisma.processo.findFirst({
        where: {
          id: processoId,
          clienteId,
          gabineteId,
          deletedAt: null,
        },
        include: {
          prazos: {
            where: { deletedAt: null },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              dueDate: true,
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              type: true,
              description: true,
              createdAt: true,
            },
          },
          documents: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              category: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
      });

      if (!processo) {
        return err('Processo nao encontrado', 'PROCESSO_NOT_FOUND');
      }

      return ok(processo);
    } catch (error) {
      return err('Failed to load processo', 'PROCESSO_LOAD_FAILED');
    }
  }
}
