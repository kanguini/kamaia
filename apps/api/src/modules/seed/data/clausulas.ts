/**
 * Biblioteca-base de cláusulas-padrão pt-AO para contratos comerciais.
 *
 * Estes textos são pontos de partida defensáveis no quadro jurídico
 * angolano — não constituem aconselhamento. Cada cláusula é semeada
 * `isApproved=true` para o tenant demo, com `tags` que identificam o
 * domínio aplicável (matched pelo `IaDraftingService` quando monta
 * contexto para o Claude).
 *
 * Fontes de referência (não citadas no texto):
 *  - Código Civil angolano (Decreto-Lei n.º 47344, 1966, com adaptações)
 *  - Lei das Sociedades Comerciais (Lei n.º 1/04)
 *  - Código do Imposto de Selo / TGIS (Decreto Legislativo Presidencial n.º 3/14)
 *  - Lei Cambial (Lei n.º 5/97 + alterações BNA)
 *  - Lei n.º 22/11 — Dados Pessoais
 *  - Lei n.º 5/02 — Bases das Instituições Financeiras (quando aplicável)
 */

export interface ClausulaSeed {
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  leiAplicavelArt?: string;
}

export const CLAUSULAS_BASE_SEED: ClausulaSeed[] = [
  // ─── Objecto ─────────────────────────────────────────
  {
    categoria: 'OBJECTO',
    titulo: 'Objecto (prestação de serviços)',
    conteudo:
      'O presente contrato tem por objecto a prestação, pelo Prestador à Cliente, dos serviços descritos no Anexo I, executados nas condições, prazos e termos estabelecidos no presente contrato.',
    tags: ['SERVICOS', 'PRESTACAO_SERVICOS', 'CONSULTORIA'],
  },
  {
    categoria: 'OBJECTO',
    titulo: 'Objecto (compra e venda)',
    conteudo:
      'Pelo presente contrato, o Vendedor vende e a Compradora compra os bens identificados no Anexo I, livres de quaisquer ónus, encargos ou direitos de terceiros, nas condições estabelecidas no presente clausulado.',
    tags: ['BENS', 'COMPRA_VENDA'],
  },
  {
    categoria: 'OBJECTO',
    titulo: 'Objecto (arrendamento)',
    conteudo:
      'O Senhorio dá de arrendamento à Inquilina, que aceita, o imóvel identificado no preâmbulo, destinado exclusivamente ao fim contratual aí indicado, com início de vigência na data e nas condições do presente contrato.',
    tags: ['IMOBILIARIO', 'ARRENDAMENTO'],
  },

  // ─── Preço / Contrapartida ──────────────────────────
  {
    categoria: 'PRECO',
    titulo: 'Preço e modo de pagamento (serviços)',
    conteudo:
      'Como contrapartida pela prestação dos serviços, a Cliente pagará ao Prestador o valor mensal de [A COMPLETAR — montante e moeda], a liquidar até ao dia 10 do mês subsequente ao da prestação, mediante factura legal emitida nos termos do Código Geral Tributário e regulamentação AGT aplicável. O pagamento será efectuado por transferência bancária para a conta indicada pelo Prestador, sendo da responsabilidade da Cliente os encargos da operação cambial, quando aplicáveis.',
    tags: ['SERVICOS', 'CONSULTORIA', 'PAGAMENTO'],
  },
  {
    categoria: 'PRECO',
    titulo: 'Preço (compra e venda)',
    conteudo:
      'O preço global da compra e venda é de [A COMPLETAR — valor], a ser pago pela Compradora ao Vendedor da seguinte forma: [A COMPLETAR — calendário]. Salvo indicação em contrário, todos os valores indicam-se em Kwanzas (AOA) e excluem o Imposto sobre o Valor Acrescentado (IVA) que, sendo devido, será adicionado e suportado pela Compradora.',
    tags: ['BENS', 'COMPRA_VENDA', 'PAGAMENTO'],
  },
  {
    categoria: 'PRECO',
    titulo: 'Renda mensal e actualização',
    conteudo:
      'A renda mensal inicial é de [A COMPLETAR — valor], a pagar até ao dia 8 de cada mês a que respeita, na conta do Senhorio. A renda será actualizada anualmente em função da variação do índice de preços no consumidor publicado pelo INE de Angola, salvo acordo em contrário.',
    tags: ['IMOBILIARIO', 'ARRENDAMENTO', 'PAGAMENTO'],
  },

  // ─── Prazo / Vigência ───────────────────────────────
  {
    categoria: 'PRAZO',
    titulo: 'Prazo e vigência',
    conteudo:
      'O presente contrato entra em vigor na data da sua assinatura e produz efeitos por um período inicial de [A COMPLETAR — meses/anos], findo o qual se considera automaticamente renovado por períodos sucessivos de igual duração, salvo denúncia de qualquer das Partes comunicada à contraparte com antecedência mínima de 60 (sessenta) dias relativamente ao termo do período em curso.',
    tags: ['SERVICOS', 'PRAZO', 'RENOVACAO'],
  },
  {
    categoria: 'PRAZO',
    titulo: 'Prazo certo sem renovação',
    conteudo:
      'O presente contrato vigora desde [A COMPLETAR — data] até [A COMPLETAR — data], cessando automaticamente no termo aqui fixado, independentemente de aviso prévio, e sem direito a qualquer renovação ou prorrogação tácita.',
    tags: ['PRAZO'],
  },

  // ─── Obrigações ─────────────────────────────────────
  {
    categoria: 'OBRIGACOES',
    titulo: 'Obrigações do Prestador',
    conteudo:
      'O Prestador obriga-se a: (i) executar os serviços com zelo, diligência e nos níveis de qualidade exigíveis a um profissional do sector; (ii) cumprir prazos e entregáveis acordados; (iii) afectar pessoal qualificado e em número adequado; (iv) cumprir a legislação angolana aplicável, incluindo a regulamentação sectorial; (v) reportar mensalmente à Cliente o estado de execução; (vi) manter sigilo sobre toda a informação a que aceda no âmbito do contrato.',
    tags: ['SERVICOS', 'CONSULTORIA', 'OBRIGACOES'],
  },
  {
    categoria: 'OBRIGACOES',
    titulo: 'Obrigações da Cliente',
    conteudo:
      'A Cliente obriga-se a: (i) facultar atempadamente ao Prestador a informação e os meios necessários à execução dos serviços; (ii) liquidar pontualmente os valores devidos nos termos do presente contrato; (iii) designar um interlocutor único com poderes para tomada de decisões correntes; (iv) comunicar com a antecedência razoável quaisquer alterações de âmbito que possam afectar a execução.',
    tags: ['SERVICOS', 'CONSULTORIA', 'OBRIGACOES'],
  },

  // ─── Confidencialidade ─────────────────────────────
  {
    categoria: 'CONFIDENCIALIDADE',
    titulo: 'Confidencialidade',
    conteudo:
      'As Partes obrigam-se reciprocamente a manter sob estrita confidencialidade toda a informação técnica, comercial, financeira ou pessoal de que tomem conhecimento por força do presente contrato, abstendo-se de a divulgar, reproduzir ou utilizar para fins distintos dos contratuais, durante a vigência do contrato e pelo período de 5 (cinco) anos após a sua cessação, salvo: (i) obrigação legal de divulgação; (ii) ordem de autoridade judicial ou administrativa competente; ou (iii) informação que seja ou se torne pública por causa não imputável à Parte receptora.',
    tags: ['CONFIDENCIALIDADE', 'NDA'],
    leiAplicavelArt: 'Lei n.º 22/11, art. 6.º (princípio da finalidade)',
  },

  // ─── Protecção de dados ─────────────────────────────
  {
    categoria: 'DADOS_PESSOAIS',
    titulo: 'Protecção de dados pessoais (Lei 22/11)',
    conteudo:
      'O tratamento de dados pessoais realizado por qualquer das Partes no âmbito do presente contrato respeitará a Lei n.º 22/11, de 17 de Junho. Cada Parte é responsável pelo tratamento dos dados pessoais que recolha, garantindo o cumprimento dos princípios da legalidade, finalidade, adequação, transparência e segurança. As Partes notificar-se-ão mutuamente, no prazo de 72 (setenta e duas) horas, da ocorrência de qualquer incidente de segurança que possa afectar os dados objecto de tratamento conjunto.',
    tags: ['DADOS_PESSOAIS', 'COMPLIANCE'],
    leiAplicavelArt: 'Lei n.º 22/11',
  },

  // ─── Limitação de responsabilidade ────────────────
  {
    categoria: 'LIMITACAO_RESPONSABILIDADE',
    titulo: 'Limitação de responsabilidade',
    conteudo:
      'Sem prejuízo do regime imperativo aplicável, a responsabilidade total agregada de cada Parte pelos danos directos emergentes do presente contrato fica limitada a 12 (doze) meses dos valores efectivamente pagos ao abrigo do mesmo. As Partes não responderão por lucros cessantes, perda de oportunidade, danos indirectos ou consequenciais, salvo nos casos de dolo, negligência grosseira, violação de confidencialidade ou de direitos de propriedade intelectual de terceiros.',
    tags: ['LIMITACAO_RESPONSABILIDADE'],
  },

  // ─── Propriedade Intelectual ───────────────────────
  {
    categoria: 'PROPRIEDADE_INTELECTUAL',
    titulo: 'Propriedade intelectual sobre entregáveis',
    conteudo:
      'Todos os direitos de propriedade intelectual sobre os entregáveis especificamente desenvolvidos pelo Prestador para a Cliente no âmbito do presente contrato pertencem à Cliente a partir do momento da sua aceitação formal e do pagamento integral dos valores correspondentes. O Prestador retém a propriedade dos elementos de fundo, ferramentas, metodologias e know-how preexistentes ou de carácter genérico, concedendo à Cliente uma licença não-exclusiva, irrevogável e isenta de royalties para a utilização dos mesmos enquanto incorporados nos entregáveis.',
    tags: ['PROPRIEDADE_INTELECTUAL', 'IP', 'CONSULTORIA'],
  },

  // ─── Resolução ──────────────────────────────────────
  {
    categoria: 'RESOLUCAO',
    titulo: 'Resolução por incumprimento',
    conteudo:
      'Qualquer das Partes pode resolver o presente contrato, por carta registada com aviso de recepção, em caso de incumprimento culposo da contraparte que se mantenha por mais de 30 (trinta) dias contados da interpelação escrita para o respectivo cumprimento. A resolução opera no prazo de 15 (quinze) dias a contar da recepção da declaração resolutiva, sem prejuízo das obrigações vencidas e da indemnização por danos a que houver lugar.',
    tags: ['RESOLUCAO'],
  },
  {
    categoria: 'RESOLUCAO',
    titulo: 'Resolução por alteração das circunstâncias',
    conteudo:
      'Se durante a vigência do presente contrato ocorrer alteração anormal e imprevisível das circunstâncias em que as Partes fundaram a sua decisão de contratar, qualquer delas pode requerer a modificação do contrato segundo juízos de equidade ou, não sendo possível obter acordo, a sua resolução, nos termos da legislação aplicável.',
    tags: ['RESOLUCAO', 'ALTERACAO_CIRCUNSTANCIAS'],
  },

  // ─── Força Maior ────────────────────────────────────
  {
    categoria: 'FORCA_MAIOR',
    titulo: 'Força maior',
    conteudo:
      'Nenhuma das Partes responderá pelo incumprimento ou cumprimento defeituoso das suas obrigações quando este resulte de causa de força maior, entendida como facto imprevisível e inevitável, alheio à vontade da Parte afectada, designadamente catástrofes naturais, actos de autoridade pública, conflitos armados, pandemias declaradas ou interrupções prolongadas de comunicações ou energia. A Parte afectada notificará a contraparte no prazo de 5 (cinco) dias úteis após a verificação do evento, indicando a sua duração estimada e as medidas de mitigação adoptadas.',
    tags: ['FORCA_MAIOR'],
  },

  // ─── Lei aplicável e foro ───────────────────────────
  {
    categoria: 'LEI_APLICAVEL',
    titulo: 'Lei aplicável',
    conteudo:
      'O presente contrato rege-se pela lei angolana, em particular pelas disposições do Código Civil, do Código Comercial e demais legislação aplicável à matéria contratual em causa.',
    tags: ['LEI_APLICAVEL'],
  },
  {
    categoria: 'FORO',
    titulo: 'Foro convencional — Tribunal de Luanda',
    conteudo:
      'Para a resolução de qualquer litígio emergente da interpretação ou execução do presente contrato, as Partes elegem, com expressa renúncia a qualquer outro, o foro da Comarca de Luanda.',
    tags: ['FORO'],
  },
  {
    categoria: 'FORO',
    titulo: 'Cláusula arbitral — CACAL',
    conteudo:
      'Os litígios emergentes do presente contrato ou com ele relacionados serão definitivamente resolvidos por arbitragem, nos termos do Regulamento do Centro de Arbitragem da Câmara de Comércio Angolana (CACAL), por tribunal arbitral composto por 3 (três) árbitros, sendo a língua da arbitragem o português e o local Luanda. A decisão arbitral é definitiva e vinculativa, dispensando recurso para os tribunais judiciais nos termos legalmente permitidos.',
    tags: ['FORO', 'ARBITRAGEM', 'CACAL'],
  },

  // ─── Comunicações ──────────────────────────────────
  {
    categoria: 'COMUNICACOES',
    titulo: 'Comunicações entre as Partes',
    conteudo:
      'Todas as comunicações entre as Partes serão efectuadas por escrito, para as moradas, números de telefone ou endereços electrónicos indicados no preâmbulo, ou outros que venham a ser comunicados nos termos da presente cláusula. Considera-se que as comunicações foram recebidas: (i) imediatamente, no caso de entrega em mão; (ii) na data do aviso de recepção, no caso de carta registada; (iii) no primeiro dia útil seguinte ao do envio, no caso de correio electrónico.',
    tags: ['COMUNICACOES'],
  },

  // ─── Cessão e subcontratação ───────────────────────
  {
    categoria: 'CESSAO',
    titulo: 'Proibição de cessão da posição contratual',
    conteudo:
      'Nenhuma das Partes pode ceder a sua posição contratual, no todo ou em parte, sem o consentimento prévio e por escrito da contraparte, excepto em caso de operação societária que envolva a totalidade do património de uma das Partes, hipótese em que a cessão é admissível mediante mera notificação à outra Parte.',
    tags: ['CESSAO'],
  },

  // ─── Disposições finais ────────────────────────────
  {
    categoria: 'ALTERACOES',
    titulo: 'Alterações ao contrato',
    conteudo:
      'Qualquer alteração ao presente contrato deve constar de adenda escrita, assinada por ambas as Partes, sob pena de nulidade. A tolerância de qualquer das Partes quanto ao incumprimento das obrigações da contraparte não é constitutiva de novação nem dispensa o cumprimento futuro.',
    tags: ['ALTERACOES'],
  },
  {
    categoria: 'INVALIDADE',
    titulo: 'Invalidade parcial',
    conteudo:
      'A nulidade ou ineficácia de qualquer cláusula do presente contrato não afecta a validade das restantes, que se manterão em vigor. As Partes obrigam-se a substituir a cláusula inválida por outra que, na medida do legalmente possível, produza o efeito económico-jurídico pretendido.',
    tags: ['INVALIDADE'],
  },
  {
    categoria: 'INTEGRALIDADE',
    titulo: 'Integralidade do acordo',
    conteudo:
      'O presente contrato e os seus anexos constituem o acordo integral entre as Partes sobre as matérias nele tratadas, prevalecendo sobre quaisquer acordos, declarações ou compromissos anteriores, verbais ou escritos.',
    tags: ['INTEGRALIDADE'],
  },
];
