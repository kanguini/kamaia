import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AuditService } from '../audit/audit.service';
import { EmailProvider } from '../notifications/providers/email.provider';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

// Fake user shape — só os campos que auth.service.login consulta.
function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'advogado@kamaia.cc',
    passwordHash: 'hashed',
    firstName: 'Ana',
    lastName: 'Silva',
    role: 'ADVOGADO_SOLO',
    gabineteId: 'gab-1',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    gabinete: { isActive: true, plan: 'FREE' },
    ...overrides,
  };
}

describe('AuthService account lockout', () => {
  let service: AuthService;
  let authRepo: jest.Mocked<AuthRepository>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    authRepo = {
      findUserByEmail: jest.fn(),
      incrementFailedLogins: jest.fn(),
      createSession: jest.fn(),
      updateLastLogin: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;

    const jwt = {
      sign: jest.fn().mockReturnValue('jwt.token'),
    } as unknown as JwtService;

    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;

    const email = {
      send: jest.fn().mockResolvedValue({ status: 'DRY_RUN' }),
      isEnabled: false,
    } as unknown as EmailProvider;

    service = new AuthService(authRepo, jwt, config, auditService, email);
  });

  it('recusa imediatamente se conta está bloqueada (lockedUntil > now)', async () => {
    const future = new Date(Date.now() + 5 * 60_000);
    authRepo.findUserByEmail.mockResolvedValue(
      makeUser({ lockedUntil: future }) as never,
    );

    const result = await service.login({
      email: 'advogado@kamaia.cc',
      password: 'qualquer',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('ACCOUNT_LOCKED');
    }
    // bcrypt.compare NÃO deve ter sido chamado — recusa antes.
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(authRepo.incrementFailedLogins).not.toHaveBeenCalled();
  });

  it('aceita login se lockedUntil já expirou', async () => {
    const past = new Date(Date.now() - 60_000);
    authRepo.findUserByEmail.mockResolvedValue(
      makeUser({ lockedUntil: past, failedLoginAttempts: 5 }) as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'advogado@kamaia.cc',
      password: 'correcta',
    });

    expect(result.success).toBe(true);
    expect(authRepo.updateLastLogin).toHaveBeenCalledWith('user-1');
  });

  it('incrementa failedLoginAttempts em password errada (sem lock)', async () => {
    authRepo.findUserByEmail.mockResolvedValue(
      makeUser({ failedLoginAttempts: 2 }) as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    authRepo.incrementFailedLogins.mockResolvedValue({
      failedLoginAttempts: 3,
      lockedUntil: null,
    } as never);

    const result = await service.login({
      email: 'advogado@kamaia.cc',
      password: 'errada',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_CREDENTIALS');
    }
    expect(authRepo.incrementFailedLogins).toHaveBeenCalledWith(
      'user-1',
      null, // não passa lock — ainda não atingiu o máximo
    );
  });

  it('bloqueia conta ao atingir MAX_FAILED_LOGINS', async () => {
    // 4 tentativas falhadas anteriores; a 5ª (esta) deve bloquear.
    authRepo.findUserByEmail.mockResolvedValue(
      makeUser({ failedLoginAttempts: 4 }) as never,
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    authRepo.incrementFailedLogins.mockResolvedValue({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 15 * 60_000),
    } as never);

    const result = await service.login({
      email: 'advogado@kamaia.cc',
      password: 'errada',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('ACCOUNT_LOCKED');
    }
    // O 2º argumento de incrementFailedLogins é o Date do lock
    expect(authRepo.incrementFailedLogins).toHaveBeenCalledTimes(1);
    const [_id, lockArg] = authRepo.incrementFailedLogins.mock.calls[0];
    expect(lockArg).toBeInstanceOf(Date);
    // Lock deve durar ~15 min — toleramos ±5s de drift do teste.
    const expectedMs = 15 * 60_000;
    const actualMs = (lockArg as Date).getTime() - Date.now();
    expect(actualMs).toBeGreaterThan(expectedMs - 5_000);
    expect(actualMs).toBeLessThan(expectedMs + 5_000);

    // E o audit log deve registar ACCOUNT_LOCKED, não LOGIN_FAILED.
    const auditCall = (auditService.log as jest.Mock).mock.calls.find(
      ([entry]) => entry.action === 'ACCOUNT_LOCKED',
    );
    expect(auditCall).toBeDefined();
  });
});
