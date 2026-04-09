import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsRepository } from './timesheets.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TimesheetsService', () => {
  let service: TimesheetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        {
          provide: TimesheetsRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            getSummary: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            timeEntry: {},
            processo: {},
          },
        },
      ],
    }).compile();

    service = module.get<TimesheetsService>(TimesheetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
