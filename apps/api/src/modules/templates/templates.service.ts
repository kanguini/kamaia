import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, tipoId?: string) {
    return this.prisma.template.findMany({
      where: { tenantId, isActive: true, ...(tipoId && { tipoId }) },
      include: { tipo: { select: { id: true, codigo: true, nome: true } } },
      orderBy: [{ tipoId: 'asc' }, { versao: 'desc' }],
    });
  }

  async get(tenantId: string, id: string) {
    const t = await this.prisma.template.findFirst({
      where: { id, tenantId },
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async create(
    tenantId: string,
    actorUserId: string,
    dto: {
      tipoId: string;
      nome: string;
      descricao?: string;
      conteudo: string;
      metadata?: object;
      idiomas?: string[];
    },
  ) {
    return this.prisma.template.create({
      data: { tenantId, createdBy: actorUserId, ...dto },
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: { nome?: string; descricao?: string; conteudo?: string; metadata?: object; isActive?: boolean },
  ) {
    await this.get(tenantId, id);
    return this.prisma.template.update({ where: { id }, data: dto });
  }
}
