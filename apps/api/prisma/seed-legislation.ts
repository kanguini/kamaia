/**
 * Kamaia — Seed Legislation Data
 *
 * Seeds core Angolan legislation articles into the RAG system.
 * Run: npx ts-node prisma/seed-legislation.ts
 *
 * This creates LegislationDocument + LegislationChunk records.
 * Embeddings are generated via Gemini text-embedding-004 if GEMINI_API_KEY is set.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LegislationSeed {
  title: string;
  shortName: string;
  reference: string;
  category: string;
  articles: Array<{
    title: string;
    content: string;
  }>;
}

// ═══════════════════════════════════════════════════════════
// CORPUS — Legislacao Angolana Core
// ═══════════════════════════════════════════════════════════

const LEGISLATION: LegislationSeed[] = [
  // ── Codigo de Processo Civil ──────────────────────────
  {
    title: 'Codigo de Processo Civil',
    shortName: 'CPC',
    reference: 'Decreto-Lei n.o 44 129/61 (com alteracoes)',
    category: 'PROCESSUAL',
    articles: [
      {
        title: 'Art. 486.o — Prazo de contestacao',
        content:
          'Art. 486.o (Prazo de contestacao)\n\n' +
          'O reu e citado para contestar no prazo de 20 dias uteis a contar da citacao.\n\n' +
          'Na accao ordinaria, o prazo para a contestacao e de 20 dias, contados a partir da data da citacao do reu.\n' +
          'Se houver varios reus e o prazo para algum deles terminar antes, o prazo mais longo aproveita a todos.\n' +
          'O prazo e dilatado nos termos do artigo 252.o quando o reu resida fora da area da comarca.',
      },
      {
        title: 'Art. 487.o — Conteudo da contestacao',
        content:
          'Art. 487.o (Conteudo da contestacao)\n\n' +
          'Na contestacao deve o reu:\n' +
          'a) Expor as razoes de facto e de direito por que se opoe a pretensao do autor;\n' +
          'b) Expor os factos essenciais que constituem o fundamento da defesa por excepcao;\n' +
          'c) Juntar documentos e requerer as demais provas.\n\n' +
          'A defesa por excepcao pode ser dilatatoria (visa diferir o conhecimento do merito) ou peremptoria (visa extinguir o direito do autor).',
      },
      {
        title: 'Art. 685.o — Prazo de recurso de apelacao',
        content:
          'Art. 685.o (Prazo de recurso)\n\n' +
          'O prazo para a interposicao do recurso de apelacao e de 30 dias a contar da notificacao da sentenca.\n\n' +
          'O requerimento de interposicao de recurso deve ser acompanhado das respectivas alegacoes, com as conclusoes.\n' +
          'Se o recurso for interposto depois do prazo, e rejeitado por extemporaneo.',
      },
      {
        title: 'Art. 147.o — Prazo para alegacoes',
        content:
          'Art. 147.o (Prazo para alegacoes)\n\n' +
          'O prazo para a apresentacao de alegacoes escritas e de 20 dias a contar da notificacao para esse efeito.\n\n' +
          'As alegacoes devem conter a analise critica das provas e a exposicao das razoes de facto e de direito ' +
          'que sustentam a posicao da parte.',
      },
      {
        title: 'Art. 467.o — Peticao inicial: requisitos',
        content:
          'Art. 467.o (Requisitos da peticao inicial)\n\n' +
          'Na peticao inicial deve o autor:\n' +
          'a) Designar o tribunal onde a accao e proposta;\n' +
          'b) Identificar as partes, indicando nomes, residencias e profissoes;\n' +
          'c) Indicar a forma do processo;\n' +
          'd) Expor os factos e as razoes de direito que servem de fundamento a accao;\n' +
          'e) Formular o pedido;\n' +
          'f) Declarar o valor da causa.',
      },
      {
        title: 'Art. 252.o — Dilacao do prazo',
        content:
          'Art. 252.o (Dilacao do prazo)\n\n' +
          'Quando a parte reside fora da area da comarca, o prazo e acrescido de:\n' +
          'a) 5 dias se residir na mesma provincia;\n' +
          'b) 15 dias se residir em provincia diferente;\n' +
          'c) 30 dias se residir no estrangeiro.\n\n' +
          'A dilacao corre independentemente do prazo e so comeca a contar depois dela decorrida.',
      },
      {
        title: 'Art. 494.o — Excepcoes dilatorias',
        content:
          'Art. 494.o (Excepcoes dilatorias)\n\n' +
          'Sao excepcoes dilatorias:\n' +
          'a) Incompetencia do tribunal;\n' +
          'b) Nulidade de todo o processo;\n' +
          'c) Falta de personalidade ou capacidade judiciaria;\n' +
          'd) Ilegitimidade das partes;\n' +
          'e) Litispendencia;\n' +
          'f) Caso julgado;\n' +
          'g) Pretericao de tribunal arbitral.',
      },
    ],
  },

  // ── Lei Geral do Trabalho ─────────────────────────────
  {
    title: 'Lei Geral do Trabalho',
    shortName: 'LGT',
    reference: 'Lei n.o 7/15 de 15 de Junho',
    category: 'LABORAL',
    articles: [
      {
        title: 'Art. 198.o — Prazo para accao de reintegracao',
        content:
          'Art. 198.o (Prazo para accao de reintegracao)\n\n' +
          'O trabalhador que pretenda impugnar o despedimento deve intentar a accao no prazo de 90 dias ' +
          'a contar da data da recepcao da comunicacao do despedimento.\n\n' +
          'A accao de impugnacao do despedimento e proposta no Tribunal Provincial do Trabalho ' +
          'da area do local de trabalho.',
      },
      {
        title: 'Art. 50.o — Contrato de trabalho: forma',
        content:
          'Art. 50.o (Forma do contrato de trabalho)\n\n' +
          'O contrato de trabalho nao esta sujeito a forma especial, salvo:\n' +
          'a) O contrato a prazo certo, que deve ser reduzido a escrito;\n' +
          'b) O contrato de trabalho com trabalhador estrangeiro;\n' +
          'c) O contrato de aprendizagem.\n\n' +
          'A falta de forma escrita quando exigida determina que o contrato se considera celebrado por tempo indeterminado.',
      },
      {
        title: 'Art. 51.o — Periodo experimental',
        content:
          'Art. 51.o (Periodo experimental)\n\n' +
          'O periodo experimental tem a seguinte duracao:\n' +
          'a) 60 dias para a generalidade dos trabalhadores;\n' +
          'b) 90 dias para trabalhadores que exercam cargos de complexidade tecnica ou de direcao;\n' +
          'c) 180 dias para trabalhadores que exercam cargos de alta direcao ou gestao.\n\n' +
          'Durante o periodo experimental qualquer das partes pode denunciar o contrato sem aviso previo.',
      },
      {
        title: 'Art. 55.o — Despedimento por justa causa',
        content:
          'Art. 55.o (Justa causa de despedimento)\n\n' +
          'Constituem justa causa de despedimento os comportamentos do trabalhador que, ' +
          'pela sua gravidade e consequencias, tornem imediata e praticamente impossivel ' +
          'a subsistencia da relacao de trabalho:\n' +
          'a) Desobediencia grave e reiterada;\n' +
          'b) Violacao dos deveres de lealdade;\n' +
          'c) Provocacao de conflitos com colegas;\n' +
          'd) Desinteresse pelo cumprimento das obrigacoes;\n' +
          'e) Lesao de interesses patrimoniais serios da empresa;\n' +
          'f) Falsas declaracoes relativas a justificacao de faltas.',
      },
      {
        title: 'Art. 60.o — Aviso previo no despedimento',
        content:
          'Art. 60.o (Aviso previo)\n\n' +
          'O despedimento com aviso previo exige que o empregador comunique por escrito ao trabalhador ' +
          'com a seguinte antecedencia:\n' +
          'a) 15 dias, se o trabalhador tiver ate 1 ano de antiguidade;\n' +
          'b) 30 dias, se tiver mais de 1 e ate 5 anos;\n' +
          'c) 60 dias, se tiver mais de 5 e ate 10 anos;\n' +
          'd) 90 dias, se tiver mais de 10 anos de antiguidade.\n\n' +
          'A falta ou insuficiencia de aviso previo da ao trabalhador direito a indemnizacao correspondente.',
      },
      {
        title: 'Art. 229.o — Ferias anuais',
        content:
          'Art. 229.o (Direito a ferias)\n\n' +
          'O trabalhador tem direito a um periodo de ferias remuneradas em cada ano civil de:\n' +
          'a) 22 dias uteis;\n' +
          'b) O periodo e aumentado em 1 dia por cada 3 anos de antiguidade.\n\n' +
          'O direito a ferias e irrenunciavel e nao pode ser substituido por qualquer compensacao economica, ' +
          'excepto nos casos previstos na lei.',
      },
      {
        title: 'Art. 262.o — Salario minimo',
        content:
          'Art. 262.o (Salario minimo nacional)\n\n' +
          'O salario minimo nacional e fixado pelo Governo, ouvido o Conselho Nacional de Concertacao Social.\n\n' +
          'O empregador e obrigado a pagar ao trabalhador uma remuneracao nao inferior ao salario minimo ' +
          'nacional em vigor. A violacao desta obrigacao constitui infraccao grave.',
      },
    ],
  },

  // ── Lei das Sociedades Comerciais ─────────────────────
  {
    title: 'Lei das Sociedades Comerciais',
    shortName: 'LSC',
    reference: 'Lei n.o 1/04 de 13 de Fevereiro',
    category: 'COMERCIAL',
    articles: [
      {
        title: 'Art. 1.o — Tipos de sociedades comerciais',
        content:
          'Art. 1.o (Tipos de sociedades)\n\n' +
          'Sao tipos de sociedades comerciais:\n' +
          'a) Sociedades em nome colectivo;\n' +
          'b) Sociedades por quotas;\n' +
          'c) Sociedades anonimas;\n' +
          'd) Sociedades em comandita simples;\n' +
          'e) Sociedades em comandita por accoes.\n\n' +
          'As sociedades comerciais gozam de personalidade juridica e existem como tais ' +
          'a partir da data do registo definitivo do contrato pelo qual se constituem.',
      },
      {
        title: 'Art. 4.o — Capital social minimo',
        content:
          'Art. 4.o (Capital social)\n\n' +
          'O capital social minimo e:\n' +
          'a) Sociedades por quotas: AKZ 1.000.000,00 (um milhao de kwanzas);\n' +
          'b) Sociedades anonimas: AKZ 20.000.000,00 (vinte milhoes de kwanzas).\n\n' +
          'O capital social deve estar integralmente subscrito no acto de constituicao.',
      },
      {
        title: 'Art. 14.o — Responsabilidade dos socios',
        content:
          'Art. 14.o (Responsabilidade dos socios)\n\n' +
          'Nas sociedades por quotas, os socios sao responsaveis apenas pela sua entrada de capital.\n' +
          'Nas sociedades anonimas, a responsabilidade dos accionistas limita-se ao valor das accoes subscritas.\n' +
          'Nas sociedades em nome colectivo, os socios respondem pelas dividas da sociedade de forma ilimitada e solidaria.',
      },
      {
        title: 'Art. 8.o — Registo comercial obrigatorio',
        content:
          'Art. 8.o (Registo comercial)\n\n' +
          'As sociedades comerciais devem ser registadas na Conservatoria do Registo Comercial.\n\n' +
          'O registo e obrigatorio e deve ser feito no prazo de 90 dias apos a celebracao do contrato de sociedade.\n' +
          'A falta de registo implica que a sociedade nao adquire personalidade juridica.',
      },
    ],
  },

  // ── Codigo Civil ──────────────────────────────────────
  {
    title: 'Codigo Civil',
    shortName: 'CC',
    reference: 'Decreto n.o 47 344/66 (com alteracoes)',
    category: 'CIVIL',
    articles: [
      {
        title: 'Art. 67.o — Capacidade juridica',
        content:
          'Art. 67.o (Capacidade juridica)\n\n' +
          'As pessoas podem ser sujeitos de quaisquer relacoes juridicas, salvo disposicao legal em contrario; ' +
          'nisto consiste a sua capacidade juridica.\n\n' +
          'A capacidade juridica adquire-se no momento do nascimento completo e com vida.',
      },
      {
        title: 'Art. 405.o — Liberdade contratual',
        content:
          'Art. 405.o (Liberdade contratual)\n\n' +
          'Dentro dos limites da lei, as partes tem a faculdade de fixar livremente o conteudo dos contratos, ' +
          'celebrar contratos diferentes dos previstos na lei ou incluir nestes as clausulas que lhes aprouver.\n\n' +
          'As partes podem ainda reunir no mesmo contrato regras de dois ou mais negocios, ' +
          'total ou parcialmente regulados na lei.',
      },
      {
        title: 'Art. 219.o — Liberdade de forma',
        content:
          'Art. 219.o (Liberdade de forma)\n\n' +
          'A validade da declaracao negocial nao depende da observancia de forma especial, ' +
          'salvo quando a lei a exigir.\n\n' +
          'Quando a lei exigir forma especial e esta nao for observada, a declaracao negocial e nula.',
      },
      {
        title: 'Art. 483.o — Responsabilidade civil extracontratual',
        content:
          'Art. 483.o (Principio geral da responsabilidade)\n\n' +
          'Aquele que, com dolo ou mera culpa, violar ilicitamente o direito de outrem ou qualquer disposicao ' +
          'legal destinada a proteger interesses alheios fica obrigado a indemnizar o lesado pelos danos ' +
          'resultantes da violacao.\n\n' +
          'So existe obrigacao de indemnizar independentemente de culpa nos casos especificados na lei.',
      },
      {
        title: 'Art. 498.o — Prescricao do direito de indemnizacao',
        content:
          'Art. 498.o (Prescricao)\n\n' +
          'O direito de indemnizacao prescreve no prazo de 3 anos a contar da data em que o lesado ' +
          'teve conhecimento do direito que lhe compete, embora com desconhecimento da pessoa do responsavel ' +
          'e da extensao integral dos danos.\n\n' +
          'O prazo de prescricao e de 5 anos se a responsabilidade resultar de crime.',
      },
      {
        title: 'Art. 874.o — Compra e venda',
        content:
          'Art. 874.o (Nocao de compra e venda)\n\n' +
          'Compra e venda e o contrato pelo qual se transmite a propriedade de uma coisa, ' +
          'ou outro direito, mediante um preco.\n\n' +
          'A compra e venda de bens imoveis deve ser celebrada por escritura publica ' +
          'ou documento particular autenticado.',
      },
    ],
  },

  // ── Constituicao da Republica de Angola ────────────────
  {
    title: 'Constituicao da Republica de Angola',
    shortName: 'CRA',
    reference: 'Constituicao de 2010',
    category: 'CONSTITUCIONAL',
    articles: [
      {
        title: 'Art. 1.o — Republica de Angola',
        content:
          'Art. 1.o (Republica de Angola)\n\n' +
          'Angola e uma Republica soberana e independente, baseada na dignidade da pessoa humana ' +
          'e na vontade do povo angolano, que tem como objectivo fundamental a construcao ' +
          'de uma sociedade livre, justa, democratica, solidaria, de paz, igualdade e progresso social.',
      },
      {
        title: 'Art. 2.o — Estado Democratico de Direito',
        content:
          'Art. 2.o (Estado Democratico de Direito)\n\n' +
          'A Republica de Angola e um Estado Democratico de Direito que tem como fundamentos ' +
          'a soberania popular, o primado da Constituicao e da lei, a separacao de poderes ' +
          'e a interdependencia de funcoes, a unidade nacional, o pluralismo de expressao ' +
          'e de organizacao politica e a democracia representativa e participativa.',
      },
      {
        title: 'Art. 23.o — Principio da igualdade',
        content:
          'Art. 23.o (Principio da igualdade)\n\n' +
          'Todos sao iguais perante a Constituicao e a lei.\n' +
          'Ninguem pode ser prejudicado, privilegiado, privado de qualquer direito ' +
          'ou isento de qualquer dever em razao da sua ascendencia, sexo, raca, etnia, ' +
          'cor, deficiencia, lingua, local de nascimento, religiao, conviccoes politicas, ' +
          'ideologicas ou filosoficas, grau de instrucao, condicao economica ou social ou profissao.',
      },
      {
        title: 'Art. 26.o — Acesso ao direito e aos tribunais',
        content:
          'Art. 26.o (Acesso ao direito e tutela jurisdicional efectiva)\n\n' +
          'A todos e assegurado o acesso ao direito e aos tribunais para defesa ' +
          'dos seus direitos e interesses legalmente protegidos.\n\n' +
          'A justica nao pode ser denegada por insuficiencia dos meios economicos.\n' +
          'Para defesa dos direitos, liberdades e garantias pessoais, a lei assegura aos cidadaos ' +
          'procedimentos judiciais caracterizados pela celeridade e prioridade.',
      },
      {
        title: 'Art. 36.o — Direito a liberdade fisica e seguranca pessoal',
        content:
          'Art. 36.o (Direito a liberdade fisica)\n\n' +
          'Todo o cidadao tem direito a liberdade fisica e a seguranca individual.\n' +
          'Ninguem pode ser privado da liberdade, excepto nos casos previstos pela Constituicao e pela lei.\n\n' +
          'O direito a liberdade fisica e a seguranca pessoal envolve:\n' +
          'a) O direito de nao ser sujeito a qualquer forma de violencia;\n' +
          'b) O direito de nao ser torturado nem tratado de maneira cruel, desumana ou degradante;\n' +
          'c) O direito de ser informado das razoes da detencao.',
      },
      {
        title: 'Art. 37.o — Direito de propriedade',
        content:
          'Art. 37.o (Direito de propriedade, requisicao e expropriacao)\n\n' +
          'E garantido o direito a propriedade privada e a sua transmissao, nos termos da Constituicao e da lei.\n\n' +
          'A requisicao civil e a expropriacao por utilidade publica so podem ser efectuadas ' +
          'com base na lei e mediante o pagamento de justa indemnizacao.',
      },
      {
        title: 'Art. 76.o — Direito ao trabalho',
        content:
          'Art. 76.o (Direito ao trabalho)\n\n' +
          'O trabalho e um direito e um dever de todos.\n' +
          'Todo o trabalhador tem direito a formacao profissional, justa remuneracao, descanso, ferias, ' +
          'proteccao, higiene e seguranca no trabalho.\n\n' +
          'Para assegurar o direito ao trabalho, incumbe ao Estado promover a implementacao ' +
          'de politicas de emprego.',
      },
    ],
  },

  // ── Legislacao ARSEG (Seguros) ────────────────────────
  {
    title: 'Lei da Actividade Seguradora',
    shortName: 'LAS',
    reference: 'Lei n.o 1/00 de 3 de Fevereiro (Lei de Bases dos Seguros)',
    category: 'SEGUROS',
    articles: [
      {
        title: 'Art. 3.o — Actividade seguradora',
        content:
          'Art. 3.o (Actividade seguradora)\n\n' +
          'A actividade seguradora compreende as operacoes de seguros e resseguros, ' +
          'bem como as actividades conexas, incluindo a mediacao de seguros.\n\n' +
          'O exercicio da actividade seguradora depende de autorizacao previa da ARSEG ' +
          '(Agencia Angolana de Regulacao e Supervisao de Seguros).',
      },
      {
        title: 'Art. 12.o — Mediadores de seguros',
        content:
          'Art. 12.o (Mediacao de seguros)\n\n' +
          'A mediacao de seguros e exercida por:\n' +
          'a) Corretores de seguros;\n' +
          'b) Agentes de seguros.\n\n' +
          'Os corretores de seguros actuam por conta dos tomadores de seguro, ' +
          'representando os seus interesses junto das seguradoras.\n' +
          'A inscricao no registo de mediadores de seguros da ARSEG e obrigatoria.',
      },
      {
        title: 'Art. 25.o — Contrato de seguro: elementos essenciais',
        content:
          'Art. 25.o (Elementos essenciais do contrato de seguro)\n\n' +
          'O contrato de seguro deve conter:\n' +
          'a) Identificacao das partes;\n' +
          'b) Objecto do seguro e riscos cobertos;\n' +
          'c) Capital segurado ou criterio para a sua determinacao;\n' +
          'd) Premio ou modo de o determinar;\n' +
          'e) Duracao do contrato;\n' +
          'f) Data de inicio de vigencia.',
      },
      {
        title: 'Art. 30.o — Dever de informacao',
        content:
          'Art. 30.o (Dever de informacao e boa fe)\n\n' +
          'O tomador do seguro e obrigado a declarar com exactidao todas as circunstancias ' +
          'que conheca e que razoavelmente devam ser consideradas como significativas ' +
          'para a apreciacao do risco pelo segurador.\n\n' +
          'A omissao ou inexactidao dolosa implica a anulabilidade do contrato.',
      },
    ],
  },

  // ── Codigo Penal ──────────────────────────────────────
  {
    title: 'Codigo Penal',
    shortName: 'CP',
    reference: 'Lei n.o 38/20 de 11 de Novembro (Codigo Penal)',
    category: 'PENAL',
    articles: [
      {
        title: 'Art. 23.o — Dolo',
        content:
          'Art. 23.o (Dolo)\n\n' +
          'Age com dolo quem, representando um facto que preenche um tipo de crime, ' +
          'actuar com intencao de o realizar (dolo directo), ' +
          'ou quem representar a realizacao do facto como consequencia necessaria da sua conduta (dolo necessario), ' +
          'ou quem representar a realizacao do facto como consequencia possivel da sua conduta e actuar ' +
          'conformando-se com essa realizacao (dolo eventual).',
      },
      {
        title: 'Art. 131.o — Homicidio simples',
        content:
          'Art. 131.o (Homicidio simples)\n\n' +
          'Quem matar outra pessoa e punido com pena de prisao de 8 a 16 anos.',
      },
      {
        title: 'Art. 203.o — Furto',
        content:
          'Art. 203.o (Furto)\n\n' +
          'Quem, com ilegitima intencao de apropriacao para si ou para outra pessoa, ' +
          'subtrair coisa movel alheia e punido com pena de prisao ate 3 anos ou com pena de multa.\n\n' +
          'A tentativa e punivel.',
      },
      {
        title: 'Art. 217.o — Burla',
        content:
          'Art. 217.o (Burla)\n\n' +
          'Quem, com intencao de obter para si ou para terceiro enriquecimento ilegitimo, ' +
          'por meio de erro ou engano sobre factos que astuciosamente provocou, ' +
          'determinar outrem a pratica de actos que lhe causem ou causem a outra pessoa ' +
          'prejuizo patrimonial e punido com pena de prisao ate 3 anos ou com pena de multa.',
      },
    ],
  },

  // ── Estatuto da OAA ───────────────────────────────────
  {
    title: 'Estatuto da Ordem dos Advogados de Angola',
    shortName: 'EOAA',
    reference: 'Lei n.o 1/95 de 6 de Janeiro',
    category: 'OUTRO',
    articles: [
      {
        title: 'Art. 3.o — Funcao do advogado',
        content:
          'Art. 3.o (Funcao do advogado)\n\n' +
          'O advogado e um servidor da justica e do direito, competindo-lhe de forma exclusiva ' +
          'e com as excepcoes previstas na lei, exercer o mandato judicial em qualquer foro.\n\n' +
          'O exercicio da advocacia e incompativel com qualquer funcao publica ou privada, ' +
          'excepto a docencia, a investigacao cientifica e funcoes em orgaos de classe.',
      },
      {
        title: 'Art. 78.o — Deveres deontologicos',
        content:
          'Art. 78.o (Deveres deontologicos do advogado)\n\n' +
          'Sao deveres gerais do advogado:\n' +
          'a) Manter em qualquer circunstancia a honra, dignidade e independencia;\n' +
          'b) Considerar como confidencial toda a informacao recebida do cliente;\n' +
          'c) Recusar o patrocinio a causas que considere injustas;\n' +
          'd) Declinar o mandato quando haja conflito de interesses;\n' +
          'e) Tratar com urbanidade os magistrados, colegas e demais intervenientes processuais.',
      },
      {
        title: 'Art. 95.o — Honorarios',
        content:
          'Art. 95.o (Honorarios de advogado)\n\n' +
          'Os honorarios do advogado sao livremente convencionados com o cliente, ' +
          'devendo ser fixados com moderacao e atendendo:\n' +
          'a) A importancia e complexidade dos servicos;\n' +
          'b) A dificuldade e urgencia da causa;\n' +
          'c) O tempo despendido;\n' +
          'd) A situacao economica do cliente;\n' +
          'e) As possibilidades do foro.\n\n' +
          'E vedada a quota litis (pacto de quota parte do resultado da accao).',
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// Seed Logic
// ═══════════════════════════════════════════════════════════

async function seedLegislation() {
  console.log('\n=== Kamaia — Seed Legislation ===\n');

  let totalDocs = 0;
  let totalChunks = 0;

  for (const leg of LEGISLATION) {
    // Check if document already exists (by shortName + reference)
    const existing = await prisma.legislationDocument.findFirst({
      where: {
        shortName: leg.shortName,
        reference: leg.reference,
      },
    });

    if (existing) {
      console.log(`  [SKIP] ${leg.shortName} — already exists (${existing.id})`);
      continue;
    }

    // Create document
    const doc = await prisma.legislationDocument.create({
      data: {
        title: leg.title,
        shortName: leg.shortName,
        reference: leg.reference,
        category: leg.category,
      },
    });

    console.log(`  [DOC] ${leg.shortName} — ${leg.title} (${doc.id})`);
    totalDocs++;

    // Create chunks (without embeddings — those need Gemini API)
    for (let i = 0; i < leg.articles.length; i++) {
      const article = leg.articles[i];
      const tokenCount = Math.ceil(article.content.length / 4);

      await prisma.legislationChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: i,
          title: article.title,
          content: article.content,
          tokenCount,
        },
      });

      console.log(`    [CHUNK ${i}] ${article.title} (${tokenCount} tokens)`);
      totalChunks++;
    }
  }

  console.log(`\n=== Done: ${totalDocs} documents, ${totalChunks} chunks ===`);
  console.log(
    '\nNote: Chunks created WITHOUT embeddings. Run the backfill endpoint ' +
    'or use POST /rag/ingest/text with GEMINI_API_KEY to generate embeddings.\n',
  );
}

seedLegislation()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
