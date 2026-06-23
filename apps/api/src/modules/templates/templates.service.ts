import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Templates de contrato (minutas com placeholders).
 *
 * Auditoria de hoje encontrou:
 *  - update() não incrementava `versao` — histórico perdido
 *  - get() não filtrava isActive — leak por acesso directo a UUIDs
 *    de templates "deletados"
 *  - Sem validação de placeholders no save — typos silenciosos
 *
 * Tudo corrigido nesta iteração.
 */
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

  async get(tenantId: string, id: string, opts: { includeInactive?: boolean } = {}) {
    const t = await this.prisma.template.findFirst({
      where: {
        id,
        tenantId,
        // FIX auditoria: filtra isActive por defeito — só ADMIN explicitamente
        // pode ver templates desactivados (e.g. para reactivar)
        ...(!opts.includeInactive && { isActive: true }),
      },
      include: { tipo: { select: { id: true, codigo: true, nome: true } } },
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
    // Valida placeholders antes de gravar
    const issues = validatePlaceholders(dto.conteudo);
    if (issues.length > 0) {
      throw new NotFoundException(
        `Placeholders inválidos: ${issues.slice(0, 3).join(', ')}`,
      );
    }
    return this.prisma.template.create({
      data: { tenantId, createdBy: actorUserId, ...dto },
    });
  }

  /**
   * FIX auditoria: incrementa `versao` quando o `conteudo` muda.
   * Mantém histórico simples — uma edição = +1 versão. Para auditoria
   * fina (diff entre versões) o ContratoVersao.diff endpoint já cobre
   * o caso geral; templates seguem o mesmo princípio.
   */
  async update(
    tenantId: string,
    id: string,
    dto: { nome?: string; descricao?: string; conteudo?: string; metadata?: object; isActive?: boolean },
  ) {
    const before = await this.get(tenantId, id, { includeInactive: true });

    if (dto.conteudo) {
      const issues = validatePlaceholders(dto.conteudo);
      if (issues.length > 0) {
        throw new NotFoundException(
          `Placeholders inválidos: ${issues.slice(0, 3).join(', ')}`,
        );
      }
    }

    // Incrementa versao se conteudo mudou
    const conteudoMudou = dto.conteudo !== undefined && dto.conteudo !== before.conteudo;
    const r = await this.prisma.template.updateMany({
      where: { id, tenantId },
      data: {
        ...dto,
        ...(conteudoMudou && { versao: { increment: 1 } }),
      },
    });
    if (r.count === 0) throw new NotFoundException('Template not found (race)');
    return this.prisma.template.findUniqueOrThrow({ where: { id } });
  }
}

/**
 * Validação de placeholders mustache-like {{path | filter}}.
 *
 * Detecta:
 *  - Chavetas não emparelhadas: `{{x` ou `x}}`
 *  - Path vazio: `{{}}` ou `{{ }}`
 *
 * NÃO valida que o `path` existe no contexto (impossível sem
 * conhecer o que vai ser passado) — só sintaxe.
 *
 * Devolve array de issues (texto descritivo). Vazio = OK.
 */
export function validatePlaceholders(content: string): string[] {
  const issues: string[] = [];
  // Aberturas e fechos isolados
  const opens = (content.match(/\{\{/g) ?? []).length;
  const closes = (content.match(/\}\}/g) ?? []).length;
  if (opens !== closes) {
    issues.push(`chavetas desemparelhadas (${opens} aberturas vs ${closes} fechos)`);
  }
  // Placeholders vazios
  const empties = content.match(/\{\{\s*\}\}/g);
  if (empties) {
    issues.push(`${empties.length} placeholder(s) vazio(s) {{ }}`);
  }
  return issues;
}
