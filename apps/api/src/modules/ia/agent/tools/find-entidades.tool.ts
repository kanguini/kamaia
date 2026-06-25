import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { defineTool } from '../tool.types';

/**
 * find_entidades — pesquisa por contrapartes/entidades.
 *
 * Roles: ADMIN/LEGAL_LEAD/CONTRACT_MANAGER/BUSINESS_USER/VIEWER.
 * EXTERNAL omitido (não pode listar entidades — só ver as suas).
 */

const FindEntidadesArgsSchema = z.object({
  search: z
    .string()
    .max(200)
    .optional()
    .describe('Termo de pesquisa em nome, nome comercial, NIF.'),
  tipo: z
    .enum(['PESSOA_SINGULAR', 'PESSOA_COLECTIVA'])
    .optional()
    .describe('Filtra por tipo de pessoa.'),
  paisResidencia: z
    .string()
    .length(2)
    .optional()
    .describe(
      'Código ISO 3166-1 alpha-2 do país (AO, PT, etc.). Útil para "entidades estrangeiras".',
    ),
  isInstituicaoFinanceira: z
    .boolean()
    .optional()
    .describe('Filtra apenas bancos/seguradoras/fintechs.'),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

type FindEntidadesArgs = z.infer<typeof FindEntidadesArgsSchema>;

export function buildFindEntidadesTool(prisma: PrismaService) {
  return defineTool({
    name: 'find_entidades',
    description: `Pesquisa entidades (contrapartes) no tenant actual. Devolve nome, NIF, tipo, residência cambial, indicador de instituição financeira.

Quando usar:
- "Mostra-me as contrapartes que tenho"
- "Procura a Hexa Seguros"
- "Quais entidades não-residentes tenho?"
- "Quem é a entidade XYZ?"`,
    schema: FindEntidadesArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
    ],
    mutates: false,
    async execute(rawArgs, ctx) {
      const args = rawArgs as FindEntidadesArgs;
      const where: Prisma.EntidadeWhereInput = {
        tenantId: ctx.tenantId,
        deletedAt: null,
      };

      if (args.search) {
        where.OR = [
          { nome: { contains: args.search, mode: 'insensitive' } },
          { nomeComercial: { contains: args.search, mode: 'insensitive' } },
          { nif: { contains: args.search, mode: 'insensitive' } },
        ];
      }
      if (args.tipo) where.tipo = args.tipo;
      if (args.paisResidencia) {
        where.paisResidencia = { equals: args.paisResidencia, mode: 'insensitive' };
      }
      if (args.isInstituicaoFinanceira !== undefined) {
        where.isInstituicaoFinanceira = args.isInstituicaoFinanceira;
      }

      const limit = args.limit ?? 10;
      const [rows, total] = await Promise.all([
        prisma.entidade.findMany({
          where,
          orderBy: { nome: 'asc' },
          take: limit,
          select: {
            id: true,
            nome: true,
            nomeComercial: true,
            tipo: true,
            nif: true,
            paisResidencia: true,
            nacionalidadeCambial: true,
            isInstituicaoFinanceira: true,
            sectorActividade: true,
          },
        }),
        prisma.entidade.count({ where }),
      ]);

      const entidades = rows.map((e) => ({
        id: e.id,
        nome: e.nome,
        nomeComercial: e.nomeComercial,
        tipo: e.tipo,
        nif: e.nif,
        paisResidencia: e.paisResidencia,
        residencia: e.nacionalidadeCambial,
        isInstituicaoFinanceira: e.isInstituicaoFinanceira,
        sector: e.sectorActividade,
      }));

      const hint =
        total === 0
          ? 'Nenhuma entidade encontrada. O catálogo pode estar vazio.'
          : total > limit
            ? `${total} entidades correspondem; a mostrar as primeiras ${limit}.`
            : undefined;

      return {
        result: { count: entidades.length, total, entidades, hint },
        renderHint: 'list',
        uiPayload: {
          items: entidades.map((e) => ({
            id: e.id,
            label: e.nome,
            sublabel: [
              e.tipo === 'PESSOA_COLECTIVA' ? 'Empresa' : 'Pessoa',
              e.nif ? `NIF ${e.nif}` : null,
              e.paisResidencia !== 'AO' ? `(${e.paisResidencia})` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            href: `/entidades/${e.id}`,
          })),
        },
      };
    },
  });
}
