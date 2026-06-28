import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { AnimatedGradient } from '@/components/AnimatedGradient'
import { DrKamaia } from '@/components/DrKamaia'
import { Reveal } from '@/components/Reveal'
import { appUrl } from '@/lib/utm'

// FAQ mantido sincronizado com o componente Faq() para o rich result do Google.
const FAQ_ITEMS = [
  {
    q: 'O que é o Kamaia?',
    a: 'Um sistema de gestão do ciclo de vida de contratos (CLM) para empresas angolanas. Acompanha cada contrato do primeiro rascunho ao arquivo — solicitação, negociação, assinatura, vida activa, renovações, adendas e terminação — com o compliance angolano embebido. Serve organizações com carteiras de centenas a dezenas de milhares de contratos.',
  },
  {
    q: 'Tenho de criar tudo de raiz ou posso trazer a carteira que já existe?',
    a: 'As duas vias valem por igual. Pode criar contratos de raiz, ou importar a carteira que já tem — em massa, a partir de PDF, Word ou documentos digitalizados. A extracção assistida lê partes, valores e datas-chave de cada contrato e coloca-o de imediato sob gestão. A maioria das organizações começa precisamente por aqui.',
  },
  {
    q: 'Em que sectores faz sentido?',
    a: 'Em qualquer sector que viva de contratos. O catálogo cobre Imobiliário, Indústria, Serviços, Comércio, Banca, Seguros, Petróleo & Gás, Mineração, Telecomunicações, Agricultura, Construção, Transportes, Saúde, Educação, Tecnologia, Energia, Turismo e Retail — e cada organização estende-o com os seus próprios tipos.',
  },
  {
    q: 'Como trata o compliance angolano?',
    a: 'Um motor de regras versionadas avalia cada contrato e sugere os actos regulatórios aplicáveis — Imposto de Selo (TGIS), registos públicos, BNA e Lei Cambial, retenção AGT e reconhecimento notarial — com o prazo legal e a referência ao diploma vigente à data do facto. O motor sugere; a sua equipa confirma. Nunca submete nada sem confirmação humana.',
  },
  {
    q: 'Quanto tempo demora a entrar em produção?',
    a: 'Uma carteira de algumas centenas de contratos existentes é importada e indexada em horas. Os alertas de renovação e os prazos passam a estar visíveis no próprio dia. Equipas que começam a redigir de raiz costumam ter um piloto em produção em duas a quatro semanas.',
  },
  {
    q: 'Quem é o Dr. Kamaia?',
    a: 'O conselheiro de IA do sistema. Vigia a carteira e sinaliza o que exige atenção, responde a perguntas sobre a legislação angolana com citação ao artigo, dá sentido a um contrato herdado e assiste na redacção. Apoia a decisão — nunca substitui o aconselhamento jurídico profissional, e cada sugestão fica sujeita a confirmação.',
  },
  {
    q: 'E a segurança e a confidencialidade?',
    a: 'Isolamento por organização em todas as camadas, registo de auditoria imutável em cada escrita, selo temporal e hash nas versões assinadas, e cifra em repouso e em trânsito. Os detalhes constam da política de privacidade.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((it) => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Nav />
      <main>
        <Hero />
        <Positioning />
        <Pillars />
        <Features />
        <ComplianceCallout />
        <Faq />
        <CTAFinal />
      </main>
      <Footer />
    </>
  )
}

