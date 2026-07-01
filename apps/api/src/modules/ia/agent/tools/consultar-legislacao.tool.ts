import { z } from 'zod';
import { Role } from '@prisma/client';
import { RagService } from '../../../rag/rag.service';
import { defineTool } from '../tool.types';

/**
 * consultar_legislacao — pesquisa na biblioteca de LEGISLAÇÃO ANGOLANA
 * (LegislationDocument + chunks) e devolve os trechos mais relevantes,
 * com o diploma e o artigo. É a base factual do Dr. Kamaia como
 * conselheiro jurídico: fundamentar respostas na lei em vez de inventar.
 *
 * Legislação é um acervo global (não per-tenant) — sem filtro de tenant.
 */

const ConsultarLegislacaoArgsSchema = z.object({
  q: z
    .string()
    .min(2)
    .max(500)
    .describe(
      'A pergunta jurídica ou os termos a procurar (ex.: "prazo de denúncia no arrendamento urbano", "Imposto de Selo em contratos de mútuo", "requisitos do contrato-promessa").',
    ),
  topK: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .default(6)
    .describe('Nº de trechos a devolver (default 6).'),
});

type ConsultarLegislacaoArgs = z.infer<typeof ConsultarLegislacaoArgsSchema>;

export function buildConsultarLegislacaoTool(rag: RagService) {
  return defineTool({
    name: 'consultar_legislacao',
    description: `Pesquisa na biblioteca de LEGISLAÇÃO ANGOLANA carregada e devolve os trechos mais relevantes, com o diploma e o artigo.

USA SEMPRE esta ferramenta antes de afirmares o que a lei diz — nunca inventes ou cites legislação de memória. Se não houver resultados, di-lo com clareza ("não encontrei base na legislação carregada") e não afirmes o conteúdo da lei.

Quando usar:
- "O que diz a lei sobre X?"
- "Qual o prazo legal de denúncia no arrendamento?"
- Fundamentar juridicamente uma recomendação ou decisão.
- Confirmar a base legal de uma obrigação, imposto ou registo.

Devolve, por resultado: diploma, título, artigo (quando disponível) e o trecho. Cita sempre o diploma/artigo na resposta.`,
    schema: ConsultarLegislacaoArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
    ],
    mutates: false,
    async execute(rawArgs) {
      const args = rawArgs as ConsultarLegislacaoArgs;
      const res = await rag.search({ q: args.q, topK: args.topK ?? 6 });
      const resultados = res.data.map((r) => ({
        diploma: r.document?.diploma ?? null,
        titulo: r.document?.titulo ?? null,
        codigo: r.document?.codigo ?? null,
        artigo: r.artigo ?? null,
        trecho: r.trecho,
        documentId: r.documentId,
      }));
      return {
        result: {
          modo: res.mode,
          total: res.total,
          resultados,
          nota:
            resultados.length === 0
              ? 'Sem resultados na legislação carregada — não afirmar o conteúdo da lei sem base.'
              : undefined,
        },
      };
    },
  });
}
