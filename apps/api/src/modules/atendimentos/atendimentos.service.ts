import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  AtendimentoStatus,
  EntityType,
  KamaiaRole,
  Result,
  err,
  ok,
} from '@kamaia/shared-types';
import { AuditService } from '../audit/audit.service';
import { ProcessosService } from '../processos/processos.service';
import { ClientesService } from '../clientes/clientes.service';
import {
  AtendimentosRepository,
  ListAtendimentosParams,
} from './atendimentos.repository';
import {
  ConvertAtendimentoDto,
  CreateAtendimentoDto,
  UpdateAtendimentoDto,
} from './atendimentos.dto';

/**
 * Allowed status transitions for an Atendimento.
 *
 * NOVO → EM_ANALISE → QUALIFICADO → CONVERTIDO (terminal)
 *                                └→ PERDIDO   (terminal)
 *
 * Any node can also jump to PERDIDO. CONVERTIDO is only set by the
 * /convert endpoint, never by manual update.
 */
const ALLOWED_TRANSITIONS: Record<AtendimentoStatus, AtendimentoStatus[]> = {
  [AtendimentoStatus.NOVO]: [AtendimentoStatus.EM_ANALISE, AtendimentoStatus.PERDIDO],
  [AtendimentoStatus.EM_ANALISE]: [
    AtendimentoStatus.QUALIFICADO,
    AtendimentoStatus.PERDIDO,
  ],
  [AtendimentoStatus.QUALIFICADO]: [AtendimentoStatus.PERDIDO],
  [AtendimentoStatus.CONVERTIDO]: [],
  [AtendimentoStatus.PERDIDO]: [],
};

@Injectable()
export class AtendimentosService {
  constructor(
    private repo: AtendimentosRepository,
    private audit: AuditService,
    private processos: ProcessosService,
    private clientes: ClientesService,
  ) {}

  async findAll(
    gabineteId: string,
    role: KamaiaRole,
    userId: string,
    params: ListAtendimentosParams,
  ): Promise<Result<any>> {
    try {
      // ADVOGADO_MEMBRO only sees atendimentos assigned to them.
      const restrictToAssignee =
        role === KamaiaRole.ADVOGADO_MEMBRO ? userId : undefined;

      const result = await this.repo.findAll(gabineteId, {
        ...params,
        restrictToAssignee,
      });
      return ok(result);
    } catch (error) {
      return err('Failed to fetch atendimentos', 'ATENDIMENTOS_FETCH_FAILED');
    }
  }

