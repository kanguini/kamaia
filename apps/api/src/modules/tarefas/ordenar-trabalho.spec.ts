import { ItemTrabalho, ordenarTrabalho } from '@kamaia/shared-types';

function item(id: string, prazo: string | null, peso = 1): ItemTrabalho {
  return {
    id,
    tipo: 'tarefa',
    titulo: id,
    prazo,
    contratoId: null,
    contratoNumero: null,
    pesoPrioridade: peso,
    href: `/x/${id}`,
  };
}

const AGORA = new Date('2026-06-28T12:00:00Z');

describe('ordenarTrabalho', () => {
  it('atrasados antes de futuros antes de sem-prazo', () => {
    const r = ordenarTrabalho(
      [
        item('futuro', '2026-07-10T00:00:00Z'),
        item('sem', null),
        item('atrasado', '2026-06-20T00:00:00Z'),
      ],
      AGORA,
    );
    expect(r.map((i) => i.id)).toEqual(['atrasado', 'futuro', 'sem']);
  });

  it('entre atrasados, o mais atrasado (prazo mais antigo) primeiro', () => {
    const r = ordenarTrabalho(
      [
        item('a2', '2026-06-25T00:00:00Z'),
        item('a1', '2026-06-10T00:00:00Z'),
      ],
      AGORA,
    );
    expect(r.map((i) => i.id)).toEqual(['a1', 'a2']);
  });

  it('entre futuros, prazo ascendente', () => {
    const r = ordenarTrabalho(
      [
        item('f2', '2026-08-01T00:00:00Z'),
        item('f1', '2026-07-01T00:00:00Z'),
      ],
      AGORA,
    );
    expect(r.map((i) => i.id)).toEqual(['f1', 'f2']);
  });

  it('sem prazo: prioridade descendente, depois id', () => {
    const r = ordenarTrabalho(
      [
        item('baixa', null, 0),
        item('urgente', null, 3),
        item('media', null, 1),
      ],
      AGORA,
    );
    expect(r.map((i) => i.id)).toEqual(['urgente', 'media', 'baixa']);
  });

  it('é puro (não muta o array de entrada)', () => {
    const entrada = [item('b', null), item('a', '2026-06-01T00:00:00Z')];
    const copia = [...entrada];
    ordenarTrabalho(entrada, AGORA);
    expect(entrada).toEqual(copia);
  });
});