// ─── Hero ────────────────────────────────────────────────────
function Hero() {
  return (
    <section
      className="relative flex flex-col"
      style={{
        marginTop: '-68px',
        paddingTop: '68px',
        minHeight: '100svh',
        overflowX: 'clip',
      }}
    >
      <AnimatedGradient />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(10,20,40,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-4 pt-[clamp(80px,12vh,130px)] pb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] text-neutral-600 backdrop-blur-sm">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: '#6be49a' }} />
          Gestão do ciclo de vida de contratos · Angola
        </span>

        <h1 className="mt-7 mx-auto max-w-[980px] font-sans text-[clamp(40px,5.4vw,76px)] font-medium leading-[1.06] tracking-[-0.01em] text-neutral-900">
          O ciclo de vida dos seus contratos,
          <br />
          sob{' '}
          <em className="not-italic" style={{ color: '#9cb6ff' }}>
            domínio.
          </em>
        </h1>

        <p className="mt-6 max-w-[700px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-neutral-600">
          Crie de raiz ou herde a carteira que já existe. O Kamaia acompanha
          cada contrato — renovações, obrigações, assinaturas e compliance
          angolano — para que nada lhe escape. Com o Dr.&nbsp;Kamaia a vigiar a
          carteira e a responder com a lei aplicável.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={appUrl('/register', 'hero_cta')}
            className="inline-flex items-center rounded-md bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.02]"
          >
            Criar conta
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-6 py-3.5 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
          >
            Agendar demonstração
          </Link>
        </div>
      </div>

      {/* Dr. Kamaia — personificação animada */}
      <div className="relative z-10 flex justify-center px-4 pb-16">
        <DrKamaia />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-20"
        style={{ background: 'linear-gradient(to bottom, transparent, #fff 95%)' }}
      />
    </section>
  )
}

// ─── Positioning ─────────────────────────────────────────────
function Positioning() {
  return (
    <section className="relative bg-white px-6 py-24 md:py-32">
      <Reveal>
        <div className="mx-auto max-w-[860px] text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            Para quem
          </p>
          <h2 className="mt-4 font-sans text-[clamp(28px,3.8vw,48px)] font-medium leading-[1.15] text-neutral-900">
            Para organizações que vivem de contratos.
          </h2>
          <p className="mt-6 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-neutral-600">
            Uma imobiliária com 800 arrendamentos a renovar. Uma indústria com
            200 contratos de fornecimento. Uma direcção jurídica que não pode
            perder uma janela de denúncia. Uma seguradora com obrigações a
            vencer todos os meses. O Kamaia foi desenhado para esta realidade —
            alto volume, compliance exigente, e a língua e a lei de Angola.
          </p>
        </div>
      </Reveal>
    </section>
  )
}