  async findById(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const at = await this.repo.findById(gabineteId, id);
      if (!at) return err('Atendimento not found', 'ATENDIMENTO_NOT_FOUND');
      return ok(at);
    } catch (error) {
      return err('Failed to fetch atendimento', 'ATENDIMENTO_FETCH_FAILED');
    }
  }

  async stats(
    gabineteId: string,
    role: KamaiaRole,
    userId: string,
  ): Promise<Result<Record<string, number>>> {
    try {
      const restrictToAssignee =
        role === KamaiaRole.ADVOGADO_MEMBRO ? userId : undefined;
      const map = await this.repo.statsByStatus(gabineteId, restrictToAssignee);
      return ok(map);
    } catch (error) {
      return err('Failed to compute stats', 'ATENDIMENTO_STATS_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateAtendimentoDto,
  ): Promise<Result<any>> {
    try {
      const at = await this.repo.create(gabineteId, userId, {
        ...dto,
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        nif: dto.nif?.trim() || null,
        status: AtendimentoStatus.NOVO,
      });

      await this.audit.log({
        action: AuditAction.CREATE,
        entity: EntityType.ATENDIMENTO,
        entityId: at.id,
        userId,
        gabineteId,
        newValue: { name: at.name, subject: at.subject, source: at.source },
      });

      return ok(at);
    } catch (error) {
      return err('Failed to create atendimento', 'ATENDIMENTO_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    id: string,
    dto: UpdateAtendimentoDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.repo.findById(gabineteId, id);
      if (!existing) return err('Atendimento not found', 'ATENDIMENTO_NOT_FOUND');

      // Enforce state machine. CONVERTIDO is only set via /convert.
      if (dto.status && dto.status !== existing.status) {
        if (dto.status === AtendimentoStatus.CONVERTIDO) {
          return err(
            'Use o endpoint /convert para converter em processo',
            'USE_CONVERT_ENDPOINT',
          );
        }
        const allowed = ALLOWED_TRANSITIONS[existing.status as AtendimentoStatus] ?? [];
        if (!allowed.includes(dto.status as AtendimentoStatus)) {
          return err(
            `Transição inválida: ${existing.status} → ${dto.status}`,
            'INVALID_STATUS_TRANSITION',
          );
        }
      }

      const updated = await this.repo.update(gabineteId, id, {
        ...dto,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: EntityType.ATENDIMENTO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status, subject: existing.subject },
        newValue: { status: updated?.status, subject: updated?.subject },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update atendimento', 'ATENDIMENTO_UPDATE_FAILED');
    }
  }

  async delete(gabineteId: string, userId: string, id: string): Promise<Result<void>> {
    try {
      const existing = await this.repo.findById(gabineteId, id);
      if (!existing) return err('Atendimento not found', 'ATENDIMENTO_NOT_FOUND');

      await this.repo.softDelete(gabineteId, id);

      await this.audit.log({
        action: AuditAction.DELETE,
        entity: EntityType.ATENDIMENTO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { name: existing.name, status: existing.status },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete atendimento', 'ATENDIMENTO_DELETE_FAILED');
    }
  }

  /**
   * Convert an atendimento into a Cliente + Processo. Atomic: either
   * both get created (and the atendimento is marked CONVERTIDO) or
   * nothing changes. We reuse the full ClientesService/ProcessosService
   * pipelines so quotas, audit logs, and workflow bootstrap all run.
   */
  async convert(
    gabineteId: string,
    userId: string,
    id: string,
    dto: ConvertAtendimentoDto,
  ): Promise<Result<{ clienteId: string; processoId: string; atendimentoId: string }>> {
    try {
      const existing = await this.repo.findById(gabineteId, id);
      if (!existing) return err('Atendimento not found', 'ATENDIMENTO_NOT_FOUND');

      if (existing.status === AtendimentoStatus.CONVERTIDO) {
        return err('Atendimento já foi convertido', 'ALREADY_CONVERTED');
      }
      if (existing.status === AtendimentoStatus.PERDIDO) {
        return err(
          'Atendimento está marcado como perdido — reabra antes de converter',
          'LOST_CANNOT_CONVERT',
        );
      }

      // 1) Resolve cliente (existing or new).
      let clienteId = dto.clienteId;
      if (!clienteId) {
        const override = dto.clienteOverride ?? {};
        const clienteResult = await this.clientes.create(gabineteId, userId, {
          name: override.name ?? existing.name,
          type: existing.type as 'INDIVIDUAL' | 'EMPRESA',
          nif: override.nif ?? existing.nif ?? undefined,
          email: override.email ?? existing.email ?? undefined,
          phone: override.phone ?? existing.phone ?? undefined,
          address: override.address ?? undefined,
          notes: existing.description ?? undefined,
        });
        if (!clienteResult.success) {
          return err(clienteResult.error, clienteResult.code || 'CLIENTE_CREATE_FAILED');
        }
        clienteId = clienteResult.data.id;
      }

      // 2) Create processo via the real service (handles quota, number,
      //    workflow stage, audit log, opening event).
      const processoResult = await this.processos.create(gabineteId, userId, {
        clienteId: clienteId!,
        title: dto.processo.title,
        type: dto.processo.type as any,
        description: dto.processo.description,
        priority: dto.processo.priority as any,
      });
      if (!processoResult.success) {
        return err(
          processoResult.error,
          processoResult.code || 'PROCESSO_CREATE_FAILED',
        );
      }
      const processoId = processoResult.data.id;

      // 3) Close the atendimento loop.
      await this.repo.update(gabineteId, id, {
        status: AtendimentoStatus.CONVERTIDO,
        convertedClienteId: clienteId,
        convertedProcessoId: processoId,
        convertedAt: new Date(),
      });

      await this.audit.log({
        action: AuditAction.UPDATE,
        entity: EntityType.ATENDIMENTO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status },
        newValue: {
          status: AtendimentoStatus.CONVERTIDO,
          clienteId,
          processoId,
        },
      });

      return ok({ clienteId: clienteId!, processoId, atendimentoId: id });
    } catch (error) {
      return err('Failed to convert atendimento', 'ATENDIMENTO_CONVERT_FAILED');
    }
  }
}
