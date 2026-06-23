import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEntidadeDto,
  ListEntidadesQuery,
  UpdateEntidadeDto,
} from './entidades.dto';

@Injectable()
export class EntidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── List + Get ─────────────────────────────────

  async list(tenantId: string, q: ListEntidadesQuery) {
    // L.5 pattern aplicado também aqui: full-text quando q.q presente.
    let ftsIds: string[] | undefined;
    if (q.q && q.q.trim()) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM entidades
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND (
            search_vector @@ websearch_to_tsquery('portuguese', ${q.q})
            OR nif ILIKE ${`%${q.q}%`}
            OR numero_bi ILIKE ${`%${q.q}%`}
          )
        ORDER BY ts_rank(search_vector, websearch_to_tsquery('portuguese', ${q.q})) DESC
        LIMIT 500
      `;
      ftsIds = rows.map((r) => r.id);
      if (ftsIds.length === 0) {
        return { data: [], nextCursor: null, total: 0 };
      }
    }

    const where: Prisma.EntidadeWhereInput = {
      tenantId,
      deletedAt: null,
      ...(ftsIds && { id: { in: ftsIds } }),
      ...(q.tipo && { tipo: q.tipo }),
      ...(q.nacionalidadeCambial && { nacionalidadeCambial: q.nacionalidadeCambial }),
      ...(q.sectorActividade && { sectorActividade: q.sectorActividade }),
    };
    const rows = await this.prisma.entidade.findMany({
      where,
      take: q.limit + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    const hasMore = rows.length > q.limit;
    const data = rows.slice(0, q.limit);
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
      total: data.length,
    };
  }

  async get(tenantId: string, id: string) {
    const e = await this.prisma.entidade.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contactos: { orderBy: [{ isPrincipal: 'desc' }, { nome: 'asc' }] },
        documentosKYC: { orderBy: { createdAt: 'desc' } },
        _count: { select: { partesEmContratos: true } },
      },
    });
    if (!e) throw new NotFoundException('Entidade not found');
    return e;
  }

  // ─── CRUD core ─────────────────────────────────

  /**
   * Cria entidade + (opcional) representante legal inline numa
   * única transacção. O representante vira `EntidadeContacto` com
   * `isPrincipal=true`.
   *
   * AUDIT fix: o frontend reportou "criar não aparece" — provável
   * causa era validação Zod a rejeitar silenciosamente. Esta
   * versão retorna SEMPRE a entidade completa (com contactos
   * incluídos) e o controller propaga o erro como BadRequest com
   * mensagem human-readable.
   */
  async create(tenantId: string, actorUserId: string, dto: CreateEntidadeDto) {
    const { representante, capitalSocial, ...rest } = dto;

    const e = await this.prisma.$transaction(async (tx) => {
      const created = await tx.entidade.create({
        data: {
          tenantId,
          ...rest,
          // Converte kwanzas decimal → BigInt centavos.
          ...(capitalSocial !== undefined && {
            capitalSocialCentavos: BigInt(Math.round(capitalSocial * 100)),
          }),
        } as Prisma.EntidadeUncheckedCreateInput,
      });

      if (representante) {
        await tx.entidadeContacto.create({
          data: {
            entidadeId: created.id,
            nome: representante.nome,
            cargo: representante.cargo,
            email: representante.email,
            telefone: representante.telefone,
            isPrincipal: true,
          },
        });
      }

      return tx.entidade.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          contactos: { orderBy: [{ isPrincipal: 'desc' }, { nome: 'asc' }] },
        },
      });
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.ENTIDADE,
      entityId: e.id,
      afterData: {
        id: e.id,
        nome: e.nome,
        tipo: e.tipo,
        nif: e.nif,
        comRepresentante: !!representante,
      },
    });
    return e;
  }

  async update(
    tenantId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEntidadeDto,
  ) {
    const before = await this.assertEntidade(tenantId, id);
    // AUDIT defensivo (mesma técnica que ContratosService): updateMany
    // composto evita race com soft-delete intermédio.
    const r = await this.prisma.entidade.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: dto as Prisma.EntidadeUncheckedUpdateInput,
    });
    if (r.count === 0) throw new NotFoundException('Entidade not found (race)');
    const after = await this.prisma.entidade.findUniqueOrThrow({ where: { id } });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.ENTIDADE,
      entityId: id,
      beforeData: before as object,
      afterData: after as object,
    });
    return after;
  }

  /**
   * E.2 — Protecção contra orphan ContratoParte.
   *
   * Soft-delete só permitido se a entidade não está em nenhum contrato
   * activo (deletedAt: null + estado != TERMINADO/ARQUIVADO). Caso
   * contrário, o utilizador precisa primeiro de terminar/arquivar os
   * contratos onde a entidade aparece, OU forçar `cascade: true`
   * (que vai soft-delete também as partes — perigoso, requer ADMIN).
   */
  async softDelete(
    tenantId: string,
    actorUserId: string,
    id: string,
    opts: { cascade?: boolean } = {},
  ) {
    await this.assertEntidade(tenantId, id);

    const ativas = await this.prisma.contratoParte.count({
      where: {
        entidadeId: id,
        contrato: {
          tenantId,
          deletedAt: null,
          estado: {
            notIn: ['TERMINADO', 'ARQUIVADO', 'CANCELADO'],
          },
        },
      },
    });

    if (ativas > 0 && !opts.cascade) {
      throw new ConflictException(
        `Entidade aparece em ${ativas} contrato(s) activo(s). Termina/arquiva esses contratos primeiro ou usa ?cascade=true (ADMIN only) para forçar.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.entidade.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      // Se cascade, marca as partes activas como removidas
      // (ContratoParte não tem soft-delete próprio, então apagamos
      // hard mas só dentro do tx, com audit a registar).
      if (opts.cascade && ativas > 0) {
        const partes = await tx.contratoParte.findMany({
          where: {
            entidadeId: id,
            contrato: { tenantId, deletedAt: null },
          },
          select: { id: true, contratoId: true },
        });
        await tx.contratoParte.deleteMany({
          where: { id: { in: partes.map((p) => p.id) } },
        });
        // Evento timeline em cada contrato afectado
        for (const p of partes) {
          await tx.contratoEvento.create({
            data: {
              contratoId: p.contratoId,
              tipo: 'PARTE_REMOVIDA',
              resumo: `Parte removida via cascade soft-delete da entidade`,
              payload: { parteId: p.id, entidadeId: id } as object,
              actorUserId,
              actorTipo: 'USER',
            },
          });
        }
      }
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.ENTIDADE,
      entityId: id,
      afterData: { cascade: opts.cascade ?? false, partesRemovidas: ativas },
    });
    return { ok: true, cascade: opts.cascade ?? false, partesRemovidas: opts.cascade ? ativas : 0 };
  }

  // ─── E.1: Endpoints detail page ──────────────

  /**
   * Lista contratos onde esta entidade participa como parte.
   * DISTINCT por contrato para evitar duplicação quando a mesma
   * entidade tem mais que um papel no mesmo contrato.
   */
  async listContratos(tenantId: string, entidadeId: string) {
    await this.assertEntidade(tenantId, entidadeId);
    const partes = await this.prisma.contratoParte.findMany({
      where: {
        entidadeId,
        contrato: { tenantId, deletedAt: null },
      },
      include: {
        contrato: {
          select: {
            id: true,
            numeroInterno: true,
            titulo: true,
            estado: true,
            dataTermo: true,
            valor: true,
            moeda: true,
            tipo: { select: { nome: true } },
          },
        },
      },
      orderBy: { contrato: { createdAt: 'desc' } },
    });
    // DISTINCT por contratoId — preserva primeira ocorrência (que
    // tipicamente é o papel principal).
    const seen = new Set<string>();
    const out: Array<{
      papel: string;
      contrato: NonNullable<typeof partes[number]['contrato']>;
    }> = [];
    for (const p of partes) {
      if (seen.has(p.contratoId)) continue;
      seen.add(p.contratoId);
      out.push({ papel: p.papel, contrato: p.contrato });
    }
    return out;
  }

  async listContactos(tenantId: string, entidadeId: string) {
    await this.assertEntidade(tenantId, entidadeId);
    return this.prisma.entidadeContacto.findMany({
      where: { entidadeId },
      orderBy: [{ isPrincipal: 'desc' }, { nome: 'asc' }],
    });
  }

  async addContacto(
    tenantId: string,
    actorUserId: string,
    entidadeId: string,
    dto: {
      nome: string;
      cargo?: string;
      email?: string;
      telefone?: string;
      isPrincipal?: boolean;
    },
  ) {
    await this.assertEntidade(tenantId, entidadeId);
    return this.prisma.$transaction(async (tx) => {
      // Se isPrincipal=true, desmarca outros principais
      if (dto.isPrincipal) {
        await tx.entidadeContacto.updateMany({
          where: { entidadeId, isPrincipal: true },
          data: { isPrincipal: false },
        });
      }
      const c = await tx.entidadeContacto.create({
        data: {
          entidadeId,
          nome: dto.nome,
          cargo: dto.cargo,
          email: dto.email,
          telefone: dto.telefone,
          isPrincipal: dto.isPrincipal ?? false,
        },
      });
      await this.audit.log({
        tenantId,
        actorUserId,
        action: AuditAction.CREATE,
        entityType: EntityType.ENTIDADE,
        entityId: entidadeId,
        afterData: { contactoId: c.id, nome: c.nome },
      });
      return c;
    });
  }

  async removeContacto(
    tenantId: string,
    _actorUserId: string,
    entidadeId: string,
    contactoId: string,
  ) {
    await this.assertEntidade(tenantId, entidadeId);
    const r = await this.prisma.entidadeContacto.deleteMany({
      where: { id: contactoId, entidadeId },
    });
    if (r.count === 0) throw new NotFoundException('Contacto not found');
    return { ok: true };
  }

  async listKyc(tenantId: string, entidadeId: string) {
    await this.assertEntidade(tenantId, entidadeId);
    return this.prisma.entidadeDocumentoKYC.findMany({
      where: { entidadeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addKyc(
    tenantId: string,
    actorUserId: string,
    entidadeId: string,
    dto: {
      tipo: string;
      numero?: string;
      emitidoEm?: Date;
      validoAte?: Date;
      documentId?: string;
      observacoes?: string;
    },
  ) {
    await this.assertEntidade(tenantId, entidadeId);
    if (dto.documentId) {
      // Verifica que o documento existe no tenant
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!doc) throw new BadRequestException('Documento KYC não pertence ao tenant');
    }
    const k = await this.prisma.entidadeDocumentoKYC.create({
      data: { entidadeId, ...dto },
    });
    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.ENTIDADE,
      entityId: entidadeId,
      afterData: { kycId: k.id, tipo: dto.tipo },
    });
    return k;
  }

  async removeKyc(
    tenantId: string,
    _actorUserId: string,
    entidadeId: string,
    kycId: string,
  ) {
    await this.assertEntidade(tenantId, entidadeId);
    const r = await this.prisma.entidadeDocumentoKYC.deleteMany({
      where: { id: kycId, entidadeId },
    });
    if (r.count === 0) throw new NotFoundException('Documento KYC not found');
    return { ok: true };
  }

  // ─── E.6: bulk import ────────────────────────

  /**
   * Importação em massa de entidades — recebe array já parseado pelo
   * cliente (que faz o parse CSV no browser). Server valida cada
   * linha contra CreateEntidadeSchema; insere todas as válidas e
   * devolve relatório com sucessos + erros por linha.
   *
   * Dedup automático: se já existe entidade com mesmo NIF (não vazio)
   * no tenant, salta criar e regista como "skipped".
   */
  async bulkImport(
    tenantId: string,
    actorUserId: string,
    linhas: Array<CreateEntidadeDto & { _row?: number }>,
  ) {
    const resultado = {
      criadas: 0,
      ignoradas: 0,
      falhas: [] as Array<{ row: number; erro: string }>,
      ids: [] as string[],
    };

    // Pré-fetch NIFs existentes para dedup eficiente
    const nifs = linhas.map((l) => l.nif).filter(Boolean) as string[];
    const existentes = nifs.length > 0
      ? await this.prisma.entidade.findMany({
          where: { tenantId, deletedAt: null, nif: { in: nifs } },
          select: { nif: true },
        })
      : [];
    const nifsExistentes = new Set(existentes.map((e) => e.nif).filter(Boolean) as string[]);

    for (const [i, linha] of linhas.entries()) {
      const row = linha._row ?? i + 1;
      const { _row, ...dto } = linha;
      void _row;
      try {
        if (dto.nif && nifsExistentes.has(dto.nif)) {
          resultado.ignoradas += 1;
          continue;
        }
        const e = await this.prisma.entidade.create({
          data: { tenantId, ...dto } as Prisma.EntidadeUncheckedCreateInput,
        });
        if (e.nif) nifsExistentes.add(e.nif);
        resultado.criadas += 1;
        resultado.ids.push(e.id);
      } catch (err) {
        resultado.falhas.push({
          row,
          erro: (err as Error).message.slice(0, 200),
        });
      }
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.ENTIDADE,
      entityId: 'bulk-import',
      afterData: {
        total: linhas.length,
        criadas: resultado.criadas,
        ignoradas: resultado.ignoradas,
        falhas: resultado.falhas.length,
      },
    });

    return resultado;
  }

  // ─── E.7: merge/dedup ────────────────────────

  /**
   * Mescla a entidade `sourceId` em `targetId`. Move todas as
   * `ContratoParte` que apontam para `source` para apontarem para
   * `target`; soft-delete `source`. Operação irreversível em uso
   * normal — audit captura o "before".
   *
   * Útil quando o utilizador percebe ter criado "Acme Lda" duas
   * vezes com NIFs diferentes ou ortografias variantes.
   */
  async merge(
    tenantId: string,
    actorUserId: string,
    targetId: string,
    sourceId: string,
  ) {
    if (targetId === sourceId) {
      throw new BadRequestException('Target e source são a mesma entidade');
    }
    const [target, source] = await Promise.all([
      this.assertEntidade(tenantId, targetId),
      this.assertEntidade(tenantId, sourceId),
    ]);

    return this.prisma.$transaction(async (tx) => {
      // 1. Re-aponta ContratoParte
      const partesMovidas = await tx.contratoParte.updateMany({
        where: { entidadeId: sourceId },
        data: { entidadeId: targetId },
      });

      // 2. Re-aponta contactos. AUDIT: depois do move, pode ficar
      // mais que um isPrincipal=true (um de cada lado). Forçamos
      // que apenas um sobreviva — o do target tem prioridade
      // (estado escolhido pelo utilizador como canónico).
      await tx.entidadeContacto.updateMany({
        where: { entidadeId: sourceId },
        data: { entidadeId: targetId },
      });
      const principais = await tx.entidadeContacto.findMany({
        where: { entidadeId: targetId, isPrincipal: true },
        orderBy: { createdAt: 'asc' }, // mais antigo (provavelmente do target)
        select: { id: true },
      });
      if (principais.length > 1) {
        await tx.entidadeContacto.updateMany({
          where: { id: { in: principais.slice(1).map((p) => p.id) } },
          data: { isPrincipal: false },
        });
      }

      // 3. KYC: mesma lógica de move; sem regra de unicidade
      // funcional além do constraint do DB (e.g. (entidadeId, tipo)
      // não é unique no schema actual). Move tudo cru.
      await tx.entidadeDocumentoKYC.updateMany({
        where: { entidadeId: sourceId },
        data: { entidadeId: targetId },
      });

      // 4. Soft-delete source
      await tx.entidade.update({
        where: { id: sourceId },
        data: { deletedAt: new Date() },
      });
      return { partesMovidas: partesMovidas.count, targetId, sourceId };
    }).then(async (r) => {
      await this.audit.log({
        tenantId,
        actorUserId,
        action: AuditAction.UPDATE,
        entityType: EntityType.ENTIDADE,
        entityId: targetId,
        beforeData: { merged_from: { id: sourceId, nome: source.nome, nif: source.nif } },
        afterData: { ...r, target_nome: target.nome },
      });
      return r;
    });
  }

  /**
   * Procura potenciais duplicados no tenant — entidades com o mesmo
   * NIF (case sensitive, trimmed) ou nomes muito similares
   * (case-insensitive equality após normalização de espaços).
   *
   * UI usa para pré-povoar o diálogo de merge sem o utilizador ter
   * de procurar manualmente.
   *
   * Performance: dois queries — um por NIF GROUP BY, um por nome
   * normalizado GROUP BY. Para o limite de 50k entidades por
   * tenant é OK; acima disso, mover para job assíncrono.
   */
  async findDuplicates(tenantId: string) {
    const porNif = await this.prisma.$queryRaw<
      Array<{ nif: string; ids: string[]; nomes: string[] }>
    >`
      SELECT nif,
             array_agg(id::text ORDER BY created_at) AS ids,
             array_agg(nome ORDER BY created_at) AS nomes
      FROM entidades
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
        AND nif IS NOT NULL
        AND length(trim(nif)) > 0
      GROUP BY nif
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 100
    `;

    const porNome = await this.prisma.$queryRaw<
      Array<{ nome_norm: string; ids: string[]; nomes: string[] }>
    >`
      SELECT lower(regexp_replace(trim(nome), '\\s+', ' ', 'g')) AS nome_norm,
             array_agg(id::text ORDER BY created_at) AS ids,
             array_agg(nome ORDER BY created_at) AS nomes
      FROM entidades
      WHERE tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
      GROUP BY nome_norm
      HAVING count(*) > 1
      ORDER BY count(*) DESC
      LIMIT 100
    `;

    return {
      porNif: porNif.map((g) => ({
        chave: g.nif,
        ids: g.ids,
        nomes: g.nomes,
      })),
      porNome: porNome.map((g) => ({
        chave: g.nome_norm,
        ids: g.ids,
        nomes: g.nomes,
      })),
    };
  }

  // ─── helpers ─────────────────────────────────

  private async assertEntidade(tenantId: string, id: string) {
    const e = await this.prisma.entidade.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!e) throw new NotFoundException('Entidade not found');
    return e;
  }
}
