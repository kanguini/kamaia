import { AuditAction, EntityType } from '@kamaia/shared-types';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';

describe('AuditService', () => {
  let repo: jest.Mocked<AuditRepository>;
  let service: AuditService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
    } as unknown as jest.Mocked<AuditRepository>;
    service = new AuditService(repo);
  });

  it('grava entrada no audit log com a entry completa', async () => {
    const entry = {
      action: AuditAction.LOGIN,
      entity: EntityType.USER,
      entityId: 'user-1',
      userId: 'user-1',
      gabineteId: 'gab-1',
      ip: '1.2.3.4',
      userAgent: 'jest',
    };
    repo.create.mockResolvedValue({} as never);
    await service.log(entry);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(entry);
  });

  it('NUNCA propaga erro do repositório (audit é append-only best-effort)', async () => {
    repo.create.mockRejectedValue(new Error('DB unavailable'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      service.log({
        action: AuditAction.UPDATE,
        entity: EntityType.CLIENTE,
        entityId: 'c-1',
        userId: 'u-1',
        gabineteId: 'g-1',
      }),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
