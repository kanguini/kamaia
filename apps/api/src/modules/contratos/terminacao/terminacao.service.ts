import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContratoEstado,
  ContratoEventoTipo,
  TerminacaoTipo,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoTerminacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async registar(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      tipo: TerminacaoTipo;
      dataEfectiva: Date;
      motivacao?: string;
      documentoId?: string;
      obrigacoesPosTermo?: object;
    },
  ) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    if (c.estado === ContratoEstado.TERMINADO || c.estado === ContratoEstado.ARQUIVADO) {
      throw new BadRequestException('Contrato já terminado');
    }

    return this.prisma.$transaction(async (tx) => {
      const term = await tx.contratoTerminacao.create({
        data: {
          contratoId,
          createdBy: actorUserId,
          ...dto,
        },
      });
      await tx.contrato.update({
        where: { id: contratoId },
        data: { estado: ContratoEstado.TERMINADO },
      });
      await tx.contratoEvento.create({
        data: {
          contratoId,
          tipo: ContratoEventoTipo.TERMINADO,
          resumo: `Terminado: ${dto.tipo}`,
          payload: dto as object,
          actorUserId,
          actorTipo: 'USER',
        },
      });
      return term;
    });
  }

  async get(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
    return this.prisma.contratoTerminacao.findUnique({
      where: { contratoId },
    });
  }
}
