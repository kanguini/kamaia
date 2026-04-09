import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: ExpensesRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            getTotalByProcesso: jest.fn(),
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
            expense: {},
            processo: {},
          },
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
