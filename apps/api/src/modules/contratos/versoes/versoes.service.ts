import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContratoEventoTipo,
  VersaoDireccao,
} from '@kamaia/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContratoVersoesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, contratoId: string) {
    await this.assertContrato(tenantId, contratoId);
    return this.prisma.contratoVersao.findMany({
      where: { contratoId },
      orderBy: { ordem: 'desc' },
    });
  }

  async create(
    tenantId: string,
    actorUserId: string,
    contratoId: string,
    dto: {
      versao: string;
      direccao: VersaoDireccao;
      documentId?: string;
      hashSHA256?: string;
      comentario?: string;
    },
  ) {
    await this.assertContrato(tenantId, contratoId);

    const last = await this.prisma.contratoVersao.findFirst({
      where: { contratoId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    const ordem = (last?.ordem ?? 0) + 1;

    const versao = await this.prisma.contratoVersao.create({
      data: {
        contratoId,
        ordem,
        criadoPor: actorUserId,
        ...dto,
        ...(dto.direccao === VersaoDireccao.ASSINADO_FINAL && {
          seloTemporal: new Date(),
        }),
      },
    });

    await this.prisma.contratoEvento.create({
      data: {
        contratoId,
        tipo:
          dto.direccao === VersaoDireccao.ENVIADO_CONTRAPARTE ||
          dto.direccao === VersaoDireccao.ENVIADO_CLIENTE
            ? ContratoEventoTipo.VERSAO_ENVIADA
            : dto.direccao === VersaoDireccao.RECEBIDO_CONTRAPARTE ||
                dto.direccao === VersaoDireccao.RECEBIDO_CLIENTE
              ? ContratoEventoTipo.VERSAO_RECEBIDA
              : ContratoEventoTipo.VERSAO_CRIADA,
        resumo: `${dto.versao} (${dto.direccao})`,
        payload: { versaoId: versao.id, direccao: dto.direccao } as object,
        actorUserId,
        actorTipo: 'USER',
      },
    });

    return versao;
  }

  private async assertContrato(tenantId: string, contratoId: string) {
    const c = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Contrato not found');
  }
}
