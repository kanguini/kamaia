import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { defineTool } from '../tool.types';

/**
 * list_datas_chave — pesquisa por datas-chave (assinatura, termo,
 * renovação, denúncia, pagamento, milestone, etc.).
 *
 * Útil para perguntas tipo "que contratos expiram este mês",
 * "próximas renovações", etc.
 */

const ListDatasChaveArgsSchema = z.object({
  contratoId: z
    .string()
    .uuid()
    .optional()
    .describe('Limita a datas de UM contrato específico.'),
  tipo: z
    .enum([
      'ASSINATURA',
      'INICIO_VIGENCIA',
      'TERMO',
      'RENOVACAO_AUTOMATICA',
      'JANELA_DENUNCIA_INICIO',
      'JANELA_DENUNCIA_FIM',
      'PAGAMENTO',
      'ENTREGA',
      'REVISAO_PRECO',
      'MILESTONE',
      'GARANTIA_VALIDADE',
      'SEGURO_VALIDADE',
      'OUTRO',
    ])
    .optional()
    .describe('Filtra por tipo de data-chave.'),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Início do intervalo (YYYY-MM-DD).'),
  ate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Fim do intervalo (YYYY-MM-DD).'),
  apenasNaoCumpridas: z
    .boolean()
    .optional()
    .default(true)
    .describe('Filtra para datas ainda não cumpridas. Default true.'),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type ListDatasChaveArgs = z.infer<typeof ListDatasChaveArgsSchema>;

export function buildListDatasChaveTool(prisma: PrismaService) {
  return defineTool({
    name: 'list_datas_chave',
    description: `Pesquisa datas-chave de contratos (assinatura, termo, renovação, denúncia, pagamento, entrega, revisão de preço, garantias, seguros, milestones).

Quando usar:
- "Que contratos expiram nos próximos 30 dias?"
- "Próximas renovações automáticas"
- "Há pagamentos por fazer em Outubro?"
- "Lista as datas-chave do contrato X"
- "Quais janelas de denúncia estão abertas agora?"

Devolve a tipo, data, descrição, contrato associado e se está cumprida. Default ordena por data ascendente (mais próximas primeiro).`,
    schema: ListDatasChaveArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
    ],
    mutates: false,
    async execute(rawArgs, ctx) {
      const args = rawArgs as ListDatasChaveArgs;

      const where: Prisma.ContratoDataChaveWhereInput = {
        // Tenant isolation via relação ao Contrato
        contrato: {
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
      };

      if (args.contratoId) where.contratoId = args.contratoId;
      if (args.tipo) where.tipo = args.tipo;
      if (args.apenasNaoCumpridas !== false) where.cumprida = false;
      if (args.desde || args.ate) {
        where.data = {
          ...(args.desde && { gte: new Date(args.desde) }),
          ...(args.ate && { lte: new Date(args.ate) }),
        };
      }

      const limit = args.limit ?? 20;
      const [rows, total] = await Promise.all([
        prisma.contratoDataChave.findMany({
          where,
          orderBy: { data: 'asc' },
          take: limit,
          include: {
            contrato: {
              select: { id: true, numeroInterno: true, titulo: true },
            },
          },
        }),
        prisma.contratoDataChave.count({ where }),
      ]);

      const now = new Date();
      const datas = rows.map((d) => {
        const dias = Math.ceil(
          (d.data.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          id: d.id,
          tipo: d.tipo,
          data: d.data.toISOString().slice(0, 10),
          dias,
          atrasada: dias < 0 && !d.cumprida,
          descricao: d.descricao,
          cumprida: d.cumprida,
          contratoId: d.contrato.id,
          contratoNumero: d.contrato.numeroInterno,
          contratoTitulo: d.contrato.titulo,
        };
      });

      const hint =
        total === 0
          ? 'Nenhuma data-chave correspondente.'
          : total > limit
            ? `${total} datas-chave; a mostrar as primeiras ${limit} por proximidade.`
            : undefined;

      return {
        result: { count: datas.length, total, datas, hint },
        renderHint: 'list',
        uiPayload: {
          items: datas.map((d) => ({
            id: d.id,
            label: `${prettyTipo(d.tipo)} · ${d.data}`,
            sublabel: `${d.contratoNumero} — ${d.contratoTitulo}${d.atrasada ? ' · em atraso' : ` · ${d.dias}d`}`,
            href: `/contratos/${d.contratoId}`,
          })),
        },
      };
    },
  });
}

function prettyTipo(t: string): string {
  const map: Record<string, string> = {
    ASSINATURA: 'Assinatura',
    INICIO_VIGENCIA: 'Início',
    TERMO: 'Termo',
    RENOVACAO_AUTOMATICA: 'Renovação',
    JANELA_DENUNCIA_INICIO: 'Janela denúncia (início)',
    JANELA_DENUNCIA_FIM: 'Janela denúncia (fim)',
    PAGAMENTO: 'Pagamento',
    ENTREGA: 'Entrega',
    REVISAO_PRECO: 'Revisão de preço',
    MILESTONE: 'Milestone',
    GARANTIA_VALIDADE: 'Garantia',
    SEGURO_VALIDADE: 'Seguro',
    OUTRO: 'Outro',
  };
  return map[t] ?? t;
}
