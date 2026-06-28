import {
  AccaoContrato,
  ContratoEstado,
  ContratoOrigem,
  contratoCapacidades,
  contratoFase,
  contratoPode,
  contratoRail,
} from '@kamaia/shared-types';

// Resolver puro de visualização por fase. Estes testes são a fonte de
// verdade dos invariantes do produto: um contrato em vigor não edita
// nem assina; um herdado entra a meio; o gate é honesto (pode === lista).

const TODOS_ESTADOS = Object.values(ContratoEstado);

const TODAS_ACCOES: AccaoContrato[] = [
  'EDITAR_CORPO',
  'NOVA_VERSAO',
  'ENVIAR_NEGOCIACAO',
  'NOVO_PONTO',
  'COMPARAR',
  'COMENTAR',
  'APROVAR',
  'PEDIR_ASSINATURA',
  'PARTILHAR_LINK',
  'REGISTAR_ASSINATURA',
  'ADICIONAR_ADENDA',
  'ACTIVAR',
  'CONCLUIR_SUBCICLO',
  'GERIR_DATAS',
  'GERIR_OBRIGACOES',
  'RENOVAR',
  'TERMINAR',
  'REVER_COMPLIANCE',
  'ARQUIVAR',
  'DESCARREGAR',
];

describe('contratoFase — agrupamento dos 17 estados', () => {
  it('mapeia cada estado para uma fase válida (exaustivo)', () => {
    for (const estado of TODOS_ESTADOS) {
      expect(contratoFase(estado)).toBeDefined();
    }
  });

  it.each([
    [ContratoEstado.INTAKE, 'RASCUNHO'],
    [ContratoEstado.DRAFTING, 'RASCUNHO'],
    [ContratoEstado.REV_INTERNA, 'RASCUNHO'],
    [ContratoEstado.REV_CLIENTE, 'RASCUNHO'],
    [ContratoEstado.EM_NEGOCIACAO, 'NEGOCIACAO'],
    [ContratoEstado.APROVACAO, 'NEGOCIACAO'],
    [ContratoEstado.PRONTO_ASSINATURA, 'ASSINATURA'],
    [ContratoEstado.ASSINADO, 'ASSINATURA'],
    [ContratoEstado.POS_ASSINATURA, 'EM_VIGOR'],
    [ContratoEstado.ACTIVO, 'EM_VIGOR'],
    [ContratoEstado.REPOSITORIO, 'EM_VIGOR'],
    [ContratoEstado.EM_DISPUTA, 'SUBCICLO'],
    [ContratoEstado.EM_ADENDA, 'SUBCICLO'],
    [ContratoEstado.EM_TERMINACAO, 'SUBCICLO'],
    [ContratoEstado.TERMINADO, 'ENCERRADO'],
    [ContratoEstado.ARQUIVADO, 'ENCERRADO'],
    [ContratoEstado.CANCELADO, 'ENCERRADO'],
  ])('%s → %s', (estado, fase) => {
    expect(contratoFase(estado)).toBe(fase);
  });
});

describe('contratoCapacidades — invariantes transversais', () => {
  const combinacoes = TODOS_ESTADOS.flatMap((estado) =>
    Object.values(ContratoOrigem).map((origem) => ({ estado, origem })),
  );

  it('pode(a) é exactamente igual a accoesPermitidas.includes(a)', () => {
    for (const { estado, origem } of combinacoes) {
      const caps = contratoCapacidades(estado, origem);
      for (const accao of TODAS_ACCOES) {
        expect(caps.pode(accao)).toBe(caps.accoesPermitidas.includes(accao));
      }
    }
  });

  it('a acção primária e as secundárias estão sempre dentro do gate', () => {
    for (const { estado, origem } of combinacoes) {
      const caps = contratoCapacidades(estado, origem);
      if (caps.accaoPrimaria) {
        expect(caps.accoesPermitidas).toContain(caps.accaoPrimaria);
      }
      for (const a of caps.accoes) {
        expect(caps.accoesPermitidas).toContain(a);
      }
    }
  });
});

