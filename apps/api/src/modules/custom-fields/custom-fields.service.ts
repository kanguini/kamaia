import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomFieldType, Prisma } from '@prisma/client';
import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
  UpsertValoresDto,
} from './custom-fields.dto';

/**
 * CustomFieldsService — gere o schema dinâmico de campos por
 * TipoContrato e os respectivos valores em contratos individuais.
 *
 * Decisões de design:
 *  - tenantId NUNCA vem dos params; é resolvido via `tipo.tenantId`
 *    (catálogo global = null permitido só para fields do catálogo
 *    global; só ADMIN system-wide pode tocar nisso — neste módulo
 *    aceitamos sempre fields tenant-scoped)
 *  - Definições alteradas são soft-deleted (deletedAt) — preservamos
 *    valores históricos em contratos antigos sem perder rastro
 *  - Valores são guardados como JSONB com forma `{ v: ... }` para
 *    permitir extensão futura (e.g. revision history) sem migração
 *  - Validação por tipo no service (não confiar só em Zod do DTO):
 *    - STRING/TEXT: string não vazia
 *    - NUMBER: number finito
 *    - DATE: ISO YYYY-MM-DD
 *    - BOOLEAN: boolean
 *    - SELECT: tem de estar em `options`
 *    - MONEY: { v: number, moeda: string }
 *    - ADDRESS: { rua, cidade, provincia, pais? }
 */
