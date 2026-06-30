/**
 * Templates base pt-AO para o tenant demo — destravam o caminho ③
 * "A partir de template" do fluxo Novo contrato sem o admin ter de
 * criar tudo manualmente.
 *
 * Cada template usa os placeholders mustache-like do renderer
 * (apps/api/src/common/placeholders.ts):
 *   {{titulo}}, {{descricao}}, {{partes.principal.nome}},
 *   {{partes.contraparte.nome}}, {{partes.contraparte.nif}},
 *   {{partes.contraparte.representante.nome}}, {{valor | money}},
 *   {{dataInicioVigencia | dateLong}}, {{dataTermo | dateLong}},
 *   {{leiAplicavel | default:"direito angolano"}}, {{foro}}, etc.
 *
 * Os tipos cobertos correspondem aos códigos do catálogo seed
 * tipos-contrato.ts. Templates não cobertos (raros como CESSAO_IP,
 * GARANTIA) ficam sem template — caminho ② IA serve para esses.
 *
 * IMPORTANT: NÃO citar artigos específicos a não ser que sejamos
 * confiantes no conteúdo. Disclaimer geral fica no final.
 */

export interface TemplateSeed {
  /** Código do TipoContrato a que se liga */
  tipoCodigo: string;
  nome: string;
  descricao: string;
  conteudo: string;
}

