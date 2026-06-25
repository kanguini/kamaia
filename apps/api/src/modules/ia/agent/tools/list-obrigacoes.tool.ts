import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { defineTool } from '../tool.types';

/**
 * list_obrigacoes — pesquisa obrigações periódicas/contínuas
 * (pagamentos, reportes, SLAs, entregas, garantias activas, etc.).
 *
 * Default devolve obrigações activas com proximaData ordenada por
 * proximidade. Útil para "que obrigações tenho esta semana" ou
 * "quais obrigações em atraso".
 */

const ListObrigacoesArgsSchema = z.object({
  contratoId: z
    .string()
    .uuid()
    .optional()
    .describe('Limita a obrigações de UM contrato.'),
  tipo: z
    .enum([
      'PAGAMENTO_PERIODICO',
      'REPORTE',
      'GARANTIA_VALIDADE',
      'SEGURO_VALIDADE',
      'SLA',
      'ENTREGA_PERIODICA',
      'OUTRO',
    ])
    .optional()
    .describe('Filtra por tipo de obrigação.'),
  periodicidade: z
    .enum(['UNICA', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'])
    .optional(),
  proximaDataAntes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filtra obrigações com proximaData <= esta data.'),
  proximaDataDepois: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  apenasActivas: z
    .boolean()
    .optional()
    .default(true)
    .describe('Filtra apenas obrigações activas (default true).'),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type ListObrigacoesArgs = z.infer<typeof ListObrigacoesArgsSchema>;

export function buildListObrigacoesTool(prisma: PrismaService) {
  return defineTool({
    name: 'list_obrigacoes',
    description: `Pesquisa obrigações periódicas ou contínuas dos contratos: pagamentos recorrentes, reportes, SLAs, entregas, validade de garantias, validade de seguros.

Quando usar:
- "Que obrigações tenho esta semana?"
- "Obrigações em atraso"
- "Pagamentos mensais que ainda não cumpri"
- "Quais garantias expiram este mês?"
- "Lista as obrigações do contrato X"

Devolve tipo, periodicidade, descrição, próxima data, valor esperado, contrato associado.`,
    schema: ListObrigacoesArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
    ],
    mutates: false,
    async execute(rawArgs, ctx) {
      const args = rawArgs as ListObrigacoesArgs;

      const where: Prisma.ContratoObrigacaoWhereInput = {
        contrato: {
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      };

      if (args.contratoId) where.contratoId = args.contratoId;
      if (args.tipo) where.tipo = args.tipo;
      if (args.periodicidade) where.periodicidade = args.periodicidade;
      if (args.apenasActivas !== false) where.isActive = true;
      if (args.proximaDataAntes || args.proximaDataDepois) {
        where.proximaData = {
          ...(args.proximaDataAntes && { lte: new Date(args.proximaDataAntes) }),
          ...(args.proximaDataDepois && { gte: new Date(args.proximaDataDepois) }),
        };
      }

      const limit = args.limit ?? 20;
      const [rows, total] = await Promise.all([
        prisma.contratoObrigacao.findMany({
          where,
          orderBy: { proximaData: 'asc' },
          take: limit,
          include: {
            contrato: {
              select: { id: true, numeroInterno: true, titulo: true },
            },
          },
        }),
        prisma.contratoObrigacao.count({ where }),
      ]);

      const now = new Date();
      const obrigacoes = rows.map((o) => {
        const dias = o.proximaData
          ? Math.ceil(
              (o.proximaData.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
        return {
          id: o.id,
          tipo: o.tipo,
          periodicidade: o.periodicidade,
          descricao: o.descricao,
          proximaData: o.proximaData
            ? o.proximaData.toISOString().slice(0, 10)
            : null,
          dias,
          atrasada: dias !== null && dias < 0,
          valor: o.valorEsperado ? o.valorEsperado.toString() : null,
          moeda: o.moeda,
          contratoId: o.contrato.id,
          contratoNumero: o.contrato.numeroInterno,
          contratoTitulo: o.contrato.titulo,
        };
      });

      const hint =
        total === 0
          ? 'Nenhuma obrigação correspondente.'
          : total > limit
            ? `${total} obrigações; a mostrar as primeiras ${limit} por proximidade.`
            : undefined;

      return {
        result: { count: obrigacoes.length, total, obrigacoes, hint },
        renderHint: 'list',
        uiPayload: {
          items: obrigacoes.map((o) => {
            const tipoLabel = prettyTipoObr(o.tipo);
            const dataStr = o.proximaData ?? 'sem data';
            return {
              id: o.id,
              label: `${tipoLabel} · ${dataStr}`,
              sublabel: `${o.contratoNumero} — ${o.descricao.slice(0, 80)}${o.atrasada ? ' · em atraso' : ''}`,
              href: `/contratos/${o.contratoId}`,
            };
          }),
        },
      };
    },
  });
}

function prettyTipoObr(t: string): string {
  const map: Record<string, string> = {
    PAGAMENTO_PERIODICO: 'Pagamento',
    REPORTE: 'Reporte',
    GARANTIA_VALIDADE: 'Garantia',
    SEGURO_VALIDADE: 'Seguro',
    SLA: 'SLA',
    ENTREGA_PERIODICA: 'Entrega',
    OUTRO: 'Outro',
  };
  return map[t] ?? t;
}
