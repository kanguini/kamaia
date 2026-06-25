import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { AnimatedGradient } from '@/components/AnimatedGradient'
import { HeroFloatingCards } from '@/components/HeroFloatingCards'
import { Reveal } from '@/components/Reveal'
import { Pricing } from '@/components/Pricing'
import { appUrl } from '@/lib/utm'

// FAQ mantido sincronizado com o componente Faq() para o rich result do Google.
const FAQ_ITEMS = [
  {
    q: 'O que é o Kamaia exactamente?',
    a: 'O Kamaia é um Contract Lifecycle Management (CLM) horizontal — um sistema para gerir o ciclo de vida completo dos contratos da tua organização, desde a solicitação inicial até ao arquivo após a terminação. Pensado para empresas com carteiras de centenas a dezenas de milhares de contratos, e para sociedades de advogados que oferecem gestão de contratos como serviço aos seus clientes.',
  },
  {
    q: 'Em que sectores faz sentido usar?',
    a: 'O Kamaia é horizontal — funciona em qualquer sector que tenha contratos. O catálogo de fábrica cobre Imobiliário, Indústria, Serviços, Comércio, Banca, Seguros, Petróleo & Gás, Mineração, Telecomunicações, Agricultura, Construção, Transportes, Saúde, Educação, Tecnologia, Energia, Turismo e Retail. Cada organização pode estender o catálogo com tipos próprios.',
  },
  {
    q: 'Como ajuda com o compliance angolano?',
    a: 'Compliance Engine embebido com regras versionadas para Imposto de Selo (TGIS), Registos (Predial, Comercial, Automóvel, IAPI), BNA/Lei Cambial/RJOC, retenção AGT sobre serviços de não-residentes, e reconhecimento notarial. O motor sugere os actos requeridos e os prazos legais a partir das características de cada contrato — confirma sempre com o responsável jurídico antes de submeter.',
  },
  {
    q: 'Qual o tempo típico de adopção?',
    a: 'Em modo Repositório, uma carteira de algumas centenas de contratos já existentes é importada e indexada em horas, com extracção assistida de partes, datas-chave e valor. Equipas a estrear o produto de raiz costumam ter uma carteira-piloto em produção em 2 a 4 semanas.',
  },
  {
    q: 'Posso usar como sociedade de advogados a gerir contratos dos meus clientes?',
    a: 'Sim. O plano AGENCY permite criar tenants-filho, um por cliente. Cada cliente fica totalmente isolado do outro — pesquisa, dados, IA, audit log. A tua equipa navega entre eles via workspace switcher. Os teus clientes não pagam — facturamos só ao gabinete.',
  },
  {
    q: 'Como é garantida a segurança e confidencialidade?',
    a: 'Isolamento por tenant com guards em todas as camadas. Audit log append-only em todas as escritas. Hash + selo temporal nas versões assinadas. Storage em R2 ou S3 com cifra em repouso e em trânsito. Backups encriptados. Os detalhes estão na política de privacidade.',
  },
  {
    q: 'Como funciona a IA?',
    a: 'A IA do Kamaia foca-se em Q&A sobre legislação angolana, com citação ao artigo aplicável. O catálogo seed inclui Constituição, Código Civil, Código Comercial, Lei das Sociedades Comerciais, Código do Imposto de Selo, Lei Cambial, Lei do Trabalho, Lei do Investimento Privado, Lei de Protecção de Dados (22/11), Lei 3/14 sobre branqueamento, entre outros. O assistente nunca substitui aconselhamento jurídico profissional.',
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
        <Pricing />
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
            'radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage:
            'radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-4 pt-[clamp(80px,12vh,130px)] pb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] text-white/65 backdrop-blur-sm">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: '#6be49a' }} />
          O agente de IA que gere os teus contratos · Localizado para Angola
        </span>

        <h1 className="mt-7 mx-auto max-w-[960px] font-playfair text-[clamp(40px,5.4vw,76px)] font-medium leading-[1.06] tracking-[-0.01em] text-white">
          O sistema operativo dos teus
          <br />
          <em className="not-italic" style={{ color: '#9cb6ff' }}>
            contratos.
          </em>
        </h1>

        <p className="mt-6 max-w-[680px] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-white/72">
          A Kamaia AI pesquisa, cria e monitoriza contratos por ti, em
          linguagem natural. Compliance angolano (Imposto de Selo, BNA, AGT,
          registos) calculado automaticamente. Multi-sector, alto volume.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={appUrl('/register', 'hero_cta')}
            className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
          >
            Criar conta
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Falar com a equipa
          </Link>
        </div>
      </div>

      <HeroFloatingCards />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 z-20"
        style={{ background: 'linear-gradient(to bottom, transparent, #000 95%)' }}
      />
    </section>
  )
}

