import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AssinaturaMetodo,
  ColaboradorTipoAcesso,
  ComentarioAutorTipo,
} from '@kamaia/shared-types';
import { z } from 'zod';
import { ParseZodPipe } from '../../../common/pipes/parse-zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { ContratoAssinaturasService } from '../assinaturas/assinaturas.service';
import { ContratoComentariosService } from '../comentarios/comentarios.service';
import { ContratoColaboradoresService } from './colaboradores.service';

/**
 * Rota PÚBLICA para colaboradores externos (sem JwtAuthGuard).
 * Toda a auth é via token no path: `/api/c/<token>/*`.
 *
 * Usar isto para:
 *   - GET /c/:token              — resolver token + obter contrato (read-only)
 *   - GET /c/:token/comentarios  — listar comentários
 *   - POST /c/:token/comentarios — adicionar comentário (se tipoAcesso >= COMENTARIO)
 *   - POST /c/:token/assinar     — assinar (se tipoAcesso = ASSINATURA)
 */
const CreateComentarioPublicSchema = z.object({
  clausulaRef: z.string().min(1).max(200),
  texto: z.string().min(1).max(5000),
  versaoId: z.string().uuid().optional(),
  parentComentarioId: z.string().uuid().optional(),
});

const AssinarPublicSchema = z.object({
  versaoId: z.string().uuid(),
  metodo: z.nativeEnum(AssinaturaMetodo),
  signatarioNome: z.string().min(2).max(200),
  signatarioBI: z.string().max(40).optional(),
  cargo: z.string().max(100).optional(),
  imagemBase64: z.string().optional(),
});

@Controller('c/:token')
export class ContratoPublicoController {
  constructor(
    private readonly colaboradores: ContratoColaboradoresService,
    private readonly comentarios: ContratoComentariosService,
    private readonly assinaturas: ContratoAssinaturasService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve o token e devolve contrato em modo leitura (sem campos
   * sensíveis do tenant tipo audit log, outras partes não relacionadas).
   */
  @Get()
  async get(
    @Param('token') token: string,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ctx = await this.colaboradores.resolveToken(
      token,
      req.ip,
      userAgent,
    );

    const contrato = await this.prisma.contrato.findUnique({
      where: { id: ctx.contratoId },
      include: {
        tipo: { select: { codigo: true, nome: true, categoria: true } },
        versoes: {
          orderBy: { ordem: 'desc' },
          take: 1,
          select: {
            id: true,
            versao: true,
            corpoMarkdown: true,
            corpoHtml: true,
            createdAt: true,
          },
        },
        partes: {
          select: {
            id: true,
            papel: true,
            entidade: { select: { nome: true, tipo: true } },
          },
        },
      },
    });
    if (!contrato) {
      return { error: 'Contrato indisponível' };
    }

    return {
      colaborador: {
        id: ctx.colaboradorId,
        nome: ctx.nome,
        email: ctx.email,
        tipoAcesso: ctx.tipoAcesso,
      },
      contrato: {
        id: contrato.id,
        numeroInterno: contrato.numeroInterno,
        titulo: contrato.titulo,
        descricao: contrato.descricao,
        tipo: contrato.tipo,
        estado: contrato.estado,
        valor: contrato.valor?.toString(),
        moeda: contrato.moeda,
        leiAplicavel: contrato.leiAplicavel,
        foro: contrato.foro,
        dataAssinatura: contrato.dataAssinatura,
        dataInicioVigencia: contrato.dataInicioVigencia,
        dataTermo: contrato.dataTermo,
        partes: contrato.partes,
        versaoActual: contrato.versoes[0] ?? null,
      },
    };
  }

  @Get('comentarios')
  async listComentarios(@Param('token') token: string) {
    const ctx = await this.colaboradores.resolveToken(token);
    return this.comentarios.list(ctx.contratoId);
  }

  @Post('comentarios')
  async comentar(
    @Param('token') token: string,
    @Body(new ParseZodPipe(CreateComentarioPublicSchema))
    dto: z.infer<typeof CreateComentarioPublicSchema>,
    @Req() req: Request,
  ) {
    const ctx = await this.colaboradores.resolveToken(token, req.ip);
    ContratoColaboradoresService.assertAccess(
      ctx.tipoAcesso as ColaboradorTipoAcesso,
      ColaboradorTipoAcesso.COMENTARIO,
    );
    return this.comentarios.create({
      contratoId: ctx.contratoId,
      tenantId: ctx.tenantId,
      versaoId: dto.versaoId,
      clausulaRef: dto.clausulaRef,
      parentComentarioId: dto.parentComentarioId,
      autorTipo: ComentarioAutorTipo.COLABORADOR,
      autorColaboradorId: ctx.colaboradorId,
      autorNome: ctx.nome ?? ctx.email,
      texto: dto.texto,
    });
  }

  @Post('assinar')
  async assinar(
    @Param('token') token: string,
    @Body(new ParseZodPipe(AssinarPublicSchema))
    dto: z.infer<typeof AssinarPublicSchema>,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ctx = await this.colaboradores.resolveToken(token, req.ip, userAgent);
    ContratoColaboradoresService.assertAccess(
      ctx.tipoAcesso as ColaboradorTipoAcesso,
      ColaboradorTipoAcesso.ASSINATURA,
    );
    return this.assinaturas.assinar({
      contratoId: ctx.contratoId,
      tenantId: ctx.tenantId,
      versaoId: dto.versaoId,
      colaboradorId: ctx.colaboradorId,
      signatarioNome: dto.signatarioNome,
      signatarioEmail: ctx.email,
      signatarioBI: dto.signatarioBI,
      cargo: dto.cargo,
      metodo: dto.metodo,
      imagemBase64: dto.imagemBase64,
      ip: req.ip,
      userAgent,
    });
  }
}