export const TEMPLATES_BASE_SEED: TemplateSeed[] = [
  // ─── NDA ────────────────────────────────────────────
  {
    tipoCodigo: 'NDA',
    nome: 'NDA padrão pt-AO (bilateral, 5 anos)',
    descricao: 'Acordo de confidencialidade bilateral entre duas pessoas colectivas. 5 anos de vigência pós-cessação.',
    conteudo: `# ACORDO DE CONFIDENCIALIDADE

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designada por "Parte Reveladora",
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representada por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designada por "Parte Receptora",

doravante conjuntamente designadas por "Partes" e individualmente por "Parte".

## Considerandos

Considerando que as Partes pretendem trocar informações de natureza técnica, comercial ou financeira no âmbito de potencial colaboração;
Considerando que a confidencialidade dessas informações é essencial para a salvaguarda dos interesses legítimos das Partes;

acordam as Partes celebrar o presente Acordo de Confidencialidade, que se rege pelas cláusulas seguintes.

## Cláusula 1.ª — Objecto

O presente Acordo tem por objecto regular as condições em que as Partes trocarão e tratarão informação confidencial no contexto de [A COMPLETAR — finalidade da troca de informação].

## Cláusula 2.ª — Definição de Informação Confidencial

Considera-se Informação Confidencial toda a informação técnica, comercial, financeira, jurídica ou de qualquer outra natureza, fornecida por uma Parte à outra, em qualquer suporte ou formato, salvo se:

1. Já era do domínio público à data da divulgação;
2. Se tornou pública por causa não imputável à Parte receptora;
3. Já era do conhecimento da Parte receptora antes da divulgação, comprovadamente;
4. Foi obtida licitamente de terceiro sem dever de confidencialidade.

## Cláusula 3.ª — Obrigações

A Parte Receptora obriga-se a:

1. Manter sob estrita confidencialidade toda a Informação Confidencial;
2. Não a divulgar, reproduzir ou utilizar para fins distintos dos contratuais;
3. Restringir o acesso a colaboradores que dela necessitem para a finalidade do Acordo;
4. Adoptar medidas de segurança adequadas à protecção da Informação;
5. Notificar imediatamente a Parte Reveladora de qualquer violação ou suspeita de violação.

## Cláusula 4.ª — Vigência

O presente Acordo vigora desde {{dataInicioVigencia | dateLong}} pelo período de 2 (dois) anos, e as obrigações de confidencialidade subsistem por 5 (cinco) anos após a cessação do Acordo.

## Cláusula 5.ª — Devolução de Informação

Na cessação do Acordo, a Parte Receptora obriga-se a devolver ou destruir toda a Informação Confidencial em sua posse, mediante declaração escrita de cumprimento.

## Cláusula 6.ª — Protecção de Dados Pessoais

O tratamento de dados pessoais ao abrigo do presente Acordo respeita a Lei n.º 22/11, de 17 de Junho. As Partes notificar-se-ão mutuamente, no prazo de 72 horas, da ocorrência de qualquer incidente de segurança.

## Cláusula 7.ª — Resolução

Qualquer das Partes pode resolver o Acordo em caso de incumprimento culposo da contraparte que se mantenha por mais de 15 dias contados da interpelação escrita.

## Cláusula 8.ª — Lei Aplicável e Foro

O presente Acordo rege-se pelo {{leiAplicavel | default:"direito angolano"}}. Para a resolução de qualquer litígio, as Partes elegem o foro {{foro | default:"da Comarca de Luanda"}}, com expressa renúncia a qualquer outro.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente Acordo em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê o conteúdo e adapta à situação concreta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Prestação de Serviços ──────────────────────────
  {
    tipoCodigo: 'PRESTACAO_SERVICOS',
    nome: 'Prestação de serviços (avença mensal pt-AO)',
    descricao: 'Contrato de prestação de serviços profissionais com pagamento mensal. Renovação automática.',
    conteudo: `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante "Cliente";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, doravante "Prestador".

## Cláusula 1.ª — Objecto

O presente contrato tem por objecto a prestação, pelo Prestador à Cliente, dos serviços identificados como **{{descricao}}**, executados nas condições previstas no presente clausulado e no Anexo I, quando aplicável.

## Cláusula 2.ª — Prazo e Vigência

O presente contrato entra em vigor em {{dataInicioVigencia | dateLong}} e produz efeitos até {{dataTermo | dateLong}}, considerando-se automaticamente renovado por iguais e sucessivos períodos, salvo denúncia de qualquer das Partes comunicada com antecedência mínima de 60 (sessenta) dias relativamente ao termo do período em curso.

## Cláusula 3.ª — Preço e Modo de Pagamento

Como contrapartida pela prestação dos serviços, a Cliente pagará ao Prestador o valor mensal de {{valor | money}}, a liquidar até ao dia 10 (dez) do mês subsequente ao da prestação, mediante factura legal emitida nos termos do Código Geral Tributário e regulamentação AGT.

O pagamento será efectuado por transferência bancária para a conta indicada pelo Prestador, sendo da responsabilidade da Cliente os encargos da operação cambial, quando aplicáveis.

## Cláusula 4.ª — Obrigações do Prestador

O Prestador obriga-se a:

1. Executar os serviços com zelo, diligência e nos níveis de qualidade exigíveis a um profissional do sector;
2. Cumprir prazos e entregáveis acordados;
3. Afectar pessoal qualificado e em número adequado;
4. Cumprir a legislação angolana aplicável;
5. Reportar mensalmente à Cliente o estado de execução;
6. Manter sigilo sobre toda a informação a que aceda no âmbito do contrato.

## Cláusula 5.ª — Obrigações da Cliente

A Cliente obriga-se a:

1. Facultar atempadamente ao Prestador a informação e os meios necessários à execução dos serviços;
2. Liquidar pontualmente os valores devidos nos termos do presente contrato;
3. Designar um interlocutor único com poderes para tomada de decisões correntes;
4. Comunicar com a antecedência razoável quaisquer alterações de âmbito.

## Cláusula 6.ª — Confidencialidade

As Partes obrigam-se reciprocamente a manter sob estrita confidencialidade toda a informação técnica, comercial, financeira ou pessoal de que tomem conhecimento por força do presente contrato, durante a sua vigência e pelo período de 5 (cinco) anos após a cessação.

## Cláusula 7.ª — Limitação de Responsabilidade

Sem prejuízo do regime imperativo aplicável, a responsabilidade total agregada de cada Parte pelos danos directos emergentes do presente contrato fica limitada a 12 (doze) meses dos valores efectivamente pagos. As Partes não responderão por lucros cessantes ou danos indirectos, salvo nos casos de dolo, negligência grosseira ou violação de confidencialidade.

## Cláusula 8.ª — Resolução

Qualquer das Partes pode resolver o presente contrato, por carta registada com aviso de recepção, em caso de incumprimento culposo da contraparte que se mantenha por mais de 30 (trinta) dias contados da interpelação escrita.

## Cláusula 9.ª — Cessão da Posição Contratual

Nenhuma das Partes pode ceder a sua posição contratual sem o consentimento prévio e por escrito da contraparte, excepto em caso de operação societária que envolva a totalidade do património.

## Cláusula 10.ª — Comunicações

Todas as comunicações entre as Partes serão efectuadas por escrito, para as moradas, números de telefone ou endereços electrónicos indicados no preâmbulo.

## Cláusula 11.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}. Para a resolução de qualquer litígio, as Partes elegem o foro {{foro | default:"da Comarca de Luanda"}}, com renúncia expressa a qualquer outro.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente contrato.

> ⚠ Template gerado pelo Kamaia CLM. Revê o conteúdo e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Compra e Venda Móveis ─────────────────────────
  {
    tipoCodigo: 'COMPRAVENDA_MOVEIS',
    nome: 'Compra e Venda de Bens Móveis (pt-AO)',
    descricao: 'Compra e venda de bens móveis com transferência de propriedade no pagamento integral.',
    conteudo: `# CONTRATO DE COMPRA E VENDA DE BENS MÓVEIS

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, NIF {{partes.principal.nif}}, doravante "Vendedor";
- **{{partes.contraparte.nome}}**, NIF {{partes.contraparte.nif}}, doravante "Compradora".

## Cláusula 1.ª — Objecto

Pelo presente contrato, o Vendedor vende e a Compradora compra os bens identificados como **{{descricao}}**, livres de quaisquer ónus, encargos ou direitos de terceiros.

## Cláusula 2.ª — Preço

O preço global da compra e venda é de {{valor | money}}, que a Compradora pagará ao Vendedor nas seguintes condições: [A COMPLETAR — sinal, prestações, prazo].

Os valores indicam-se já com Imposto sobre o Valor Acrescentado (IVA) incluído, quando aplicável.

## Cláusula 3.ª — Entrega

Os bens serão entregues à Compradora em {{dataInicioVigencia | dateLong}}, no local de [A COMPLETAR — local de entrega], correndo o transporte e seguro [A COMPLETAR — por conta do Vendedor ou da Compradora].

## Cláusula 4.ª — Transferência de Propriedade e Risco

A propriedade dos bens transfere-se para a Compradora no momento do pagamento integral do preço. O risco transfere-se no momento da entrega efectiva.

## Cláusula 5.ª — Garantia

O Vendedor garante que os bens estão em conformidade com as especificações acordadas e isentos de defeitos por um período de [A COMPLETAR — meses] a contar da entrega. Eventuais reclamações devem ser comunicadas por escrito no prazo de 15 dias após a detecção do defeito.

## Cláusula 6.ª — Resolução

Qualquer das Partes pode resolver o contrato em caso de incumprimento culposo da contraparte que se mantenha por mais de 15 dias contados da interpelação escrita, sem prejuízo da indemnização por danos.

## Cláusula 7.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}. Para a resolução de qualquer litígio, as Partes elegem o foro {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente contrato.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Arrendamento Comercial ────────────────────────
  {
    tipoCodigo: 'ARRENDAMENTO',
    nome: 'Arrendamento comercial pt-AO',
    descricao: 'Arrendamento de imóvel para fim comercial, com renda mensal indexada ao IPC.',
    conteudo: `# CONTRATO DE ARRENDAMENTO COMERCIAL

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, NIF {{partes.principal.nif}}, doravante "Senhorio";
- **{{partes.contraparte.nome}}**, NIF {{partes.contraparte.nif}}, doravante "Inquilina".

## Cláusula 1.ª — Objecto

O Senhorio dá de arrendamento à Inquilina, que aceita, o imóvel sito em [A COMPLETAR — morada completa do imóvel], destinado exclusivamente ao fim comercial de {{descricao}}.

## Cláusula 2.ª — Prazo e Vigência

O presente contrato vigora pelo período inicial de 5 (cinco) anos, com início em {{dataInicioVigencia | dateLong}} e termo em {{dataTermo | dateLong}}, considerando-se automaticamente renovado por iguais períodos, salvo denúncia comunicada com antecedência mínima de 90 dias.

## Cláusula 3.ª — Renda

A renda mensal inicial é de {{valor | money}}, a pagar até ao dia 8 (oito) de cada mês a que respeita, na conta indicada pelo Senhorio.

A renda será actualizada anualmente em função da variação do índice de preços no consumidor (IPC) publicado pelo INE de Angola, salvo acordo em contrário.

## Cláusula 4.ª — Caução

A Inquilina entrega ao Senhorio, neste acto, a quantia de [A COMPLETAR — 2 a 3 meses de renda] a título de caução, que garantirá o cumprimento das obrigações decorrentes do presente contrato.

## Cláusula 5.ª — Obrigações da Inquilina

A Inquilina obriga-se a:

1. Pagar pontualmente a renda;
2. Utilizar o imóvel exclusivamente para o fim contratado;
3. Conservar o imóvel em bom estado, suportando as reparações de pequena monta;
4. Não realizar obras de modificação sem consentimento escrito do Senhorio;
5. Restituir o imóvel no termo do contrato no estado em que o recebeu, salvo desgaste normal.

## Cláusula 6.ª — Obrigações do Senhorio

O Senhorio obriga-se a:

1. Entregar o imóvel à Inquilina em condições de servir o fim contratado;
2. Realizar as reparações estruturais e de grande monta que se mostrem necessárias;
3. Não perturbar a fruição pacífica do imóvel.

## Cláusula 7.ª — Imposto e Outros Encargos

O Imposto sobre Arrendamento Predial Urbano (IPU) é da responsabilidade do Senhorio. As despesas correntes (água, electricidade, condomínio) ficam a cargo da Inquilina.

## Cláusula 8.ª — Resolução

Constitui causa de resolução o atraso no pagamento da renda por período superior a 60 dias ou outro incumprimento culposo grave.

## Cláusula 9.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}, designadamente pela Lei do Arrendamento Urbano. Para a resolução de qualquer litígio, as Partes elegem o foro {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente contrato.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Trabalho ──────────────────────────────────────
  {
    tipoCodigo: 'TRABALHO',
    nome: 'Contrato de trabalho por tempo indeterminado (pt-AO)',
    descricao: 'Contrato de trabalho ao abrigo da Lei Geral do Trabalho de Angola.',
    conteudo: `# CONTRATO DE TRABALHO POR TEMPO INDETERMINADO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, NIF {{partes.principal.nif}}, doravante "Empregador";
- **{{partes.contraparte.nome}}**, BI/Passaporte {{partes.contraparte.representante.bi}}, doravante "Trabalhador".

## Cláusula 1.ª — Objecto e Categoria Profissional

O Trabalhador é admitido para exercer as funções de **{{descricao}}**, com a categoria profissional de [A COMPLETAR — categoria], devendo desempenhar todas as tarefas inerentes à mesma e outras que lhe sejam atribuídas dentro do âmbito da actividade do Empregador.

## Cláusula 2.ª — Local de Trabalho

O local de trabalho é em [A COMPLETAR — morada do estabelecimento], sem prejuízo das deslocações que o exercício das funções implique.

## Cláusula 3.ª — Duração

O presente contrato é celebrado por tempo indeterminado, com início em {{dataInicioVigencia | dateLong}}.

O contrato tem um período experimental de [A COMPLETAR — 60 dias para a generalidade dos trabalhadores; pode ir até 6 meses para cargos de complexidade técnica].

## Cláusula 4.ª — Horário de Trabalho

O período normal de trabalho é de 8 (oito) horas diárias e 44 (quarenta e quatro) horas semanais, distribuídas de segunda-feira a sexta-feira, com 1 (uma) hora de intervalo para refeição.

O Empregador pode alterar o horário de trabalho nos termos da Lei Geral do Trabalho.

## Cláusula 5.ª — Remuneração

O Trabalhador receberá uma remuneração mensal bruta de {{valor | money}}, paga até ao último dia útil de cada mês.

Sobre a remuneração incidem os descontos legais aplicáveis, designadamente para a Segurança Social e o Imposto sobre os Rendimentos do Trabalho (IRT).

## Cláusula 6.ª — Subsídios

Para além da remuneração base, o Trabalhador tem direito a:

1. **Subsídio de Natal**, equivalente a 50% da remuneração base, pago até 20 de Dezembro;
2. **Subsídio de Férias**, equivalente a 50% da remuneração base, pago no início do gozo de férias;
3. **Outros subsídios**: [A COMPLETAR — transporte, alimentação, telefone, etc., se aplicável].

## Cláusula 7.ª — Férias

O Trabalhador tem direito a 22 (vinte e dois) dias úteis de férias anuais, a gozar nos termos da Lei Geral do Trabalho e do regulamento interno do Empregador.

## Cláusula 8.ª — Cessação

A cessação do presente contrato rege-se pelas disposições da Lei Geral do Trabalho, designadamente em matéria de aviso prévio, indemnização por antiguidade e despedimento.

## Cláusula 9.ª — Confidencialidade e Não-Concorrência

O Trabalhador obriga-se a manter sob estrita confidencialidade toda a informação a que aceda no exercício das funções, durante a vigência do contrato e pelo período de 2 (dois) anos após a cessação.

## Cláusula 10.ª — Disposições Finais

Em tudo o omisso no presente contrato, aplica-se a Lei Geral do Trabalho de Angola e demais legislação aplicável.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente contrato em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Mútuo (empréstimo) ─────────────────────────────
  {
    tipoCodigo: 'MUTUO',
    nome: 'Contrato de mútuo (empréstimo) pt-AO',
    descricao: 'Empréstimo de quantia em dinheiro entre duas partes, com prazo e juros. Regula-se pelo Código Civil; operações com não-residentes observam a Lei Cambial.',
    conteudo: `# CONTRATO DE MÚTUO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designado por "Mutuante";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representado por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designado por "Mutuário".

## Cláusula 1.ª — Objecto

Pelo presente contrato, o Mutuante entrega ao Mutuário, a título de empréstimo, a quantia de {{valor | money}}, que este declara receber e de que se confessa devedor.

## Cláusula 2.ª — Prazo de Restituição

O Mutuário obriga-se a restituir a quantia mutuada até {{dataTermo | dateLong}}, [A COMPLETAR — de uma só vez ou em prestações; indicar plano].

## Cláusula 3.ª — Juros

Sobre o capital mutuado vencem-se juros à taxa de [A COMPLETAR — taxa anual] %, contados desde a entrega até efectivo e integral pagamento. As Partes declaram que a taxa convencionada respeita os limites legais aplicáveis.

## Cláusula 4.ª — Mora

Em caso de atraso no pagamento, acrescem juros de mora à taxa legal em vigor, sem prejuízo do vencimento antecipado de todas as prestações nos termos da cláusula seguinte.

## Cláusula 5.ª — Vencimento Antecipado

O incumprimento de qualquer prestação por prazo superior a [A COMPLETAR — dias] confere ao Mutuante o direito de exigir a totalidade do montante em dívida, vencendo-se imediatamente todas as obrigações.

## Cláusula 6.ª — Garantias

[A COMPLETAR — descrever garantias, se existirem: livrança, fiança, penhor, hipoteca.]

## Cláusula 7.ª — Regime Cambial

Tratando-se de operação com não-residente cambial ou em moeda estrangeira, as Partes obrigam-se a observar a Lei Cambial e os Avisos do Banco Nacional de Angola aplicáveis.

## Cláusula 8.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}, designadamente pelo Código Civil. Para a resolução de litígios, as Partes elegem o foro {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam o presente contrato em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Mandato ────────────────────────────────────────
  {
    tipoCodigo: 'MANDATO',
    nome: 'Contrato de mandato pt-AO',
    descricao: 'Mandato pelo qual o mandatário se obriga a praticar actos jurídicos por conta do mandante. Regula-se pelo Código Civil.',
    conteudo: `# CONTRATO DE MANDATO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designado por "Mandante";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representado por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designado por "Mandatário".

## Cláusula 1.ª — Objecto

O Mandante incumbe o Mandatário, que aceita, de praticar por sua conta os seguintes actos: [A COMPLETAR — descrição dos actos jurídicos a praticar].

## Cláusula 2.ª — Poderes

O presente mandato é conferido [A COMPLETAR — com / sem] poderes de representação. [Quando com representação, os poderes constam de procuração autónoma a outorgar.]

## Cláusula 3.ª — Obrigações do Mandatário

O Mandatário obriga-se a: (i) praticar os actos com a diligência devida e segundo as instruções do Mandante; (ii) prestar contas; (iii) entregar ao Mandante o que recebeu em execução do mandato.

## Cláusula 4.ª — Retribuição

O mandato é [A COMPLETAR — gratuito / oneroso]. Sendo oneroso, o Mandante pagará ao Mandatário {{valor | money}}, nos termos a acordar, acrescido das despesas necessárias devidamente documentadas.

## Cláusula 5.ª — Vigência e Revogação

O mandato vigora desde {{dataInicioVigencia | dateLong}} e cessa por revogação, renúncia, conclusão do encargo ou nos demais casos previstos na lei. A revogação e a renúncia observam o regime do Código Civil.

## Cláusula 6.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}, designadamente pelo Código Civil. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Empreitada ─────────────────────────────────────
  {
    tipoCodigo: 'EMPREITADA',
    nome: 'Contrato de empreitada pt-AO',
    descricao: 'Realização de uma obra mediante preço. Regula-se pelo Código Civil (contrato de empreitada).',
    conteudo: `# CONTRATO DE EMPREITADA

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designado por "Dono da Obra";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representado por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designado por "Empreiteiro".

## Cláusula 1.ª — Objecto

O Empreiteiro obriga-se a executar, por conta e risco próprios, a seguinte obra: [A COMPLETAR — descrição da obra, local e especificações técnicas], de acordo com o projecto e o caderno de encargos que se anexam.

## Cláusula 2.ª — Preço e Pagamento

Pela execução da obra, o Dono da Obra pagará o preço de {{valor | money}}, [A COMPLETAR — preço global ou por medição], segundo o seguinte plano de pagamentos: [A COMPLETAR — autos de medição / marcos].

## Cláusula 3.ª — Prazos

A obra inicia-se em {{dataInicioVigencia | dateLong}} e deve estar concluída até {{dataTermo | dateLong}}. O atraso imputável ao Empreiteiro sujeita-o às penalidades previstas na cláusula 6.ª.

## Cláusula 4.ª — Materiais e Execução

[A COMPLETAR — quem fornece os materiais]. O Empreiteiro executa a obra segundo as regras da arte, normas técnicas aplicáveis e legislação de construção em vigor.

## Cláusula 5.ª — Fiscalização e Recepção

O Dono da Obra pode fiscalizar a execução. Concluída a obra, procede-se à sua verificação e recepção, lavrando-se o respectivo auto. A recepção não exonera o Empreiteiro pelos defeitos, nos termos da lei.

## Cláusula 6.ª — Defeitos e Garantia

O Empreiteiro responde pelos defeitos da obra nos termos do Código Civil, obrigando-se à sua eliminação no prazo de [A COMPLETAR — dias]. Período de garantia: [A COMPLETAR].

## Cláusula 7.ª — Penalidades

O atraso na conclusão sujeita o Empreiteiro a uma penalidade de [A COMPLETAR — valor/dia], sem prejuízo da indemnização por danos.

## Cláusula 8.ª — Lei Aplicável e Foro

O presente contrato rege-se pelo {{leiAplicavel | default:"direito angolano"}}, designadamente pelo Código Civil. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Consultoria ────────────────────────────────────
  {
    tipoCodigo: 'CONSULTORIA',
    nome: 'Contrato de consultoria pt-AO',
    descricao: 'Prestação de serviços de consultoria especializada, com entregáveis e confidencialidade.',
    conteudo: `# CONTRATO DE CONSULTORIA

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designada por "Cliente";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representada por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designada por "Consultor".

## Cláusula 1.ª — Objecto

O Consultor obriga-se a prestar à Cliente serviços de consultoria em [A COMPLETAR — área], compreendendo [A COMPLETAR — âmbito e entregáveis].

## Cláusula 2.ª — Entregáveis e Prazos

Os entregáveis e respectivos prazos constam do anexo I. [A COMPLETAR — marcos.]

## Cláusula 3.ª — Honorários e Pagamento

Pela prestação dos serviços, a Cliente pagará {{valor | money}}, [A COMPLETAR — por avença / por projecto / por hora], mediante factura legal, a liquidar no prazo de [A COMPLETAR — dias]. Aos serviços de não-residentes aplica-se a retenção na fonte de IRT nos termos da lei fiscal angolana, quando devida.

## Cláusula 4.ª — Independência

O Consultor presta os serviços com autonomia técnica, não existindo vínculo laboral de subordinação entre as Partes.

## Cláusula 5.ª — Confidencialidade e Propriedade Intelectual

O Consultor mantém confidencialidade sobre a informação a que aceda. [A COMPLETAR — titularidade dos resultados/entregáveis.] O tratamento de dados pessoais respeita a Lei n.º 22/11, de 17 de Junho.

## Cláusula 6.ª — Vigência

O contrato vigora de {{dataInicioVigencia | dateLong}} a {{dataTermo | dateLong}}, [A COMPLETAR — renovação].

## Cláusula 7.ª — Lei Aplicável e Foro

Rege-se pelo {{leiAplicavel | default:"direito angolano"}}. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Fornecimento ───────────────────────────────────
  {
    tipoCodigo: 'FORNECIMENTO',
    nome: 'Contrato de fornecimento de bens pt-AO',
    descricao: 'Fornecimento continuado/periódico de bens, com preço, prazos de entrega e condições.',
    conteudo: `# CONTRATO DE FORNECIMENTO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designada por "Fornecedor";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, representada por {{partes.contraparte.representante.nome}}, na qualidade de {{partes.contraparte.representante.cargo}}, doravante designada por "Adquirente".

## Cláusula 1.ª — Objecto

O Fornecedor obriga-se a fornecer à Adquirente, de forma [A COMPLETAR — continuada/periódica], os seguintes bens: [A COMPLETAR — descrição, especificações e quantidades].

## Cláusula 2.ª — Encomendas e Entregas

As encomendas são efectuadas por [A COMPLETAR — meio]. O Fornecedor entrega no prazo de [A COMPLETAR] em [A COMPLETAR — local], correndo por sua conta os riscos até à entrega, salvo estipulação Incoterms diversa.

## Cláusula 3.ª — Preço e Pagamento

O preço unitário consta da tabela anexa; o valor estimado do contrato é de {{valor | money}}. O pagamento efectua-se no prazo de [A COMPLETAR — dias] após factura legal.

## Cláusula 4.ª — Qualidade e Conformidade

Os bens devem cumprir as especificações acordadas e a legislação aplicável. A Adquirente pode rejeitar bens não conformes, devendo o Fornecedor substituí-los.

## Cláusula 5.ª — Garantia

[A COMPLETAR — período e termos de garantia.]

## Cláusula 6.ª — Vigência

O contrato vigora de {{dataInicioVigencia | dateLong}} a {{dataTermo | dateLong}}, [A COMPLETAR — renovação e denúncia].

## Cláusula 7.ª — Lei Aplicável e Foro

Rege-se pelo {{leiAplicavel | default:"direito angolano"}}. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Arrendamento Habitacional ──────────────────────
  {
    tipoCodigo: 'ARRENDAMENTO_HABITACIONAL',
    nome: 'Arrendamento urbano para habitação (Lei 26/15)',
    descricao: 'Arrendamento de imóvel urbano destinado a habitação, ao abrigo da Lei n.º 26/15, de 23 de Outubro (Lei do Arrendamento Urbano).',
    conteudo: `# CONTRATO DE ARRENDAMENTO URBANO PARA HABITAÇÃO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designado por "Senhorio";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, doravante designado por "Arrendatário".

## Cláusula 1.ª — Objecto e Fim

O Senhorio dá de arrendamento ao Arrendatário, que aceita, o imóvel sito em [A COMPLETAR — endereço completo e identificação predial], destinado exclusivamente a habitação do Arrendatário e do seu agregado.

## Cláusula 2.ª — Renda

A renda mensal é de {{valor | money}}, paga até ao dia [A COMPLETAR — dia] de cada mês, por [A COMPLETAR — transferência/depósito] na conta indicada pelo Senhorio. A actualização da renda observa a Lei n.º 26/15, de 23 de Outubro.

## Cláusula 3.ª — Caução

O Arrendatário entrega, a título de caução, o montante de [A COMPLETAR — nº de rendas], a restituir no termo do contrato, deduzidas as quantias em dívida ou danos.

## Cláusula 4.ª — Prazo e Renovação

O contrato tem início em {{dataInicioVigencia | dateLong}} e o prazo de {{dataTermo | dateLong}}, renovável nos termos da Lei n.º 26/15. A denúncia e a oposição à renovação observam os prazos legais.

## Cláusula 5.ª — Obrigações do Arrendatário

O Arrendatário obriga-se a: usar o imóvel com diligência e para o fim acordado; não o subarrendar nem ceder sem autorização escrita; pagar pontualmente a renda e os encargos a seu cargo; restituir o imóvel no estado em que o recebeu, salvo desgaste normal.

## Cláusula 6.ª — Obras e Conservação

[A COMPLETAR — repartição de obras de conservação ordinária e extraordinária, nos termos da Lei n.º 26/15.]

## Cláusula 7.ª — Resolução

O incumprimento, designadamente a falta de pagamento da renda nos termos da lei, confere ao Senhorio o direito de resolução, nos termos da Lei n.º 26/15.

## Cláusula 8.ª — Imposto de Selo

O arrendamento está sujeito a Imposto de Selo, cuja liquidação cabe nos termos da lei fiscal angolana.

## Cláusula 9.ª — Lei Aplicável e Foro

Rege-se pela Lei n.º 26/15, de 23 de Outubro, e, subsidiariamente, pelo Código Civil. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Contrato-promessa de compra e venda de imóvel ──
  {
    tipoCodigo: 'CPCV_IMOVEL',
    nome: 'Contrato-promessa de compra e venda de imóvel pt-AO',
    descricao: 'Promessa bilateral de compra e venda de imóvel, com sinal. Regula-se pelo Código Civil.',
    conteudo: `# CONTRATO-PROMESSA DE COMPRA E VENDA DE IMÓVEL

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designado por "Promitente-Vendedor";
- **{{partes.contraparte.nome}}**, com NIF {{partes.contraparte.nif}}, doravante designado por "Promitente-Comprador".

## Cláusula 1.ª — Objecto

O Promitente-Vendedor promete vender, e o Promitente-Comprador promete comprar, o imóvel sito em [A COMPLETAR — endereço e identificação predial/matricial], livre de ónus ou encargos, salvo os declarados.

## Cláusula 2.ª — Preço e Sinal

O preço acordado é de {{valor | money}}. A título de sinal e princípio de pagamento, o Promitente-Comprador entrega [A COMPLETAR — montante do sinal], imputado no preço. O remanescente é pago no acto da escritura.

## Cláusula 3.ª — Escritura Definitiva

A escritura pública de compra e venda será outorgada até {{dataTermo | dateLong}}, em cartório a designar, cabendo a marcação a [A COMPLETAR]. O Promitente-Vendedor obriga-se a entregar a documentação necessária ao registo.

## Cláusula 4.ª — Incumprimento e Sinal

Em caso de incumprimento, aplica-se o regime do sinal previsto no Código Civil: o sinal é perdido a favor do Promitente-Vendedor se o incumprimento for imputável ao Comprador, ou restituído em dobro se imputável ao Vendedor, sem prejuízo do recurso à execução específica quando admissível.

## Cláusula 5.ª — Encargos Fiscais

Os impostos e encargos (designadamente Imposto de Selo e, quando aplicável, demais tributos sobre a transmissão) são suportados nos termos da lei e do acordado em [A COMPLETAR].

## Cláusula 6.ª — Lei Aplicável e Foro

Rege-se pelo {{leiAplicavel | default:"direito angolano"}}, designadamente pelo Código Civil. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },

  // ─── Trabalho — quadro executivo ────────────────────
  {
    tipoCodigo: 'TRABALHO_EXECUTIVO',
    nome: 'Contrato de trabalho — quadro executivo (LGT)',
    descricao: 'Contrato de trabalho para cargo de direcção/chefia, ao abrigo da Lei Geral do Trabalho de Angola.',
    conteudo: `# CONTRATO DE TRABALHO — QUADRO EXECUTIVO

**{{titulo}}**

## Partes

- **{{partes.principal.nome}}**, com NIF {{partes.principal.nif}}, doravante designada por "Empregador";
- **{{partes.contraparte.nome}}**, portador do BI n.º [A COMPLETAR], doravante designado por "Trabalhador".

## Cláusula 1.ª — Cargo e Funções

O Trabalhador é admitido para exercer as funções de [A COMPLETAR — cargo de direcção/chefia], com as responsabilidades inerentes e as que lhe forem cometidas pelo Empregador.

## Cláusula 2.ª — Local de Trabalho

O local de trabalho é [A COMPLETAR], sem prejuízo de deslocações inerentes ao cargo.

## Cláusula 3.ª — Retribuição

A remuneração base mensal é de {{valor | money}}, acrescida de [A COMPLETAR — subsídios e benefícios]. [A COMPLETAR — componente variável/prémios, se aplicável.]

## Cláusula 4.ª — Período Normal de Trabalho

O período normal de trabalho observa os limites da Lei Geral do Trabalho de Angola, considerando-se o regime aplicável aos quadros de direcção e chefia.

## Cláusula 5.ª — Vigência e Período Experimental

O contrato vigora desde {{dataInicioVigencia | dateLong}}, [A COMPLETAR — por tempo indeterminado / a termo], com período experimental nos termos da Lei Geral do Trabalho.

## Cláusula 6.ª — Confidencialidade e Não Concorrência

O Trabalhador obriga-se a confidencialidade durante e após o contrato. [A COMPLETAR — pacto de não concorrência, dentro dos limites legais e com a devida compensação.]

## Cláusula 7.ª — Cessação

A cessação do contrato observa as causas e procedimentos da Lei Geral do Trabalho de Angola.

## Cláusula 8.ª — Disposições Finais

Em tudo o omisso aplica-se a Lei Geral do Trabalho de Angola e demais legislação aplicável. Foro: {{foro | default:"da Comarca de Luanda"}}.

---

E por estarem assim, justas e contratadas, as Partes assinam em duas vias de igual valor.

> ⚠ Template gerado pelo Kamaia CLM. Revê e adapta. Não substitui aconselhamento jurídico.`,
  },
];