@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Garante que o TipoContrato pertence ao tenant fornecido (ou é
   * catálogo global). Devolve o tipo. Lança 404 se não existe.
   *
   * Catálogo global (`tenantId=null`) NÃO é editável por este service
   * — apenas o tenant proprietário pode adicionar custom fields aos
   * SEUS tipos. Para tipos globais, primeiro o tenant tem de fazer
   * "clone para tenant" (operação separada).
   */
  private async assertTipoPertenceAoTenant(
    tipoContratoId: string,
    tenantId: string,
  ) {
    const tipo = await this.prisma.tipoContrato.findUnique({
      where: { id: tipoContratoId },
      select: { id: true, tenantId: true, codigo: true, nome: true },
    });
    if (!tipo) {
      throw new NotFoundException('TipoContrato não encontrado');
    }
    if (tipo.tenantId === null) {
      throw new ForbiddenException(
        'Catálogo global não aceita custom fields per-tenant. Clone o tipo primeiro.',
      );
    }
    if (tipo.tenantId !== tenantId) {
      throw new NotFoundException('TipoContrato não encontrado'); // não revela existência cross-tenant
    }
    return tipo;
  }

  // ─── Definitions CRUD ────────────────────────────────────────

  async listByTipo(tipoContratoId: string, tenantId: string) {
    await this.assertTipoPertenceAoTenant(tipoContratoId, tenantId);
    return this.prisma.customFieldDefinition.findMany({
      where: { tipoContratoId, deletedAt: null },
      orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    tipoContratoId: string,
    tenantId: string,
    actorUserId: string,
    dto: CreateCustomFieldDto,
  ) {
    await this.assertTipoPertenceAoTenant(tipoContratoId, tenantId);

    // Validação de options consistente com type
    this.validateOptionsForType(dto.type, dto.options);

    let created;
    try {
      created = await this.prisma.customFieldDefinition.create({
        data: {
          tipoContratoId,
          key: dto.key,
          label: dto.label,
          hint: dto.hint,
          type: dto.type,
          options: dto.options as Prisma.InputJsonValue | undefined,
          required: dto.required ?? false,
          ordem: dto.ordem ?? 0,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `Já existe um custom field com key "${dto.key}" para este tipo.`,
        );
      }
      throw e;
    }

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.CREATE,
      entityType: EntityType.TIPO_CONTRATO,
      entityId: tipoContratoId,
      afterData: { customField: { id: created.id, key: created.key } },
    });

    return created;
  }

  async update(
    id: string,
    tenantId: string,
    actorUserId: string,
    dto: UpdateCustomFieldDto,
  ) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { id },
      include: { tipoContrato: { select: { tenantId: true } } },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Custom field não encontrado');
    }
    if (existing.tipoContrato.tenantId !== tenantId) {
      throw new NotFoundException('Custom field não encontrado');
    }

    if (dto.type !== undefined && dto.type !== existing.type) {
      // Não permitimos mudar o tipo — invalidaria valores existentes.
      // Solução: apagar (soft) e criar novo.
      throw new ConflictException(
        'Não é possível mudar o tipo de um custom field existente. ' +
          'Cria um novo e desactiva este.',
      );
    }

    if (dto.options !== undefined) {
      this.validateOptionsForType(existing.type, dto.options);
    }

    const updated = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.key !== undefined && { key: dto.key }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.hint !== undefined && { hint: dto.hint }),
        ...(dto.options !== undefined && {
          options: dto.options as Prisma.InputJsonValue,
        }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.ordem !== undefined && { ordem: dto.ordem }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.TIPO_CONTRATO,
      entityId: existing.tipoContratoId,
      afterData: { customField: { id, changes: dto } },
    });

    return updated;
  }

  async softDelete(id: string, tenantId: string, actorUserId: string) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { id },
      include: { tipoContrato: { select: { tenantId: true } } },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Custom field não encontrado');
    }
    if (existing.tipoContrato.tenantId !== tenantId) {
      throw new NotFoundException('Custom field não encontrado');
    }

    const deleted = await this.prisma.customFieldDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.DELETE,
      entityType: EntityType.TIPO_CONTRATO,
      entityId: existing.tipoContratoId,
      afterData: { customField: { id, key: existing.key } },
    });

    return deleted;
  }

  // ─── Valores per-contrato ─────────────────────────────────────

  /**
   * Lista valores existentes para um contrato, juntando com a
   * definition (label, type, hint) para facilitar o render no UI.
   */
  async listValoresByContrato(contratoId: string, tenantId: string) {
    // Valida que o contrato pertence ao tenant
    const contrato = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true, tipoId: true },
    });
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const [definitions, valores] = await Promise.all([
      this.prisma.customFieldDefinition.findMany({
        where: {
          tipoContratoId: contrato.tipoId,
          deletedAt: null,
          isActive: true,
        },
        orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.contratoCustomFieldValue.findMany({
        where: { contratoId },
      }),
    ]);

    const byFieldId = new Map(valores.map((v) => [v.fieldId, v.value]));
    return definitions.map((def) => ({
      definition: def,
      value: byFieldId.get(def.id) ?? null,
    }));
  }

  /**
   * Upsert em massa. Aceita Record<key, value>. Valida cada valor
   * contra o tipo do field correspondente. Falha tudo ou nada
   * (transaction).
   */
  async upsertValores(
    contratoId: string,
    tenantId: string,
    actorUserId: string,
    dto: UpsertValoresDto,
  ) {
    const contrato = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      select: { id: true, tipoId: true },
    });
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }

    const definitions = await this.prisma.customFieldDefinition.findMany({
      where: {
        tipoContratoId: contrato.tipoId,
        deletedAt: null,
        isActive: true,
      },
    });
    const byKey = new Map(definitions.map((d) => [d.key, d]));

    const operations: Array<{ fieldId: string; value: unknown }> = [];
    const errors: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(dto.values)) {
      const def = byKey.get(key);
      if (!def) {
        errors[key] = 'Custom field não existe para este tipo';
        continue;
      }
      const validation = this.validateValueForType(def.type, rawValue, def.options);
      if (!validation.ok) {
        errors[key] = validation.reason;
        continue;
      }
      operations.push({ fieldId: def.id, value: validation.value });
    }

    if (Object.keys(errors).length > 0) {
      throw new ConflictException({ message: 'Valores inválidos', errors });
    }

    await this.prisma.$transaction(
      operations.map((op) =>
        this.prisma.contratoCustomFieldValue.upsert({
          where: {
            contratoId_fieldId: { contratoId, fieldId: op.fieldId },
          },
          create: {
            contratoId,
            fieldId: op.fieldId,
            value: op.value as Prisma.InputJsonValue,
          },
          update: { value: op.value as Prisma.InputJsonValue },
        }),
      ),
    );

    await this.audit.log({
      tenantId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityType: EntityType.CONTRATO,
      entityId: contratoId,
      afterData: {
        customFieldValues: { count: operations.length, keys: Object.keys(dto.values) },
      },
    });

    return this.listValoresByContrato(contratoId, tenantId);
  }

  // ─── Validação por tipo ───────────────────────────────────────

  private validateOptionsForType(
    type: CustomFieldType,
    options: unknown,
  ): void {
    if (type === 'SELECT') {
      if (!Array.isArray(options) || options.length === 0) {
        throw new ConflictException(
          'Campos SELECT precisam de `options` como array de strings.',
        );
      }
      for (const opt of options) {
        if (typeof opt !== 'string' || opt.trim() === '') {
          throw new ConflictException(
            'Opções de SELECT devem ser strings não vazias.',
          );
        }
      }
    }
    // STRING/TEXT/NUMBER/DATE/BOOLEAN/MONEY/ADDRESS: options ignorado
    // ou opcional metadata (e.g. MONEY pode ter { moedas: [...] })
  }

  /**
   * Valida e normaliza um valor para o tipo do field. Retorna o
   * valor com a forma canónica `{ v: ... }` (ou objecto estruturado
   * para MONEY/ADDRESS) que vai para a coluna `value` (JSONB).
   */
  private validateValueForType(
    type: CustomFieldType,
    raw: unknown,
    options: Prisma.JsonValue | null,
  ): { ok: true; value: unknown } | { ok: false; reason: string } {
    switch (type) {
      case 'STRING':
      case 'TEXT': {
        if (typeof raw !== 'string' || raw.length === 0) {
          return { ok: false, reason: 'esperava string não vazia' };
        }
        const max = type === 'STRING' ? 300 : 5000;
        if (raw.length > max) {
          return { ok: false, reason: `string demasiado longa (>${max})` };
        }
        return { ok: true, value: { v: raw } };
      }

      case 'NUMBER': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          return { ok: false, reason: 'esperava número finito' };
        }
        return { ok: true, value: { v: raw } };
      }

      case 'DATE': {
        if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          return { ok: false, reason: 'esperava data YYYY-MM-DD' };
        }
        return { ok: true, value: { v: raw } };
      }

      case 'BOOLEAN': {
        if (typeof raw !== 'boolean') {
          return { ok: false, reason: 'esperava boolean' };
        }
        return { ok: true, value: { v: raw } };
      }

      case 'SELECT': {
        if (typeof raw !== 'string') {
          return { ok: false, reason: 'esperava string (option)' };
        }
        const opts = Array.isArray(options) ? (options as unknown[]) : [];
        if (!opts.includes(raw)) {
          return {
            ok: false,
            reason: `"${raw}" não está nas options aceites`,
          };
        }
        return { ok: true, value: { v: raw } };
      }

      case 'MONEY': {
        // Onda A.3: MONEY guarda `v` em **centavos integers** para
        // respeitar a regra CLM "nunca floats para valores
        // monetários". A UI (drawer) multiplica por 100 antes de
        // enviar; rende dividindo por 100. Negativos são rejeitados.
        if (typeof raw !== 'object' || raw === null) {
          return {
            ok: false,
            reason: 'esperava { v: number_em_centavos, moeda: ISO }',
          };
        }
        const obj = raw as { v?: unknown; moeda?: unknown };
        if (typeof obj.v !== 'number' || !Number.isFinite(obj.v)) {
          return { ok: false, reason: 'v deve ser número finito (centavos)' };
        }
        if (!Number.isInteger(obj.v)) {
          return {
            ok: false,
            reason:
              'v deve ser integer (centavos). Multiplica o valor em unidades por 100 antes de enviar.',
          };
        }
        if (obj.v < 0) {
          return { ok: false, reason: 'valor monetário não pode ser negativo' };
        }
        if (!Number.isSafeInteger(obj.v)) {
          return {
            ok: false,
            reason:
              'v ultrapassa Number.MAX_SAFE_INTEGER. Valores acima de ~90T AKZ requerem BigInt.',
          };
        }
        if (typeof obj.moeda !== 'string' || obj.moeda.length !== 3) {
          return {
            ok: false,
            reason: 'moeda deve ser código ISO 4217 de 3 letras',
          };
        }
        return { ok: true, value: { v: obj.v, moeda: obj.moeda.toUpperCase() } };
      }

      case 'ADDRESS': {
        if (typeof raw !== 'object' || raw === null) {
          return { ok: false, reason: 'esperava { rua, cidade, provincia, pais }' };
        }
        const obj = raw as {
          rua?: unknown;
          cidade?: unknown;
          provincia?: unknown;
          pais?: unknown;
        };
        if (typeof obj.rua !== 'string' || obj.rua.length === 0) {
          return { ok: false, reason: 'rua obrigatória' };
        }
        if (typeof obj.cidade !== 'string' || obj.cidade.length === 0) {
          return { ok: false, reason: 'cidade obrigatória' };
        }
        return {
          ok: true,
          value: {
            rua: obj.rua,
            cidade: obj.cidade,
            provincia: typeof obj.provincia === 'string' ? obj.provincia : null,
            pais: typeof obj.pais === 'string' ? obj.pais : 'AO',
          },
        };
      }

      default: {
        return { ok: false, reason: `tipo desconhecido: ${String(type)}` };
      }
    }
  }
}
