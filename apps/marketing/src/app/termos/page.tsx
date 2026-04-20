import type { Metadata } from 'next'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Termos de serviço',
  description:
    'Termos e condições de uso da plataforma Kamaia — SaaS de gestão jurídica para advogados em Angola.',
}

const LAST_UPDATED = '19 de Abril de 2026'

export default function TermosPage() {
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
              Termos de serviço
            </h1>
            <p className="mt-3 text-sm text-white/55">
              Última actualização: {LAST_UPDATED}
            </p>
          </div>
        </section>

        <section className="py-16">
          <article className="shell max-w-3xl space-y-10 text-[15px] leading-relaxed text-white/80 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-white [&_h2]:tracking-[-0.02em] [&_h2]:mt-8 [&_p]:text-white/75 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4">

            <section>
              <h2>1. Aceitação</h2>
              <p>
                Ao criar uma conta ou utilizar o Kamaia, aceitas integralmente
                estes Termos. Se não concordas, não deves usar o serviço.
              </p>
            </section>

            <section>
              <h2>2. Descrição do serviço</h2>
              <p>
                O Kamaia é uma aplicação Software as a Service (SaaS) destinada
                a advogados e sociedades de advogados. Inclui gestão de
                processos, prazos, clientes, facturação, timesheets, agenda,
                documentos e assistente IA.
              </p>
              <p>
                O serviço é fornecido no estado em que se encontra (&ldquo;as-is&rdquo;)
                com as evoluções e correcções que forem sendo lançadas.
              </p>
            </section>

            <section>
              <h2>3. Conta e elegibilidade</h2>
              <ul>
                <li>
                  Deves ter capacidade legal para celebrar contratos em Angola
                </li>
                <li>
                  Os dados de conta devem ser verdadeiros e mantidos
                  actualizados
                </li>
                <li>
                  És responsável por manter a confidencialidade das credenciais
                </li>
                <li>
                  Deves notificar-nos imediatamente em caso de uso não
                  autorizado
                </li>
              </ul>
            </section>

            <section>
              <h2>4. Planos e pagamento</h2>
              <ul>
                <li>
                  Trial de 14 dias gratuito. Não é necessário cartão de crédito
                </li>
                <li>
                  Planos pagos facturados mensal ou anualmente, em AOA
                </li>
                <li>
                  Desconto de 15% na facturação anual antecipada
                </li>
                <li>
                  Preços podem ser revistos com aviso prévio de 60 dias
                </li>
                <li>
                  Em caso de incumprimento de pagamento, a conta entra em
                  modo só-leitura após 7 dias. Suspensão total aos 30 dias
                </li>
              </ul>
            </section>

            <section>
              <h2>5. Utilização aceitável</h2>
              <p>Comprometes-te a não:</p>
              <ul>
                <li>Usar o serviço para fins ilegais</li>
                <li>Enviar spam ou conteúdo malicioso</li>
                <li>Tentar aceder a dados de outros gabinetes</li>
                <li>Fazer engenharia reversa ou contornar limites técnicos</li>
                <li>
                  Revender ou sublicenciar o acesso sem autorização escrita
                </li>
              </ul>
            </section>

            <section>
              <h2>6. Propriedade intelectual</h2>
              <p>
                A plataforma, código e marca Kamaia pertencem a GMS Advogados.
                Tu mantens a propriedade dos dados que inseres (clientes,
                processos, documentos). Concedes-nos apenas uma licença
                limitada para os processar no âmbito da prestação do serviço.
              </p>
            </section>

            <section>
              <h2>7. Privacidade e protecção de dados</h2>
              <p>
                O tratamento de dados pessoais é regulado pela nossa{' '}
                <a href="/politica-privacidade">Política de Privacidade</a>. Ao
                aceitares estes Termos, aceitas também essa política.
              </p>
            </section>

            <section>
              <h2>8. Disponibilidade e suporte</h2>
              <ul>
                <li>
                  Comprometemo-nos a uma disponibilidade mínima de 99,5% no
                  plano Gabinete e 99,9% no plano Pro Business
                </li>
                <li>
                  Janelas de manutenção programadas fora do horário comercial
                  (WAT)
                </li>
                <li>
                  Suporte por email em todos os planos pagos; prioritário no
                  plano Gabinete e acima
                </li>
              </ul>
            </section>

            <section>
              <h2>9. Limitação de responsabilidade</h2>
              <p>
                O Kamaia é uma ferramenta de apoio. A responsabilidade pela
                prática jurídica, cumprimento de prazos e qualidade do trabalho
                permanece inteiramente dos advogados utilizadores.
              </p>
              <p>
                Na máxima medida permitida pela lei angolana, a nossa
                responsabilidade total está limitada ao valor pago pelo cliente
                nos últimos 12 meses.
              </p>
            </section>

            <section>
              <h2>10. Rescisão</h2>
              <p>
                Podes cancelar a conta a qualquer momento pelas configurações.
                Podemos rescindir contas em caso de violação destes Termos,
                dando aviso prévio de 14 dias excepto em casos graves.
              </p>
              <p>
                Após rescisão, dispões de 30 dias para exportar os dados.
              </p>
            </section>

            <section>
              <h2>11. Alterações</h2>
              <p>
                Alterações materiais a estes Termos são comunicadas com 30 dias
                de antecedência. O uso continuado do serviço após essa data
                implica aceitação.
              </p>
            </section>

            <section>
              <h2>12. Foro e lei aplicável</h2>
              <p>
                Estes Termos regem-se pela lei angolana. Foro competente:
                Tribunais de Luanda, com renúncia a qualquer outro.
              </p>
            </section>

            <section>
              <h2>13. Contacto</h2>
              <p>
                Dúvidas sobre estes Termos:{' '}
                <a href="mailto:legal@kamaia.cc">legal@kamaia.cc</a> ou{' '}
                <a href="/contacto">contacta-nos pelo formulário</a>.
              </p>
            </section>

          </article>
        </section>
      </main>
      <Footer />
    </>
  )
}