describe('REGRA DE PRODUTO — corpo só é editável antes de assinar', () => {
  it('EDITAR_CORPO permitido apenas em RASCUNHO e NEGOCIACAO', () => {
    for (const estado of TODOS_ESTADOS) {
      const caps = contratoCapacidades(estado, ContratoOrigem.CRIADO_INTERNAMENTE);
      const esperado = caps.fase === 'RASCUNHO' || caps.fase === 'NEGOCIACAO';
      expect(caps.pode('EDITAR_CORPO')).toBe(esperado);
    }
  });

  it('ADICIONAR_ADENDA permitido apenas em ACTIVO (não em repositório nem pós-assinatura)', () => {
    for (const estado of TODOS_ESTADOS) {
      const caps = contratoCapacidades(estado, ContratoOrigem.CRIADO_INTERNAMENTE);
      expect(caps.pode('ADICIONAR_ADENDA')).toBe(estado === ContratoEstado.ACTIVO);
    }
  });

  it('ACTIVAR permitido apenas em REPOSITORIO (herdado em arquivo)', () => {
    for (const estado of TODOS_ESTADOS) {
      const caps = contratoCapacidades(estado, ContratoOrigem.IMPORTADO_REPOSITORIO);
      expect(caps.pode('ACTIVAR')).toBe(estado === ContratoEstado.REPOSITORIO);
    }
  });

  it('assinatura (pedir/registar) permitida apenas na fase ASSINATURA', () => {
    for (const estado of TODOS_ESTADOS) {
      const caps = contratoCapacidades(estado, ContratoOrigem.CRIADO_INTERNAMENTE);
      const naAssinatura = caps.fase === 'ASSINATURA';
      expect(caps.pode('PEDIR_ASSINATURA')).toBe(naAssinatura);
      expect(caps.pode('REGISTAR_ASSINATURA')).toBe(naAssinatura);
    }
  });
});

describe('Caso central — contrato ACTIVO criado', () => {
  const caps = contratoCapacidades(
    ContratoEstado.ACTIVO,
    ContratoOrigem.CRIADO_INTERNAMENTE,
  );

  it('a acção primária é Adicionar adenda', () => {
    expect(caps.accaoPrimaria).toBe('ADICIONAR_ADENDA');
  });
  it('não permite editar corpo nem assinar', () => {
    expect(caps.pode('EDITAR_CORPO')).toBe(false);
    expect(caps.pode('PEDIR_ASSINATURA')).toBe(false);
  });
  it('mostra tabs de gestão, sem Editor', () => {
    expect(caps.tabs).toContain('COMPLIANCE');
    expect(caps.tabs).toContain('OBRIGACOES');
    expect(caps.tabs).not.toContain('EDITOR');
  });
  it('rail é a de contrato criado, passo actual em Em vigor (4)', () => {
    const rail = contratoRail(ContratoEstado.ACTIVO);
    expect(rail.variant).toBe('CRIADO');
    expect(rail.currentIndex).toBe(4);
  });
});

