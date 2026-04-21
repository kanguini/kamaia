import type { Metadata } from 'next'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description:
    'Como o Kamaia recolhe, armazena e protege os dados dos gabinetes e dos seus clientes. Conforme Lei 22/11 de protecção de dados pessoais de Angola.',
  alternates: { canonical: '/politica-privacidade' },
}

const LAST_UPDATED = '19 de Abril de 2026'

export default function PoliticaPrivacidadePage() {
  return (
    <>
      <Nav />
      <main className="bg-black text-white">
        <section className="border-b border-white/5 py-20">
          <div className="shell max-w-3xl">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">
              Legal
            </span>
            <h1 className="mt-3 text-[clamp(32px,4vw,48px)] font-medium leading-[1.1] tracking-[-0.02em]">
              Política de privacidade
            </h1>
            <p className="mt-3 text-sm text-white/55">
              Última actualização: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="py-16">
          <article className="shell max-w-3xl space-y-10 text-[15px] leading-relaxed text-white/80 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-white [&_h2]:tracking-[-0.02em] [&_h2]:mt-8 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:text-white/75 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4">

            <section>
              <h2>1. Quem somos</h2>
              <p>
                Kamaia é operado por GMS Advogados, sociedade de advogados com
                sede em Luanda, Angola. Actuamos como responsável pelo
                tratamento dos dados relativos aos utilizadores do site e
                encarregado de tratamento para os dados inseridos pelos
                gabinetes na plataforma.
              </p>
              <p>
                Contactos: <a href="mailto:privacidade@kamaia.cc">privacidade@kamaia.cc</a>
              </p>
            </section>

            <section>
              <h2>2. Enquadramento legal</h2>
              <p>
                Aplicamos a Lei n.º 22/11, de 17 de Junho, sobre a Protecção de
                Dados Pessoais em Angola, e adoptamos as boas práticas do
                Regulamento Geral de Protecção de Dados (UE 2016/679) sempre
                que aplicável aos nossos utilizadores.
              </p>
            </section>

            <section>
              <h2>3. Que dados recolhemos</h2>
              <h3>3.1 Dados de conta</h3>
              <ul>
                <li>Nome, apelido, email, telefone</li>
                <li>Nome do gabinete, NIF, endereço</li>
                <li>Número da Ordem dos Advogados (opcional)</li>
              </ul>
              <h3>3.2 Dados inseridos na plataforma</h3>
              <ul>
                <li>Clientes e respectivos dados de contacto</li>
                <li>Processos, peças, documentos anexados</li>
                <li>Prazos, horas trabalhadas, facturas</li>
              </ul>
              <h3>3.3 Dados técnicos</h3>
              <ul>
                <li>Endereço IP, tipo de browser, sistema operativo</li>
                <li>Logs de acesso (audit log append-only)</li>
              </ul>
            </section>

            <section>
              <h2>4. Como protegemos os dados</h2>
              <ul>
                <li>Encriptação TLS 1.3 em trânsito e AES-256 em repouso</li>
                <li>Isolamento multi-tenant com Row-Level Security no PostgreSQL</li>
                <li>Backups encriptados com retenção de 30 dias</li>
                <li>Autenticação JWT com refresh tokens rotativos</li>
                <li>Audit log de todas as escritas em modo append-only</li>
                <li>Revisão periódica de acessos e RBAC</li>
              </ul>
            </section>

            <section>
              <h2>5. Partilha com terceiros</h2>
              <p>
                Não vendemos nem cedemos os teus dados. Utilizamos fornecedores
                estritamente necessários à operação do serviço:
              </p>
              <ul>
                <li>
                  <strong>Infraestrutura:</strong> Vercel (hosting do site),
                  Railway (API e base de dados), AWS S3 (ficheiros)
                </li>
                <li>
                  <strong>Email transaccional:</strong> Resend
                </li>
                <li>
                  <strong>SMS de alerta:</strong> Twilio
                </li>
                <li>
                  <strong>IA Assistente:</strong> Google (Gemini API), com
                  dados despersonalizados no processamento
                </li>
              </ul>
              <p>
                Todos os fornecedores têm acordos de processamento de dados
                assinados e cumprem normas equivalentes às aplicáveis em
                Angola.
              </p>
            </section>

            <section>
              <h2>6. Os teus direitos</h2>
              <p>
                Podes a qualquer momento:
              </p>
              <ul>
                <li>Aceder aos teus dados</li>
                <li>Corrigir dados incorrectos</li>
                <li>Exportar todos os dados em formato JSON</li>
                <li>Pedir a eliminação da conta (30 dias de grace)</li>
                <li>Revogar consentimentos específicos</li>
              </ul>
              <p>
                Envia o pedido para{' '}
                <a href="mailto:privacidade@kamaia.cc">privacidade@kamaia.cc</a>.
                Respondemos em até 15 dias úteis.
              </p>
            </section>

            <section>
              <h2>7. Cookies</h2>
              <p>
                O site público usa cookies estritamente necessários para
                sessão. Para analítica usamos Plausible Analytics, que não
                utiliza cookies nem recolhe dados pessoais. A aplicação
                autenticada usa cookies de sessão seguros (HttpOnly, SameSite
                Lax).
              </p>
            </section>

            <section>
              <h2>8. Retenção</h2>
              <p>
                Dados activos: enquanto a conta estiver activa. Após
                eliminação: 30 dias em soft-delete, depois remoção definitiva.
                Logs de auditoria: 7 anos para cumprir requisitos de
                rastreabilidade processual.
              </p>
            </section>

            <section>
              <h2>9. Alterações</h2>
              <p>
                Actualizamos esta política sempre que necessário. Mudanças
                materiais são comunicadas por email aos utilizadores com pelo
                menos 30 dias de antecedência.
              </p>
            </section>

            <section>
              <h2>10. Contacto</h2>
              <p>
                Dúvidas ou reclamações relacionadas com privacidade:
              </p>
              <ul>
                <li>Email: <a href="mailto:privacidade@kamaia.cc">privacidade@kamaia.cc</a></li>
                <li>Morada: GMS Advogados, Luanda, Angola</li>
              </ul>
            </section>

          </article>
        </section>
      </main>
      <Footer />
    </>
  )
}
