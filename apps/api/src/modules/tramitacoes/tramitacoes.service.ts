import { Injectable } from '@nestjs/common';
import {
  TramitacoesRepository,
  ListTramitacoesParams,
} from './tramitacoes.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrazosService } from '../prazos/prazos.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  KamaiaRole,
  ProcessoEventType,
  TRAMITACAO_TEMPLATES,
  TRAMITACAO_ACTO_TYPES,
} from '@kamaia/shared-types';
import {
  CreateTramitacaoDto,
  RegisterFromTemplateDto,
  UpdateTramitacaoDto,
} from './tramitacoes.dto';

@Injectable()
export class TramitacoesService {
  constructor(
    private tramitacoesRepository: TramitacoesRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
    private prazosService: PrazosService,
  ) {}

  async findAll(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    params: ListTramitacoesParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.tramitacoesRepository.findAll(gabineteId, params);

      // ADVOGADO_MEMBRO só vê tramitações de processos onde é o advogado
      if (role === KamaiaRole.ADVOGADO_MEMBRO) {
        const userProcessos = await this.prisma.processo.findMany({
          where: { gabineteId, advogadoId: userId, deletedAt: null },
          select: { id: true },
        });
        const ids = new Set(userProcessos.map((p) => p.id));
        result.data = result.data.filter((t: any) => ids.has(t.processo.id));
      }

      return ok(result);
    } catch (error) {
      return err('Failed to fetch tramitacoes', 'TRAMITACOES_FETCH_FAILED');
    }
  }

  async findById(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<any>> {
    try {
      const tramitacao = await this.tramitacoesRepository.findById(gabineteId, id);
      if (!tramitacao) {
        return err('Tramitacao not found', 'TRAMITACAO_NOT_FOUND');
      }

      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        tramitacao.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      return ok(tramitacao);
    } catch (error) {
      return err('Failed to fetch tramitacao', 'TRAMITACAO_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    dto: CreateTramitacaoDto,
  ): Promise<Result<any>> {
    try {
      // Verifica o processo e ownership (ADVOGADO_MEMBRO só nos seus)
      const processo = await this.prisma.processo.findFirst({
        where: { id: dto.processoId, gabineteId, deletedAt: null },
      });
      if (!processo) {
        return err('Processo not found', 'PROCESSO_NOT_FOUND');
      }
      if (role === KamaiaRole.ADVOGADO_MEMBRO && processo.advogadoId !== userId) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      // Valida actoType contra vocabulário controlado
      const actoDef = TRAMITACAO_ACTO_TYPES.find((a) => a.key === dto.actoType);
      if (!actoDef) {
        return err('Tipo de acto invalido', 'INVALID_ACTO_TYPE');
      }

      // Cria a tramitação (sem generatedPrazoId ainda; será linkado depois)
      const tramitacao = await this.tramitacoesRepository.create({
        gabineteId,
        processoId: dto.processoId,
        userId,
        autor: dto.autor,
        actoType: dto.actoType,
        title: dto.title,
        description: dto.description,
        actoDate: new Date(dto.actoDate),
        metadata: dto.metadata,
        advancedToStage: dto.advanceToStage ?? null,
      });

      // Timeline do processo (ProcessoEvent)
      await this.prisma.processoEvent.create({
        data: {
          processoId: dto.processoId,
          userId,
          type: ProcessoEventType.NOTE,
          description: `Tramitação registada: ${tramitacao.title}`,
          metadata: {
            tramitacaoId: tramitacao.id,
            actoType: tramitacao.actoType,
            autor: tramitacao.autor,
          },
        },
      });

      // Automação 1: gerar Prazo
      let generatedPrazo: any = null;
      if (dto.generatePrazo) {
        const dueDate = new Date(dto.actoDate);
        dueDate.setDate(dueDate.getDate() + dto.generatePrazo.daysAfter);

        const prazoResult = await this.prazosService.create(gabineteId, userId, {
          processoId: dto.processoId,
          title: dto.generatePrazo.title,
          type: dto.generatePrazo.type,
          dueDate: dueDate.toISOString(),
          alertHoursBefore: dto.generatePrazo.alertHoursBefore ?? 48,
          isUrgent: false,
        });

        if (prazoResult.success) {
          generatedPrazo = prazoResult.data;
          await this.tramitacoesRepository.linkGeneratedPrazo(
            tramitacao.id,
            prazoResult.data.id,
          );
        }
      }

      // Automação 2: avançar fase do processo (legacy stage column + event)
      if (dto.advanceToStage) {
        const targetStage = dto.advanceToStage;
        // Não falhamos a criação da tramitação se o avanço de fase falhar
        try {
          await this.prisma.processo.update({
            where: { id: dto.processoId },
            data: { stage: targetStage },
          });
          await this.prisma.processoEvent.create({
            data: {
              processoId: dto.processoId,
              userId,
              type: ProcessoEventType.STAGE_CHANGE,
              description: `Fase avançada para "${targetStage}" via tramitação`,
              metadata: {
                tramitacaoId: tramitacao.id,
                oldStage: processo.stage,
                newStage: targetStage,
              },
            },
          });
        } catch {
          // silencioso — a tramitação já foi registada com sucesso
        }
      }

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.PROCESSO,
        entityId: tramitacao.id,
        userId,
        gabineteId,
        newValue: {
          processoId: tramitacao.processoId,
          actoType: tramitacao.actoType,
          autor: tramitacao.autor,
          title: tramitacao.title,
          generatedPrazoId: generatedPrazo?.id ?? null,
          advancedToStage: dto.advanceToStage ?? null,
        },
      });

      // Devolve com prazo associado (refetch para ter generatedPrazo populado)
      const refreshed = await this.tramitacoesRepository.findById(
        gabineteId,
        tramitacao.id,
      );
      return ok(refreshed);
    } catch (error) {
      return err('Failed to create tramitacao', 'TRAMITACAO_CREATE_FAILED');
    }
  }

  async createFromTemplate(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    dto: RegisterFromTemplateDto,
  ): Promise<Result<any>> {
    const template = TRAMITACAO_TEMPLATES.find((t) => t.key === dto.templateKey);
    if (!template) {
      return err('Template nao encontrado', 'TEMPLATE_NOT_FOUND');
    }

    return this.create(gabineteId, userId, role, {
      processoId: dto.processoId,
      autor: template.autor,
      actoType: template.actoType,
      title: dto.title ?? template.defaultTitle,
      description: dto.description ?? template.defaultDescription,
      actoDate: dto.actoDate,
      metadata: dto.metadata,
      generatePrazo: template.generatePrazo
        ? {
            type: template.generatePrazo.type as any,
            title: template.generatePrazo.title,
            daysAfter: template.generatePrazo.daysAfter,
            alertHoursBefore: template.generatePrazo.alertHoursBefore ?? 48,
          }
        : undefined,
      advanceToStage: template.advanceToStage,
    });
  }

  async update(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
    dto: UpdateTramitacaoDto,
  ): Promise<Result<any>> {
    try {
      const existing = await this.tramitacoesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Tramitacao not found', 'TRAMITACAO_NOT_FOUND');
      }

      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      if (dto.actoType) {
        const actoDef = TRAMITACAO_ACTO_TYPES.find((a) => a.key === dto.actoType);
        if (!actoDef) {
          return err('Tipo de acto invalido', 'INVALID_ACTO_TYPE');
        }
      }

      const updateData: any = { ...dto };
      if (dto.actoDate) {
        updateData.actoDate = new Date(dto.actoDate);
      }

      const updated = await this.tramitacoesRepository.update(
        gabineteId,
        id,
        updateData,
      );
      if (!updated) {
        return err('Tramitacao not found after update', 'TRAMITACAO_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { title: existing.title, actoType: existing.actoType },
        newValue: { title: updated.title, actoType: updated.actoType },
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update tramitacao', 'TRAMITACAO_UPDATE_FAILED');
    }
  }

  async delete(
    gabineteId: string,
    userId: string,
    role: KamaiaRole,
    id: string,
  ): Promise<Result<void>> {
    try {
      const existing = await this.tramitacoesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Tramitacao not found', 'TRAMITACAO_NOT_FOUND');
      }

      if (
        role === KamaiaRole.ADVOGADO_MEMBRO &&
        existing.processo.advogadoId !== userId
      ) {
        return err('Access denied', 'ACCESS_DENIED');
      }

      await this.tramitacoesRepository.softDelete(gabineteId, id);

      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.PROCESSO,
        entityId: id,
        userId,
        gabineteId,
        oldValue: {
          processoId: existing.processoId,
          actoType: existing.actoType,
          title: existing.title,
        },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete tramitacao', 'TRAMITACAO_DELETE_FAILED');
    }
  }
}
