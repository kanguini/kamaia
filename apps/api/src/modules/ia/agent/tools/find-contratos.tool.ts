import { z } from 'zod';
import { Role, ContratoEstado, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { defineTool } from '../tool.types';

/**
 * find_contratos — primeira tool do agente.
 *
 * Pesquisa por contratos com filtros básicos. Sem acesso a outros
 * tenants — `tenantId` injectado do ctx, ignorado se vier nos args.
 *
 * Defesa em camadas:
 *  - Zod schema: apenas campos esperados, sem `tenantId`
 *  - Query Prisma: WHERE tenantId hardcoded do ctx
 *  - deletedAt: nunca devolvemos soft-deleted
 *  - limit: clamp [1, 50] para evitar dumps massivos
 */

const FindContratosArgsSchema = z.object({
  search: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Termo de pesquisa livre. Procura em título, número interno, descrição.',
    ),
  estado: z
    .enum(Object.values(ContratoEstado) as [string, ...string[]])
    .optional()
    .describe('Filtra por estado do contrato (INTAKE, ACTIVO, TERMINADO, etc.)'),
  tipoCodigo: z
    .string()
    .max(50)
    .optional()
    .describe('Código do tipo de contrato (NDA, CTR_AGENCIA, etc.)'),
  dataTermoAntes: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      'Filtra contratos com dataTermo <= esta data. Formato YYYY-MM-DD. Útil para "contratos que expiram este mês".',
    ),
  dataTermoDepois: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe(
      'Filtra contratos com dataTermo >= esta data. Formato YYYY-MM-DD.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Número máximo de resultados (1-50, default 10)'),
});

type FindContratosArgs = z.infer<typeof FindContratosArgsSchema>;

interface ContratoSummary {
  id: string;
  numeroInterno: string;
  titulo: string;
  estado: ContratoEstado;
  tipoCodigo: string;
  tipoNome: string;
  valor: string | null;
  moeda: string | null;
  dataTermo: string | null;
  diasParaTermo: number | null;
}

interface FindContratosResult {
  count: number;
  total: number;
  contratos: ContratoSummary[];
  hint?: string;
}

export function buildFindContratosTool(prisma: PrismaService) {
  return defineTool<FindContratosArgs, FindContratosResult>({
    name: 'find_contratos',
    description: `Pesquisa por contratos no tenant actual. Devolve uma lista com metadados principais (número interno, título, estado, tipo, valor, data de termo, dias até expirar).

Quando usar:
- "Que contratos tenho activos?"
- "Mostra-me contratos que expiram nos próximos 30 dias"
- "Quantos contratos de tipo NDA?"
- "Procura contratos com a Hexa"

Não usar para:
- Detalhe completo de UM contrato específico — preferir open_contrato (Sprint 1.3)
- Criar contratos — usar create_contrato (Sprint 1.4)`,
    schema: FindContratosArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
      // EXTERNAL: omitido. Para EXTERNAL precisamos filtro por ColaboradorAccess
      // que adicionamos noutra sprint.
    ],
    mutates: false,
    async execute(args, ctx) {
      const where: Prisma.ContratoWhereInput = {
        tenantId: ctx.tenantId,
        deletedAt: null,
      };

      if (args.search) {
        where.OR = [
          { titulo: { contains: args.search, mode: 'insensitive' } },
          { numeroInterno: { contains: args.search, mode: 'insensitive' } },
          { descricao: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      if (args.estado) where.estado = args.estado as ContratoEstado;

      if (args.tipoCodigo) {
        where.tipo = {
          codigo: { equals: args.tipoCodigo, mode: 'insensitive' },
        };
      }

      if (args.dataTermoAntes || args.dataTermoDepois) {
        where.dataTermo = {
          ...(args.dataTermoAntes && { lte: new Date(args.dataTermoAntes) }),
          ...(args.dataTermoDepois && { gte: new Date(args.dataTermoDepois) }),
        };
      }

      const limit = args.limit ?? 10;
      const [rows, total] = await Promise.all([
        prisma.contrato.findMany({
          where,
          orderBy: [
            { dataTermo: 'asc' }, // contratos mais perto de expirar primeiro
            { updatedAt: 'desc' },
          ],
          take: limit,
          include: {
            tipo: { select: { codigo: true, nome: true } },
          },
        }),
        prisma.contrato.count({ where }),
      ]);

      const now = new Date();
      const contratos: ContratoSummary[] = rows.map((c) => ({
        id: c.id,
        numeroInterno: c.numeroInterno,
        titulo: c.titulo,
        estado: c.estado,
        tipoCodigo: c.tipo.codigo,
        tipoNome: c.tipo.nome,
        valor: c.valor !== null ? c.valor.toString() : null,
        moeda: c.moeda,
        dataTermo: c.dataTermo ? c.dataTermo.toISOString().slice(0, 10) : null,
        diasParaTermo: c.dataTermo
          ? Math.ceil(
              (c.dataTermo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            )
          : null,
      }));

      const hint =
        total === 0
          ? 'Nenhum contrato encontrado. Verifica os filtros ou propõe ao utilizador criar um.'
          : total > limit
            ? `${total} contratos correspondem; a mostrar os primeiros ${limit}. Sugere ao utilizador refinar os filtros para ver os restantes.`
            : undefined;

      return {
        result: { count: contratos.length, total, contratos, hint },
        renderHint: 'list',
        uiPayload: {
          // Para o frontend renderizar chips clicáveis sem reprocessar
          items: contratos.map((c) => ({
            id: c.id,
            label: `${c.numeroInterno} · ${c.titulo}`,
            sublabel: `${c.tipoNome} · ${c.estado}${c.diasParaTermo !== null ? ` · ${c.diasParaTermo}d` : ''}`,
            href: `/contratos/${c.id}`,
          })),
        },
      };
    },
  });
}
