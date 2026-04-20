import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IaService } from './ia.service';
import { IaRepository } from './ia.repository';
import { AuditService } from '../audit/audit.service';
import { RagService } from '../rag/rag.service';

describe('IaService', () => {
  let service: IaService;
  let repository: IaRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IaService,
        {
          provide: IaRepository,
          useValue: {
            findConversations: jest.fn(),
            findConversation: jest.fn(),
            createConversation: jest.fn(),
            softDeleteConversation: jest.fn(),
            createMessage: jest.fn(),
            updateConversationTitle: jest.fn(),
            getUsageQuota: jest.fn(),
            incrementAiQueries: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            // GEMINI_API_KEY not set → service uses fallback mock responses
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: RagService,
          useValue: {
            retrieveContext: jest.fn().mockResolvedValue({ success: false }),
            formatContextForPrompt: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<IaService>(IaService);
    repository = module.get<IaRepository>(IaRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findConversations', () => {
    it('should return paginated conversations', async () => {
      const mockResult = {
        data: [
          {
            id: 'conv-1',
            title: 'Test Conversation',
            context: 'GERAL',
            contextId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { messages: 2 },
          },
        ],
        nextCursor: null,
        total: 1,
      };

      jest.spyOn(repository, 'findConversations').mockResolvedValue(mockResult);

      const result = await service.findConversations(
        'gabinete-1',
        'user-1',
        { limit: 20 },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(1);
        expect(result.data.data).toHaveLength(1);
      }
    });
  });

  describe('sendMessage', () => {
    it('should reject when quota exceeded', async () => {
      const mockConversation = {
        id: 'conv-1',
        title: 'Test',
        context: 'GERAL',
        messages: [],
      };

      const mockQuota = {
        aiQueriesUsed: 10,
        gabinete: { plan: 'FREE' },
      };

      jest
        .spyOn(repository, 'findConversation')
        .mockResolvedValue(mockConversation as any);
      jest.spyOn(repository, 'getUsageQuota').mockResolvedValue(mockQuota as any);

      const result = await service.sendMessage(
        'gabinete-1',
        'user-1',
        'conv-1',
        'Test message',
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('QUOTA_EXCEEDED');
      }
    });
  });

  describe('generateResponse (fallback mode)', () => {
    it('should return a non-empty fallback string when Gemini is not configured', async () => {
      // Gemini API key is mocked to undefined, so the service uses the fallback path
      const response = await (service as any).generateResponse('Qual é o prazo para contestar?', []);
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(10);
    });

    it('should return fallback response mentioning demo mode', async () => {
      const response = await (service as any).generateResponse('Random question', []);
      expect(response).toContain('demonstracao');
    });
  });
});
