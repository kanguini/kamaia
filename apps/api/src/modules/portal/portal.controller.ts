import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PortalService } from './portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GabineteGuard } from '../../common/guards/gabinete.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GabineteId } from '../../common/decorators/gabinete-id.decorator';
import { KamaiaRole } from '@kamaia/shared-types';

@Controller('portal')
export class PortalController {
  constructor(private portalService: PortalService) {}

  // ── Generate access link (authenticated, for lawyers) ──
  @Post('generate-link/:clienteId')
  @UseGuards(JwtAuthGuard, GabineteGuard, RolesGuard)
  @Roles(KamaiaRole.SOCIO_GESTOR, KamaiaRole.ADVOGADO_SOLO)
  async generateLink(
    @GabineteId() gabineteId: string,
    @Param('clienteId') clienteId: string,
  ) {
    const { token, expiresAt } = this.portalService.generateAccessToken(
      clienteId,
      gabineteId,
    );

    return {
      data: {
        token,
        expiresAt,
        url: `/portal?token=${token}`,
      },
    };
  }

  // ── Public portal endpoints (token-based auth) ─────────

  @Get('overview')
  async getOverview(@Query('token') token: string) {
    if (!token) {
      throw new HttpException(
        { error: 'Token obrigatorio', code: 'MISSING_TOKEN' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validation = this.portalService.validateAccessToken(token);
    if (!validation.success) {
      throw new HttpException(
        { error: validation.error, code: validation.code },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { clienteId, gabineteId } = validation.data;
    const result = await this.portalService.getPortalOverview(
      clienteId,
      gabineteId,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'CLIENTE_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }

  @Get('processo/:id')
  async getProcesso(
    @Param('id') processoId: string,
    @Query('token') token: string,
  ) {
    if (!token) {
      throw new HttpException(
        { error: 'Token obrigatorio', code: 'MISSING_TOKEN' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validation = this.portalService.validateAccessToken(token);
    if (!validation.success) {
      throw new HttpException(
        { error: validation.error, code: validation.code },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { clienteId, gabineteId } = validation.data;
    const result = await this.portalService.getPortalProcesso(
      clienteId,
      gabineteId,
      processoId,
    );

    if (!result.success) {
      throw new HttpException(
        { error: result.error, code: result.code },
        result.code === 'PROCESSO_NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return { data: result.data };
  }
}