// ─── Positioning ─────────────────────────────────────────────
function Positioning() {
  return (
    <section className="relative bg-black px-6 py-24 md:py-32">
      <Reveal>
        <div className="mx-auto max-w-[860px] text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Para quem
          </p>
          <h2 className="mt-4 font-playfair text-[clamp(28px,3.8vw,48px)] font-medium leading-[1.15] text-white">
            Empresas com carteira de contratos.
            <br />
            Sociedades de advogados que cuidam dela.
          </h2>
          <p className="mt-6 text-[clamp(15px,1.4vw,17px)] leading-relaxed text-white/65">
            Imobiliária com 800 arrendamentos a renovar. Industrial com 200 contratos
            de fornecimento. Banca com SLAs a vencer. Direcção jurídica que perdeu
            a janela de denúncia. Gabinete que cuida da carteira de cinco clientes
            corporativos. O Kamaia fala a linguagem destes problemas — e responde
            em português angolano, com a lei aplicável.
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
      title: 'Ciclo de vida completo',
      body: 'Solicitação → Drafting → Revisão → Negociação → Aprovação → Assinatura → Vida activa → Adendas → Terminação. 17 estados, transições validadas, timeline imutável por contrato.',
    },
    {
      title: 'Compliance angolano embebido',
      body: 'Imposto de Selo automático, registos públicos, BNA/Lei Cambial, retenção AGT, reconhecimento notarial. Regras versionadas com referência ao diploma vigente à data do facto.',
    },
    {
      title: 'IA sobre a legislação angolana',
      body: 'Q&A com citação ao artigo. 13 diplomas-âncora curados — Constituição, Códigos, Lei Cambial, Lei 22/11, Lei 3/14. A IA sugere; tu validas.',
    },
    {
      title: 'Hierarquia multi-tenant',
      body: 'Modo AGENCY: sociedades de advogados gerem N clientes isolados num só interface. Workspace switcher tipo Linear. Audit cruzado para defesa legal.',
    },
  ]
  return (
    <section className="relative bg-black px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Pilares
            </p>
            <h2 className="mt-3 font-playfair text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-white">
              Quatro coisas que ninguém faz por ti em Angola.
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {PILLARS.map((p) => (
            <Reveal key={p.title}>
              <article className="h-full rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.04]">
                <h3 className="font-playfair text-2xl font-medium text-white">
                  {p.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/65">
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
      group: 'Repositório',
      title: 'Importação em massa',
      body:
        'Carrega PDFs e ZIPs da tua carteira legada. OCR + extracção IA preenchem partes, datas-chave, valor. Revisão humana antes de publicar.',
    },
    {
      group: 'Negociação',
      title: 'Diff inteligente entre versões',
      body:
        'V3 contra V2 numa tabela: que cláusulas mudaram e como. Resumo em linguagem do negócio. Foco no que importa.',
    },
    {
      group: 'Vida activa',
      title: 'Alertas que não falham',
      body:
        'Renovação automática em 30 dias, janela de denúncia a fechar, IS por liquidar. Email, push e in-app — múltiplos canais para garantir.',
    },
    {
      group: 'Biblioteca',
      title: 'Cláusulas reutilizáveis',
      body:
        'A cláusula que negociaste há 6 meses está pesquisável e linkada ao contrato de origem. A biblioteca do gabinete cresce sozinha.',
    },
    {
      group: 'Compliance',
      title: 'TGIS automático',
      body:
        '11 verbas seed cobrindo prestação de serviços, arrendamento, mútuo, compra e venda. Calcula a base, sugere o prazo. Tu confirmas.',
    },
    {
      group: 'Integração',
      title: 'API + Webhooks',
      body:
        'Dispara fluxos quando um contrato é assinado, expira, ou muda de estado. Integra com o teu ERP, ferramenta de assinatura, ou data lake.',
    },
  ]
  return (
    <section className="relative bg-black px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <div className="mb-16">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Funcionalidades
            </p>
            <h2 className="mt-3 font-playfair text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-white">
              Construído para o trabalho real.
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Reveal key={f.title}>
              <article className="h-full bg-black p-7">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  {f.group}
                </p>
                <h3 className="mt-3 font-playfair text-xl font-medium text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">
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
    <section className="relative bg-black px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1080px]">
        <Reveal>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-10 md:p-14">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Compliance Engine
            </p>
            <h2 className="mt-4 font-playfair text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15] text-white">
              Imposto de Selo, registos, BNA e AGT —
              <br />
              sugeridos automaticamente, validados por ti.
            </h2>
            <p className="mt-6 max-w-[760px] text-[15px] leading-relaxed text-white/65">
              O motor lê o tipo de contrato, o valor, as partes e o objecto e
              produz a lista de actos regulatórios aplicáveis com prazo legal,
              referência ao diploma vigente e disclaimer obrigatório. Tu confirmas
              cada acto manualmente. Cada regra é versionada — a lei vigente à
              data do facto tributário é a que se aplica, não a data presente.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              {['TGIS', 'Registo Comercial', 'Registo Predial', 'BNA / RJOC', 'AGT IRT'].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-[13px] text-white/70"
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
    <section className="relative bg-black px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[820px]">
        <Reveal>
          <div className="mb-12 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Perguntas frequentes
            </p>
            <h2 className="mt-3 font-playfair text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.15] text-white">
              O essencial, sem dar voltas.
            </h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <Reveal key={item.q}>
              <details className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20">
                <summary className="cursor-pointer list-none text-[15px] font-medium text-white">
                  {item.q}
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-white/60">
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
    <section className="relative bg-black px-6 py-28">
      <Reveal>
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="font-playfair text-[clamp(32px,4vw,52px)] font-medium leading-[1.1] text-white">
            Começa pela tua carteira de hoje.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/60">
            Importa os contratos que já tens. Vê alertas de renovação em 24 horas.
            Decide depois se queres redigir os próximos aqui.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href={appUrl('/register', 'cta_final')}
              className="inline-flex items-center rounded-md bg-white px-6 py-3.5 text-sm font-medium text-black transition-all hover:scale-[1.02]"
            >
              Criar conta
            </Link>
            <Link
              href="/contacto"
              className="inline-flex items-center rounded-md border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Agendar demonstração
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
