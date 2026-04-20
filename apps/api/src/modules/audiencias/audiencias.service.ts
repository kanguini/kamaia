import { Injectable } from '@nestjs/common';
import {
  AudienciasRepository,
  ListAudienciasParams,
} from './audiencias.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
  ProcessoEventType,
  AudienciaStatus,
  AUDIENCIA_ALLOWED_TRANSITIONS,
  AUDIENCIA_TYPE_LABELS,
  AudienciaType,
} from '@kamaia/shared-types';
import {
  CreateAudienciaDto,
  UpdateAudienciaDto,
  MarkHeldDto,
  PostponeDto,
  CancelDto,
} from './audiencias.dto';

@Injectable()
export class AudienciasService {
  constructor(
    private audienciasRepository: AudienciasRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    params: ListAudienciasParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.audienciasRepository.findAll(gabineteId, params);
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        const userProcessos = await this.prisma.processo.findMany({
          where: { gabineteId, advogadoId: userId, deletedAt: null },
          select: { id: true },
        });
        const ids = new Set(userProcessos.map((p) => p.id));
        result.data = result.data.filter((a: any) => ids.has(a.processo.id));
      }
      return ok(result);
    } catch (error) {
      return err('Failed to fetch audiencias', 'AUDIENCIAS_FETCH_FAILED');
    }
  }

  async findUpcoming(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
  ): Promise<Result<any[]>> {
    try {
      const upcoming = await this.audienciasRepository.findUpcoming(gabineteId, 30);
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        const userProcessos = await this.prisma.processo.findMany({
          where: { gabineteId, advogadoId: userId, deletedAt: null },
          select: { id: true },
        });
        const ids = new Set(userProcessos.map((p) => p.id));
        return ok(upcoming.filter((a: any) => ids.has(a.processo.id)));
      }
      return ok(upcoming);
    } catch (error) {
      return err('Failed to fetch upcoming', 'UPCOMING_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const audiencia = await this.audienciasRepository.findById(gabineteId, id);
      if (!audiencia) {
        return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');
      }
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        audiencia.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }
      return ok(audiencia);
    } catch (error) {
      return err('Failed to fetch audiencia', 'AUDIENCIA_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    dto: CreateAudienciaDto,
  ): Promise<Result<any>> {
    try {
      const processo = await this.prisma.processo.findFirst({
        where: { id: dto.processoId, gabineteId, deletedAt: null },
      });
      if (!processo) return err('Processo not found', 'PROCESSO_NOT_FOUND');
      if (role === KamaiaRole.ADVOGADO_MEMBRO && processo.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      const audiencia = await this.audienciasRepository.create({
        gabineteId,
        processoId: dto.processoId,
        userId,
        type: dto.type,
        status: AudienciaStatus.AGENDADA,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        judge: dto.judge,
        notes: dto.notes,
        metadata: dto.metadata,
      });

      await this.prisma.processoEvent.create({
        data: {
          processoId: dto.processoId,
          userId,
          type: ProcessoEventType.HEARING,
          description: `Audiência agendada: ${AUDIENCIA_TYPE_LABELS[dto.type as AudienciaType]} — ${new Date(dto.scheduledAt).toISOString()}`,
          metadata: { audienciaId: audiencia.id, type: dto.type },
        },
      });

      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: audiencia.id,
        userId,
        gabineteId,
        newValue: {
          processoId: audiencia.processoId,
          type: audiencia.type,
          scheduledAt: audiencia.scheduledAt,
        },
      });

      return ok(audiencia);
    } catch (error) {
      return err('Failed to create audiencia', 'AUDIENCIA_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateAudienciaDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.audienciasRepository.findById(gabineteId, id);
      if (!existing) return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Só permite editar detalhes enquanto AGENDADA
      if (existing.status !== AudienciaStatus.AGENDADA) {
        return err(
          `Audiência ${existing.status} não pode ser editada`,
          'AUDIENCIA_IMMUTABLE',
        );
      }

      const updateData: any = { ...dto };
      if (dto.scheduledAt) updateData.scheduledAt = new Date(dto.scheduledAt);

      const updated = await this.audienciasRepository.update(gabineteId, id, updateData);
      if (!updated) return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { scheduledAt: existing.scheduledAt, type: existing.type },
        newValue: { scheduledAt: updated.scheduledAt, type: updated.type },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update', 'AUDIENCIA_UPDATE_FAILED');
    }
  }

  // ── State machine: AGENDADA → REALIZADA | ADIADA | CANCELADA ──

  async markHeld(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: MarkHeldDto,
  ): Promise<Result<any>> {
    return this.transition(gabineteId, userId, role, id, AudienciaStatus.REALIZADA, async (existing) => {
      const updated = await this.audienciasRepository.update(gabineteId, id, {
        status: AudienciaStatus.REALIZADA,
        heldAt: dto.heldAt ? new Date(dto.heldAt) : new Date(),
        outcome: dto.outcome,
        durationMinutes: dto.durationMinutes ?? existing.durationMinutes,
        metadata: dto.metadata ?? existing.metadata,
      });

      await this.prisma.processoEvent.create({
        data: {
          processoId: existing.processoId,
          userId,
          type: ProcessoEventType.HEARING,
          description: `Audiência realizada: ${dto.outcome}`,
          metadata: { audienciaId: id, outcome: dto.outcome },
        },
      });

      return updated;
    });
  }

  async postpone(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: PostponeDto,
  ): Promise<Result<any>> {
    // Transacção: fecha a audiência actual como ADIADA e cria uma nova
    // agendada, ligada via previousId. Preserva o histórico completo.
    const existing = await this.audienciasRepository.findById(gabineteId, id);
    if (!existing) return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');
    if (
      role === KamaiaRole.ADVOGADO_MEMBRO &&
      existing.processo.advogadoId !== userId
    ) {
      return err('Access denied', 'ACCESS_DENIED');
    }

    if (!this.canTransition(existing.status as AudienciaStatus, AudienciaStatus.ADIADA)) {
      return err(
        `Transição inválida: ${existing.status} → ADIADA`,
        'INVALID_TRANSITION',
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.audiencia.update({
          where: { id },
          data: {
            status: AudienciaStatus.ADIADA,
            outcome: `Adiada: ${dto.reason}`,
          },
        });

        const newAudiencia = await tx.audiencia.create({
          data: {
            gabineteId,
            processoId: existing.processoId,
            userId,
            type: existing.type,
            status: AudienciaStatus.AGENDADA,
            scheduledAt: new Date(dto.newScheduledAt),
            location: dto.location ?? existing.location,
            judge: dto.judge ?? existing.judge,
            notes: dto.notes,
            previousId: id,
            durationMinutes: existing.durationMinutes,
          },
        });

        await tx.processoEvent.create({
          data: {
            processoId: existing.processoId,
            userId,
            type: ProcessoEventType.HEARING,
            description: `Audiência adiada (${dto.reason}) — nova data: ${new Date(dto.newScheduledAt).toISOString()}`,
            metadata: {
              audienciaId: id,
              newAudienciaId: newAudiencia.id,
              reason: dto.reason,
            },
          },
        });

        return newAudiencia;
      });

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status, scheduledAt: existing.scheduledAt },
        newValue: {
          status: AudienciaStatus.ADIADA,
          newAudienciaId: result.id,
          newScheduledAt: result.scheduledAt,
        },
      });

      // Devolve a nova audiência (já agendada)
      const fresh = await this.audienciasRepository.findById(gabineteId, result.id);
      return ok(fresh);
    } catch (error) {
      return err('Failed to postpone', 'AUDIENCIA_POSTPONE_FAILED');
    }
  }

  async cancel(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: CancelDto,
  ): Promise<Result<any>> {
    return this.transition(gabineteId, userId, role, id, AudienciaStatus.CANCELADA, async (existing) => {
      const updated = await this.audienciasRepository.update(gabineteId, id, {
        status: AudienciaStatus.CANCELADA,
        outcome: `Cancelada: ${dto.reason}`,
      });

      await this.prisma.processoEvent.create({
        data: {
          processoId: existing.processoId,
          userId,
          type: ProcessoEventType.HEARING,
          description: `Audiência cancelada: ${dto.reason}`,
          metadata: { audienciaId: id, reason: dto.reason },
        },
      });

      return updated;
    });
  }

  async delete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.audienciasRepository.findById(gabineteId, id);
      if (!existing) return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.audienciasRepository.softDelete(gabineteId, id);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: {
          processoId: existing.processoId,
          type: existing.type,
          scheduledAt: existing.scheduledAt,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete', 'AUDIENCIA_DELETE_FAILED');
    }
  }

  // ── Helpers ─────────────────────────────────────────────

  private canTransition(from: AudienciaStatus, to: AudienciaStatus): boolean {
    return AUDIENCIA_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private async transition(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    to: AudienciaStatus,
    apply: (existing: any) => Promise<any>,
  ): Promise<Result<any>> {
    try {
      const existing = await this.audienciasRepository.findById(gabineteId, id);
      if (!existing) return err('Audiencia not found', 'AUDIENCIA_NOT_FOUND');
      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      if (!this.canTransition(existing.status as AudienciaStatus, to)) {
        return err(
          `Transição inválida: ${existing.status} → ${to}`,
          'INVALID_TRANSITION',
        );
      }

      const updated = await apply(existing);

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CALENDAR_EVENT,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { status: existing.status },
        newValue: { status: to },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to transition', 'AUDIENCIA_TRANSITION_FAILED');
    }
  }
}
