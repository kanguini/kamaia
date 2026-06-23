import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Role, TenantContext } from '@kamaia/shared-types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ContratoPdfService } from './pdf.service';
import { ContratoColaboradoresService } from '../colaboradores/colaboradores.service';

/**
 * Dois endpoints para o PDF:
 *
 *  1. GET /contratos/:id/pdf            — autenticado (owner/equipa)
 *  2. GET /c/:token/pdf                 — público (colaborador externo)
 *
 * Ambos servem o mesmo `application/pdf` em streaming. Não persistimos
 * o ficheiro — é regenerado on-demand. Vantagem: PDF reflecte sempre o
 * estado actual (corpo + assinaturas registadas até esse momento) e
 * não pagamos storage por algo barato de re-render.
 */

@Controller('contratos/:contratoId/pdf')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ContratoPdfController {
  constructor(private readonly pdf: ContratoPdfService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.LEGAL_LEAD,
    Role.CONTRACT_MANAGER,
    Role.BUSINESS_USER,
    Role.VIEWER,
  )
  @Header('Content-Type', 'application/pdf')
  async download(
    @Tenant() tenant: TenantContext,
    @Param('contratoId', new ParseUUIDPipe()) contratoId: string,
    @Res() res: Response,
  ) {
    const buf = await this.pdf.gerar(tenant.tenantId, contratoId);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="contrato-${contratoId.slice(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}

/**
 * Variante pública: acessível só via magic-link token (sem JWT).
 * Útil para o colaborador externo guardar uma cópia depois de assinar.
 */
@Controller('c/:token/pdf')
export class ContratoPdfPublicController {
  constructor(
    private readonly pdf: ContratoPdfService,
    private readonly colaboradores: ContratoColaboradoresService,
  ) {}

  /**
   * AUDIT.12: rate limit dedicado para a rota pública. PDF é
   * CPU-intensivo (pdfkit + render markdown + tabelas + imagem
   * base64 da assinatura) — sem throttle, atacante com token válido
   * podia exaurir CPU repetindo o pedido. 5 req/min por IP é
   * generoso para uso humano (rever PDF) e estanca abuso.
   */
  @Get()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Content-Type', 'application/pdf')
  async download(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const ctx = await this.colaboradores.resolveToken(token);
    const buf = await this.pdf.gerar(ctx.tenantId, ctx.contratoId);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="contrato-${ctx.contratoId.slice(0, 8)}.pdf"`,
    );
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}
