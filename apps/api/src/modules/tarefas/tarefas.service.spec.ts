import { TarefaEstado } from '@kamaia/shared-types';
import { TarefasService } from './tarefas.service';

// Foco no que tem lógica: o carimbo de conclusão (quem/quando) e a
// reabertura (limpar esses campos). O resto é CRUD passthrough.

interface Captured {
  data?: Record<string, unknown>;
}

function makeService(estadoAtual: TarefaEstado, captured: Captured) {
  const prisma = {
    tarefa: {
      findFirst: jest.fn().mockResolvedValue({ id: 't1', estado: estadoAtual }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        captured.data = data;
        return Promise.resolve({ id: 't1', estado: data.estado ?? estadoAtual });
      }),
    },
    membership: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
  };
  const audit = { log: jest.fn() };
  const svc = new TarefasService(
    prisma as unknown as never,
    audit as unknown as never,
  );
  return svc;
}

describe('TarefasService.update — carimbo de conclusão', () => {
  it('ao concluir, carimba concluidaEm + concluidaPor', async () => {
    const cap: Captured = {};
    const svc = makeService(TarefaEstado.A_FAZER, cap);
    await svc.update('tenant', 'user-1', 't1', { estado: TarefaEstado.CONCLUIDA });
    expect(cap.data?.estado).toBe(TarefaEstado.CONCLUIDA);
    expect(cap.data?.concluidaEm).toBeInstanceOf(Date);
    expect(cap.data?.concluidaPor).toBe('user-1');
  });

  it('ao reabrir uma concluída, limpa concluidaEm + concluidaPor', async () => {
    const cap: Captured = {};
    const svc = makeService(TarefaEstado.CONCLUIDA, cap);
    await svc.update('tenant', 'user-1', 't1', { estado: TarefaEstado.EM_CURSO });
    expect(cap.data?.estado).toBe(TarefaEstado.EM_CURSO);
    expect(cap.data?.concluidaEm).toBeNull();
    expect(cap.data?.concluidaPor).toBeNull();
  });

  it('cancelar uma concluída PRESERVA o carimbo (não reabre)', async () => {
    const cap: Captured = {};
    const svc = makeService(TarefaEstado.CONCLUIDA, cap);
    await svc.update('tenant', 'user-1', 't1', { estado: TarefaEstado.CANCELADA });
    expect(cap.data?.estado).toBe(TarefaEstado.CANCELADA);
    expect('concluidaEm' in (cap.data ?? {})).toBe(false);
  });

  it('sem mudança de estado, não toca nos campos de conclusão', async () => {
    const cap: Captured = {};
    const svc = makeService(TarefaEstado.EM_CURSO, cap);
    await svc.update('tenant', 'user-1', 't1', { titulo: 'novo título' });
    expect(cap.data?.estado).toBeUndefined();
    expect('concluidaEm' in (cap.data ?? {})).toBe(false);
  });
});
