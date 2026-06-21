import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoContratoCategoria } from '@kamaia/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TiposContratoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna a união do catálogo global (tenantId=null) + customizações
   * do próprio tenant. Custom overrides sobrepoem o global no UI.
   */
  async list(tenantId: string, categoria?: TipoContratoCategoria) {
    return this.prisma.tipoContrato.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
        isActive: true,
        ...(categoria && { categoria }),
      },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const t = await this.prisma.tipoContrato.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });
    if (!t) throw new NotFoundException('TipoContrato not found');
    return t;
  }

  async create(
    tenantId: string,
    dto: {
      codigo: string;
      nome: string;
      categoria: TipoContratoCategoria;
      descricao?: string;
      tgisVerbaNumero?: string;
      requerNotario?: boolean;
      registosRequeridos?: string[];
      gatilhoBNA?: object;
      retencaoIRTpadrao?: boolean;
      clausulasObrigatorias?: string[];
    },
  ) {
    return this.prisma.tipoContrato.create({
      data: { tenantId, ...dto },
    });
  }
}