// ─── Pillars ─────────────────────────────────────────────────
function Pillars() {
  const PILLARS = [
    {
      title: 'O ciclo de vida, de ponta a ponta',
      body: 'Solicitação, redacção, negociação, aprovação, assinatura, vida activa, adendas e terminação. Cada contrato tem um estado claro, transições validadas e uma cronologia imutável. Nada se decide sem rasto.',
    },
    {
      title: 'Criar ou herdar — vale por igual',
      body: 'Redija contratos novos ou traga a carteira que já existe, importada em massa com extracção assistida de partes, valores e datas. Herdar um contrato é tão sólido quanto criá-lo de raiz — e é por aí que a maioria começa.',
    },
    {
      title: 'Compliance angolano embebido',
      body: 'Imposto de Selo, registos públicos, BNA e Lei Cambial, retenção AGT e reconhecimento notarial — sugeridos a partir das características de cada contrato, com prazo legal e referência ao diploma vigente. O sistema sugere; a sua equipa confirma.',
    },
    {
      title: 'O Dr. Kamaia ao seu lado',
      body: 'Um conselheiro de IA que vigia a carteira, sinaliza o que exige atenção, dá sentido a um contrato herdado e responde sobre a legislação angolana com citação ao artigo. Apoia a decisão; a palavra final é sempre sua.',
    },
  ]
  return (
    <section className="relative bg-white px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Pilares
            </p>
            <h2 className="mt-3 font-sans text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-neutral-900">
              Quatro pilares. Uma carteira sob controlo.
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PILLARS.map((p) => (
            <Reveal key={p.title}>
              <article className="h-full rounded-2xl border border-neutral-200 bg-neutral-50 p-8 backdrop-blur-sm transition-all hover:border-neutral-300 hover:bg-neutral-50">
                <h3 className="font-sans text-2xl font-medium text-neutral-900">
                  {p.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
                  {p.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────
function Features() {
  const FEATURES = [
    {
      group: 'Herança',
      title: 'Importação da carteira existente',
      body:
        'Carregue os contratos que já tem — PDF, Word ou digitalizados. A extracção assistida lê partes, datas-chave e valor; a sua equipa confirma antes de publicar.',
    },
    {
      group: 'Negociação',
      title: 'Comparação entre versões',
      body:
        'Veja, lado a lado, que cláusulas mudaram de uma versão para a outra — com um resumo na linguagem do negócio. Sem ler tudo de novo.',
    },
    {
      group: 'Vida activa',
      title: 'Alertas que não falham',
      body:
        'Renovação a 30 dias, janela de denúncia a fechar, Imposto de Selo por liquidar. Por e-mail, notificação e dentro do sistema — para que nenhum prazo passe despercebido.',
    },
    {
      group: 'Biblioteca',
      title: 'Cláusulas reutilizáveis',
      body:
        'A cláusula que negociou há seis meses fica pesquisável e ligada ao contrato de origem. O acervo da organização cresce a cada contrato.',
    },
    {
      group: 'Compliance',
      title: 'Imposto de Selo calculado',
      body:
        'Verbas da TGIS para prestação de serviços, arrendamento, mútuo e compra e venda. O sistema calcula a base e sugere o prazo; a sua equipa confirma.',
    },
    {
      group: 'Integração',
      title: 'API e webhooks',
      body:
        'Despolete fluxos quando um contrato é assinado, expira ou muda de estado. Integre com o seu ERP, a ferramenta de assinatura ou o data lake.',
    },
  ]
  return (
    <section className="relative bg-white px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <div className="mb-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Funcionalidades
            </p>
            <h2 className="mt-3 font-sans text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-neutral-900">
              Funciona como a sua organização funciona.
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-px bg-neutral-100 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Reveal key={f.title}>
              <article className="h-full bg-white p-7">
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                  {f.group}
                </p>
                <h3 className="mt-3 font-sans text-xl font-medium text-neutral-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">
                  {f.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Compliance Callout ──────────────────────────────────────
function ComplianceCallout() {
  return (
    <section className="relative bg-white px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1080px]">
        <Reveal>
          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-100 to-neutral-50 p-10 md:p-14">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              A vantagem angolana
            </p>
            <h2 className="mt-4 font-sans text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15] text-neutral-900">
              O compliance do país, tratado de origem —
              <br />
              sugerido pelo sistema, confirmado por si.
            </h2>
            <p className="mt-6 max-w-[760px] text-[15px] leading-relaxed text-neutral-600">
              O motor lê o tipo de contrato, o valor, as partes e o objecto e
              apresenta os actos regulatórios aplicáveis, com prazo legal,
              referência ao diploma e nota obrigatória. Cada acto é confirmado
              pela sua equipa. As regras são versionadas: aplica-se a lei
              vigente à data do facto tributário, não a data de hoje. É uma
              vantagem do produto — não a razão única para o adoptar.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              {['Imposto de Selo', 'Registo Comercial', 'Registo Predial', 'BNA / Lei Cambial', 'Retenção AGT'].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-[13px] text-neutral-600"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────
function Faq() {
  return (
    <section className="relative bg-white px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[820px]">
        <Reveal>
          <div className="mb-12 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
              Perguntas frequentes
            </p>
            <h2 className="mt-3 font-sans text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-neutral-900">
              As respostas, sem rodeios.
            </h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <Reveal key={item.q}>
              <details className="group rounded-xl border border-neutral-200 bg-neutral-50 p-5 transition-colors hover:border-neutral-300">
                <summary className="cursor-pointer list-none text-[15px] font-medium text-neutral-900">
                  {item.q}
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Final ───────────────────────────────────────────────
function CTAFinal() {
  return (
    <section className="relative bg-white px-6 py-28">
      <Reveal>
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="font-sans text-[clamp(32px,4vw,52px)] font-medium leading-[1.1] text-neutral-900">
            Comece pela carteira que já tem.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-neutral-600">
            Importe os contratos existentes e veja os alertas de renovação no
            próprio dia. Quando estiver pronta, a sua organização passa a
            redigir os próximos aqui — com a mesma exigência.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={appUrl('/register', 'cta_final')}
              className="inline-flex items-center rounded-md bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white transition-all hover:scale-[1.02]"
            >
              Criar conta
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center rounded-md border border-neutral-300 bg-neutral-50 px-6 py-3.5 text-sm font-medium text-neutral-900 backdrop-blur-sm transition-colors hover:bg-neutral-100"
            >
              Agendar demonstração
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
