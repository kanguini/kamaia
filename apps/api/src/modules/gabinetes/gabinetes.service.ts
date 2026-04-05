import { Injectable } from '@nestjs/common';
import { GabinetesRepository } from './gabinetes.repository';
import { AuditService } from '../audit/audit.service';
import { Result, ok, err, AuditAction, EntityType } from '@kamaia/shared-types';
import { UpdateGabineteDto } from './gabinetes.dto';

@Injectable()
export class GabinetesService {
  constructor(
    private gabinetesRepository: GabinetesRepository,
    private auditService: AuditService,
  ) {}

  async getCurrent(gabineteId: string): Promise<Result<any>> {
    try {
      const gabinete = await this.gabinetesRepository.findById(gabineteId);

      if (!gabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      return ok(gabinete);
    } catch (error) {
      return err('Failed to fetch gabinete', 'GABINETE_FETCH_FAILED');
    }
  }

  async updateCurrent(
    gabineteId: string,
    userId: string,
    data: UpdateGabineteDto,
    ip?: string,
    userAgent?: string,
  ): Promise<Result<any>> {
    try {
      const oldGabinete = await this.gabinetesRepository.findById(gabineteId);

      if (!oldGabinete) {
        return err('Gabinete not found', 'GABINETE_NOT_FOUND');
      }

      const updated = await this.gabinetesRepository.update(gabineteId, data);

      // Log audit
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entity: EntityType.GABINETE,
        entityId: gabineteId,
        userId,
        gabineteId,
        oldValue: oldGabinete,
        newValue: updated,
        ip,
        userAgent,
      });

      return ok(updated);
    } catch (error) {
      return err('Failed to update gabinete', 'GABINETE_UPDATE_FAILED');
    }
  }
}