describe('Caso central — contrato HERDADO em repositório', () => {
  const caps = contratoCapacidades(
    ContratoEstado.REPOSITORIO,
    ContratoOrigem.IMPORTADO_REPOSITORIO,
  );

  it('fase EM_VIGOR com rail colapsada de herdado', () => {
    expect(caps.fase).toBe('EM_VIGOR');
    expect(caps.railVariant).toBe('HERDADO');
  });
  it('em repositório a primária é Activar (ainda não está em gestão)', () => {
    expect(caps.accaoPrimaria).toBe('ACTIVAR');
    expect(caps.pode('ADICIONAR_ADENDA')).toBe(false);
  });
  it('herdado já ACTIVO passa a ter Adicionar adenda como primária', () => {
    const ativo = contratoCapacidades(
      ContratoEstado.ACTIVO,
      ContratoOrigem.IMPORTADO_REPOSITORIO,
    );
    expect(ativo.accaoPrimaria).toBe('ADICIONAR_ADENDA');
    expect(ativo.railVariant).toBe('HERDADO');
  });
  it('rail tem 4 passos e começa em Importado (0)', () => {
    const rail = contratoRail(
      ContratoEstado.REPOSITORIO,
      ContratoOrigem.IMPORTADO_REPOSITORIO,
    );
    expect(rail.variant).toBe('HERDADO');
    expect(rail.steps).toHaveLength(4);
    expect(rail.currentIndex).toBe(0);
  });
  it('herdado em ACTIVO avança para Em vigor (1)', () => {
    const rail = contratoRail(
      ContratoEstado.ACTIVO,
      ContratoOrigem.IMPORTADO_REPOSITORIO,
    );
    expect(rail.currentIndex).toBe(1);
  });
});

describe('Caso — DRAFTING', () => {
  const caps = contratoCapacidades(ContratoEstado.DRAFTING);
  it('primária é Editar corpo; sem adenda', () => {
    expect(caps.accaoPrimaria).toBe('EDITAR_CORPO');
    expect(caps.pode('ADICIONAR_ADENDA')).toBe(false);
  });
  it('rail criada, passo Elaboração (1)', () => {
    expect(contratoRail(ContratoEstado.DRAFTING).currentIndex).toBe(1);
  });
});

describe('Caso — SUBCICLO (adenda em curso)', () => {
  const caps = contratoCapacidades(ContratoEstado.EM_ADENDA);
  it('tem aviso e acção primária Concluir', () => {
    expect(caps.fase).toBe('SUBCICLO');
    expect(caps.aviso).toBeTruthy();
    expect(caps.accaoPrimaria).toBe('CONCLUIR_SUBCICLO');
  });
  it('não permite abrir nova adenda em paralelo', () => {
    expect(caps.pode('ADICIONAR_ADENDA')).toBe(false);
  });
});

describe('Caso — ENCERRADO', () => {
  it('TERMINADO permite arquivar e descarregar, sem primária', () => {
    const caps = contratoCapacidades(ContratoEstado.TERMINADO);
    expect(caps.accaoPrimaria).toBeNull();
    expect(caps.pode('ARQUIVAR')).toBe(true);
    expect(caps.pode('DESCARREGAR')).toBe(true);
  });
  it('ARQUIVADO já não permite arquivar', () => {
    const caps = contratoCapacidades(ContratoEstado.ARQUIVADO);
    expect(caps.pode('ARQUIVAR')).toBe(false);
    expect(caps.accoesPermitidas).toEqual(['DESCARREGAR']);
  });
});

describe('contratoRail — casos de fronteira', () => {
  it('CANCELADO marca cancelado e currentIndex -1', () => {
    const rail = contratoRail(ContratoEstado.CANCELADO);
    expect(rail.cancelado).toBe(true);
    expect(rail.currentIndex).toBe(-1);
  });
  it('origem por omissão é tratada como criado', () => {
    expect(contratoRail(ContratoEstado.ACTIVO).variant).toBe('CRIADO');
    expect(contratoCapacidades(ContratoEstado.ACTIVO).railVariant).toBe('CRIADO');
  });
});

describe('contratoPode — gate standalone (usado pelos guards)', () => {
  it('concorda com o objecto de capacidades em todas as combinações', () => {
    for (const estado of TODOS_ESTADOS) {
      for (const origem of Object.values(ContratoOrigem)) {
        const caps = contratoCapacidades(estado, origem);
        for (const accao of TODAS_ACCOES) {
          expect(contratoPode(estado, origem, accao)).toBe(caps.pode(accao));
        }
      }
    }
  });
});
