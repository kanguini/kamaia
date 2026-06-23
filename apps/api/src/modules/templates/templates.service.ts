import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Templates de contrato (minutas com placeholders mustache-like).
 *
 * AUDITORIA — fixes nesta iteração:
 *  1. `BadRequestException` em vez de `NotFoundException` para
 *     placeholders inválidos (resposta HTTP 400 correcta)
 *  2. Audit log em todas as escritas (create/update/softDelete)
 *  3. Validação que `tipoId` pertence ao tenant em create/update
 *  4. Soft-delete (deletedAt) em vez de só isActive
 *  5. Shape consistente com `tipo` em todos os endpoints
 *  6. Content size hard limit (200KB) — evita abuso/DoS
 *  7. `validatePlaceholders` mais rigorosa: detecta `{{x` sem fecho
 *     ou `x}}` órfão no meio do texto
 */
const MAX_CONTEUDO_BYTES = 200 * 1024; // 200KB

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, tipoId?: string) {
    return this.prisma.template.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
        ...(tipoId && { tipoId }),
      },
      include: { tipo: { select: { id: true, codigo: true, nome: true } } },
      orderBy: [{ tipoId: 'asc' }, { versao: 'desc' }],
    });
  }

  async get(
    tenantId: string,
    id: string,
    opts: { includeInactive?: boolean; includeDeleted?: boolean } = {},
  ) {
    const t = await this.prisma.template.findFirst({
      where: {
        id,
        tenantId,
        // FIX auditoria: filtra isActive + deletedAt por defeito.
        // Só ADMIN explicitamente pode ver desactivados/deleted.
        ...(!opts.includeInactive && { isActive: true }),
        ...(!opts.includeDeleted && { deletedAt: null }),
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
    this.assertConteudo(dto.conteudo);
    await this.assertTipoBelongsToTenant(tenantId, dto.tipoId);

    const t = await this.prisma.template.create({
      data: { tenantId, createdBy: actorUserId, ...dto },
      include: { tipo: { select: { id: true, codigo: true, nome: true } } },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.TEMPLATE,
      entityId: t.id,
      afterData: {
        nome: t.nome,
        tipoId: t.tipoId,
        versao: t.versao,
        conteudoLen: t.conteudo.length,
      },
    });
    return t;
  }

  /**
   * Versionamento simples: edição do `conteudo` incrementa `versao`.
   * Para diff histórico fino, ContratoVersao.diff cobre o caso geral.
   *
   * AUDIT fix: race protection via updateMany composto (mesma técnica
   * que entidades/carteiras).
   */
  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: {
      nome?: string;
      descricao?: string;
      conteudo?: string;
      metadata?: object;
      isActive?: boolean;
    },
  ) {
    const before = await this.get(tenantId, id, { includeInactive: true });

    if (dto.conteudo !== undefined) {
      this.assertConteudo(dto.conteudo);
    }

    const conteudoMudou =
      dto.conteudo !== undefined && dto.conteudo !== before.conteudo;

    const r = await this.prisma.template.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...dto,
        ...(conteudoMudou && { versao: { increment: 1 } }),
      },
    });
    if (r.count === 0) throw new NotFoundException('Template not found (race)');

    const after = await this.prisma.template.findUniqueOrThrow({
      where: { id },
      include: { tipo: { select: { id: true, codigo: true, nome: true } } },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.TEMPLATE,
      entityId: id,
      beforeData: {
        nome: before.nome,
        versao: before.versao,
        conteudoLen: before.conteudo.length,
      },
      afterData: {
        nome: after.nome,
        versao: after.versao,
        conteudoLen: after.conteudo.length,
        conteudoMudou,
      },
    });
    return after;
  }

  /**
   * Soft-delete. Diferente de `isActive=false`:
   *  - `isActive=false` (archive) → não aparece em /list mas pode
   *    ser reactivado e ainda aparece no histórico
   *  - `deletedAt!=null` (delete) → fora de todas as queries; só
   *    visível com includeDeleted=true (futuro endpoint admin)
   */
  async softDelete(tenantId: string, actorUserId: string, id: string) {
    await this.get(tenantId, id, { includeInactive: true });
    const r = await this.prisma.template.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (r.count === 0) throw new NotFoundException('Template not found (race)');

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.TEMPLATE,
      entityId: id,
    });
    return { ok: true };
  }

  // ─── helpers ─────────────────────────────────

  private assertConteudo(conteudo: string): void {
    const bytes = Buffer.byteLength(conteudo, 'utf8');
    if (bytes > MAX_CONTEUDO_BYTES) {
      throw new BadRequestException(
        `Conteúdo excede limite de ${MAX_CONTEUDO_BYTES / 1024}KB (recebido ${(bytes / 1024).toFixed(1)}KB).`,
      );
    }
    const issues = validatePlaceholders(conteudo);
    if (issues.length > 0) {
      throw new BadRequestException(
        `Placeholders inválidos: ${issues.slice(0, 3).join('; ')}`,
      );
    }
  }

  private async assertTipoBelongsToTenant(
    tenantId: string,
    tipoId: string,
  ): Promise<void> {
    const tipo = await this.prisma.tipoContrato.findFirst({
      where: { id: tipoId, OR: [{ tenantId }, { tenantId: null }] },
      select: { id: true },
    });
    if (!tipo) {
      throw new BadRequestException(
        `TipoContrato ${tipoId} não existe ou não pertence ao tenant.`,
      );
    }
  }
}

/**
 * Validação de placeholders mustache-like `{{path | filter}}`.
 *
 * Estratégia: encontra todos os pares `{{...}}` válidos, valida
 * cada um, e depois confirma que não sobra `{{` ou `}}` órfão.
 *
 * Detecta:
 *  - Chavetas não emparelhadas (`{{x` sem fecho, `x}}` órfão)
 *  - Placeholders vazios (`{{}}`, `{{ }}`)
 *  - Placeholders aninhados (`{{a{{b}}c}}`) — rejeitados
 *
 * NÃO valida que o `path` existe no contexto (impossível sem
 * conhecer o que vai ser passado) — só sintaxe.
 *
 * Devolve array de issues (texto descritivo). Vazio = OK.
 */
export function validatePlaceholders(content: string): string[] {
  const issues: string[] = [];

  // Encontra placeholders bem-formados {{...}} sem aninhamento
  const matches = Array.from(
    content.matchAll(/\{\{([^{}]*?)\}\}/g),
  );

  // Validação per-placeholder
  for (const m of matches) {
    const inner = m[1].trim();
    if (inner.length === 0) {
      issues.push(`placeholder vazio na posição ${m.index}`);
    }
  }

  // Procura chavetas órfãs depois de remover todos os matches bem-formados
  const stripped = content.replace(/\{\{[^{}]*?\}\}/g, '');
  const orphanOpens = (stripped.match(/\{\{/g) ?? []).length;
  const orphanCloses = (stripped.match(/\}\}/g) ?? []).length;
  if (orphanOpens > 0) {
    issues.push(`${orphanOpens} abertura(s) {{ sem fecho`);
  }
  if (orphanCloses > 0) {
    issues.push(`${orphanCloses} fecho(s) }} sem abertura`);
  }

  return issues;
}
