import { Role } from '@prisma/client';
import { z } from 'zod';
import { ToolRegistry } from './tool-registry';
import { defineTool, ToolContext } from './tool.types';

/**
 * Tests do ToolRegistry — validação, RBAC, audit, tenant isolation.
 *
 * Não usa NestJS dependency injection — instancia directamente para
 * isolar a lógica. AuditService é mockado para verificar chamadas.
 */

interface AuditCall {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  afterData?: unknown;
}

function makeMockAudit() {
  const calls: AuditCall[] = [];
  return {
    log: jest.fn(async (entry: AuditCall) => {
      calls.push(entry);
    }),
    calls,
  };
}

const CTX_BASE: ToolContext = {
  tenantId: 'tenant-A',
  userId: 'user-1',
  role: Role.ADMIN,
  conversationId: 'conv-1',
  messageId: 'msg-1',
};

describe('ToolRegistry', () => {
  describe('register / availableFor', () => {
    it('regista tool e devolve no availableFor da role correcta', () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      const tool = defineTool({
        name: 'find_things',
        description: 'find',
        schema: z.object({ q: z.string() }),
        requiredRoles: [Role.ADMIN],
        mutates: false,
        execute: async () => ({ result: {} }),
      });
      reg.register(tool);

      expect(reg.availableFor(Role.ADMIN)).toHaveLength(1);
      expect(reg.availableFor(Role.VIEWER)).toHaveLength(0);
    });

    it('lança ao registar tool com nome duplicado', () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      const tool = defineTool({
        name: 'dup',
        description: 'x',
        schema: z.object({}),
        requiredRoles: [],
        mutates: false,
        execute: async () => ({ result: {} }),
      });
      reg.register(tool);
      expect(() => reg.register(tool)).toThrow(/já registada/);
    });

    it('roles vazio = todas roles vêem a tool', () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'open',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [],
          mutates: false,
          execute: async () => ({ result: {} }),
        }),
      );
      expect(reg.availableFor(Role.VIEWER)).toHaveLength(1);
      expect(reg.availableFor(Role.EXTERNAL)).toHaveLength(1);
    });
  });

  describe('execute — validação Zod', () => {
    it('rejeita args inválidos com INVALID_ARGS', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 't',
          description: 'x',
          schema: z.object({ n: z.number().int().min(1) }),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async () => ({ result: { ok: true } }),
        }),
      );

      const r = await reg.execute('t', { n: -1 }, CTX_BASE);
      expect('error' in r && r.error.code).toBe('INVALID_ARGS');
    });

    it('aceita args válidos e invoca execute', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      const spy = jest.fn(async () => ({ result: { ok: true } }));
      reg.register(
        defineTool({
          name: 't',
          description: 'x',
          schema: z.object({ n: z.number() }),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: spy,
        }),
      );

      const r = await reg.execute('t', { n: 5 }, CTX_BASE);
      expect('error' in r).toBe(false);
      expect(spy).toHaveBeenCalledWith({ n: 5 }, CTX_BASE);
    });
  });

  describe('execute — RBAC', () => {
    it('rejeita com FORBIDDEN se role não autorizada', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'destruir',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [Role.ADMIN],
          mutates: true,
          execute: async () => ({ result: {} }),
        }),
      );

      const r = await reg.execute(
        'destruir',
        {},
        { ...CTX_BASE, role: Role.VIEWER },
      );
      expect('error' in r && r.error.code).toBe('FORBIDDEN');
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('execute — tool inexistente', () => {
    it('devolve TOOL_NOT_FOUND com lista das tools disponíveis', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'a',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [],
          mutates: false,
          execute: async () => ({ result: {} }),
        }),
      );

      const r = await reg.execute('zoo', {}, CTX_BASE);
      expect('error' in r && r.error.code).toBe('TOOL_NOT_FOUND');
      expect('error' in r && r.error.message).toContain('a');
    });
  });

  describe('execute — excepção inesperada', () => {
    it('converte excepção em EXECUTION_ERROR sem rebentar', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'crash',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async () => {
            throw new Error('boom');
          },
        }),
      );

      const r = await reg.execute('crash', {}, CTX_BASE);
      expect('error' in r && r.error.code).toBe('EXECUTION_ERROR');
    });
  });

  describe('execute — audit log', () => {
    it('regista audit log apenas para tools que mutam', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'read',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async () => ({ result: {} }),
        }),
      );
      reg.register(
        defineTool({
          name: 'mutate',
          description: 'x',
          schema: z.object({ v: z.string() }),
          requiredRoles: [Role.ADMIN],
          mutates: true,
          execute: async () => ({ result: {} }),
        }),
      );

      await reg.execute('read', {}, CTX_BASE);
      expect(audit.log).not.toHaveBeenCalled();

      // Mutação confirmada (allowMutations) executa e audita.
      await reg.execute('mutate', { v: 'x' }, { ...CTX_BASE, allowMutations: true });
      expect(audit.log).toHaveBeenCalledTimes(1);
      const call = audit.calls[0];
      expect(call.tenantId).toBe('tenant-A');
      expect(call.entityId).toBe('conv-1');
      expect(
        (call.afterData as { aiAgent: { toolName: string } }).aiAgent.toolName,
      ).toBe('mutate');
    });
  });

  describe('execute — gate de confirmação de mutações', () => {
    it('tool mutates sem allowMutations NÃO executa e devolve CONFIRMATION_REQUIRED', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      const execSpy = jest.fn(async () => ({ result: { ok: true } }));
      reg.register(
        defineTool({
          name: 'mutate',
          description: 'x',
          schema: z.object({ v: z.string() }),
          requiredRoles: [Role.ADMIN],
          mutates: true,
          execute: execSpy,
        }),
      );

      const out = await reg.execute('mutate', { v: 'x' }, CTX_BASE);
      expect('error' in out && out.error.code).toBe('CONFIRMATION_REQUIRED');
      expect(execSpy).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();

      // Com allowMutations, executa.
      const ok = await reg.execute('mutate', { v: 'x' }, { ...CTX_BASE, allowMutations: true });
      expect('result' in ok).toBe(true);
      expect(execSpy).toHaveBeenCalledTimes(1);
    });

    it('needsConfirmation(args) sobrepõe mutates — leitura pura não gateia', async () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      const execSpy = jest.fn(async () => ({ result: { ok: true } }));
      reg.register(
        defineTool({
          name: 'find_or_create',
          description: 'x',
          schema: z.object({ create: z.boolean().default(false) }),
          requiredRoles: [Role.ADMIN],
          mutates: true,
          needsConfirmation: (args: { create: boolean }) => args.create === true,
          execute: execSpy,
        }),
      );

      // create=false → não gateia, executa.
      const lookup = await reg.execute('find_or_create', { create: false }, CTX_BASE);
      expect('result' in lookup).toBe(true);
      // create=true → gateia.
      const willCreate = await reg.execute('find_or_create', { create: true }, CTX_BASE);
      expect('error' in willCreate && willCreate.error.code).toBe('CONFIRMATION_REQUIRED');
    });
  });

  describe('execute — tenant isolation', () => {
    it('args podem incluir tenantId mas o ctx.tenantId é o que conta', async () => {
      // Defesa contra prompt injection: o LLM podia ser convencido a
      // mandar `tenantId: "OUTRO"` nos args. Garantimos que o ctx
      // é o source of truth — o execute recebe ctx, args separado.
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      let capturedCtx: ToolContext | null = null;
      reg.register(
        defineTool({
          name: 't',
          description: 'x',
          schema: z.object({ q: z.string() }).passthrough(),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async (_args, ctx) => {
            capturedCtx = ctx;
            return { result: {} };
          },
        }),
      );

      await reg.execute('t', { q: 'x', tenantId: 'INJECTED' }, CTX_BASE);
      expect(capturedCtx!.tenantId).toBe('tenant-A'); // do ctx, não dos args
    });
  });

  describe('specsFor', () => {
    it('gera spec Anthropic correcto a partir do schema Zod', () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'find_x',
          description: 'Encontra coisas',
          schema: z.object({
            search: z.string().describe('Termo de pesquisa').optional(),
            limit: z.number().int().min(1).max(100).optional(),
          }),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async () => ({ result: {} }),
        }),
      );

      const specs = reg.specsFor(Role.ADMIN);
      expect(specs).toHaveLength(1);
      expect(specs[0].name).toBe('find_x');
      expect(specs[0].description).toBe('Encontra coisas');
      expect(specs[0].input_schema.type).toBe('object');
      expect(specs[0].input_schema.properties.search).toBeDefined();
      expect(specs[0].input_schema.properties.limit).toBeDefined();
    });

    it('não devolve specs de tools que a role não pode usar', () => {
      const audit = makeMockAudit();
      const reg = new ToolRegistry(audit as never);
      reg.register(
        defineTool({
          name: 'admin_only',
          description: 'x',
          schema: z.object({}),
          requiredRoles: [Role.ADMIN],
          mutates: false,
          execute: async () => ({ result: {} }),
        }),
      );
      expect(reg.specsFor(Role.VIEWER)).toHaveLength(0);
    });
  });
});
