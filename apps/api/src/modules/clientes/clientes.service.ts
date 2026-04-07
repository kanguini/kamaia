import { Injectable } from '@nestjs/common';
import { ClientesRepository, ListClientesParams } from './clientes.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  Result,
  ok,
  err,
  PaginatedResponse,
  AuditAction,
  EntityType,
  PLAN_LIMITS,
} from '@kamaia/shared-types';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';

@Injectable()
export class ClientesService {
  constructor(
    private clientesRepository: ClientesRepository,
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async findAll(
    gabineteId: string,
    params: ListClientesParams,
  ): Promise<Result<PaginatedResponse<any>>> {
    try {
      const result = await this.clientesRepository.findAll(gabineteId, params);
      return ok(result);
    } catch (error) {
      return err('Failed to fetch clientes', 'CLIENTES_FETCH_FAILED');
    }
  }

  async findById(gabineteId: string, id: string): Promise<Result<any>> {
    try {
      const cliente = await this.clientesRepository.findById(gabineteId, id);

      if (!cliente) {
        return err('Cliente not found', 'CLIENTE_NOT_FOUND');
      }

      return ok(cliente);
    } catch (error) {
      return err('Failed to fetch cliente', 'CLIENTE_FETCH_FAILED');
    }
  }

  async create(
    gabineteId: string,
    userId: string,
    dto: CreateClienteDto,
  ): Promise<Result<any>> {
    try {
      // Check quota
      const gabinete = await this.prisma.gabinete.findUnique({
        where: { id: gabineteId },
        select: { plan: true },
      });

      if (!gabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      const currentCount = await this.clientesRepository.countByGabinete(gabineteId);
      const limit = PLAN_LIMITS[gabinete.plan as keyof typeof PLAN_LIMITS].clientes;

      if (limit !== -1 && currentCount >= limit) {
        return err('Client quota exceeded for current plan', 'QUOTA_EXCEEDED');
      }

      // Check NIF uniqueness
      if (dto.nif) {
        const nifExists = await this.clientesRepository.existsByNif(gabineteId, dto.nif);
        if (nifExists) {
          return err('NIF already exists', 'NIF_EXISTS');
        }
      }

      const cliente = await this.clientesRepository.create(gabineteId, userId, dto);

      // Audit log
      await this.auditService.log({
        action: AuditAction.CREATE,
        entity: EntityType.CLIENTE,
        entityId: cliente.id,
        userId,
        gabineteId,
        newValue: { name: cliente.name, type: cliente.type },
      });

      return ok(cliente);
    } catch (error) {
      return err('Failed to create cliente', 'CLIENTE_CREATE_FAILED');
    }
  }

  async update(
    gabineteId: string,
    userId: string,
    id: string,
    dto: UpdateClienteDto,
  ): Promise<Result<any>> {
    try {
      // Check cliente exists
      const existing = await this.clientesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Cliente not found', 'CLIENTE_NOT_FOUND');
      }

      // Check NIF uniqueness if changed
      if (dto.nif && dto.nif !== existing.nif) {
        const nifExists = await this.clientesRepository.existsByNif(gabineteId, dto.nif, id);
        if (nifExists) {
          return err('NIF already exists', 'NIF_EXISTS');
        }
      }

      const cliente = await this.clientesRepository.update(gabineteId, id, dto);
      if (!cliente) {
        return err('Cliente not found after update', 'CLIENTE_NOT_FOUND');
      }

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CLIENTE,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { name: existing.name },
        newValue: { name: cliente.name },
      });

      return ok(cliente);
    } catch (error) {
      return err('Failed to update cliente', 'CLIENTE_UPDATE_FAILED');
    }
  }

  async delete(gabineteId: string, userId: string, id: string): Promise<Result<void>> {
    try {
      const existing = await this.clientesRepository.findById(gabineteId, id);
      if (!existing) {
        return err('Cliente not found', 'CLIENTE_NOT_FOUND');
      }

      await this.clientesRepository.softDelete(gabineteId, id);

      // Audit log
      await this.auditService.log({
        action: AuditAction.DELETE,
        entity: EntityType.CLIENTE,
        entityId: id,
        userId,
        gabineteId,
        oldValue: { name: existing.name },
      });

      return ok(undefined);
    } catch (error) {
      return err('Failed to delete cliente', 'CLIENTE_DELETE_FAILED');
    }
  }
}
