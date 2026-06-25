import { z } from 'zod';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { defineTool } from '../tool.types';

/**
 * open_contrato — UI action que devolve URL para o frontend abrir.
 *
 * Não navega no servidor — devolve um `target` que o frontend usa
 * para fazer routing. Antes valida que o contrato existe no tenant
 * actual (evita devolver URLs para contratos de outros tenants).
 */

const OpenContratoArgsSchema = z.object({
  contratoId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'UUID do contrato. Usa este parâmetro quando já tens o ID (via find_contratos).',
    ),
  numeroInterno: z
    .string()
    .max(50)
    .optional()
    .describe(
      'Número interno do contrato (ex: "CT-2026-00042"). Usa quando o utilizador menciona o número.',
    ),
});

type OpenContratoArgs = z.infer<typeof OpenContratoArgsSchema>;

/**
 * Tipo da resposta — declarado explicitamente porque a tool tem dois
 * caminhos (sucesso, erro) com shapes diferentes; sem isto o TS
 * tentaria fundir os dois e queixava-se de campos undefined.
 */
type OpenContratoResult =
  | {
      contratoId: string;
      numeroInterno: string;
      titulo: string;
      estado: string;
      tipo: string;
      target: string;
    }
  | { error: string };

export function buildOpenContratoTool(prisma: PrismaService) {
  return defineTool<OpenContratoArgs, OpenContratoResult>({
    name: 'open_contrato',
    description: `Abre o detalhe de UM contrato específico na app. Usa esta tool quando o utilizador pede para "ver", "abrir", "mostrar" um contrato. Pelo menos um de contratoId ou numeroInterno é obrigatório.

Quando NÃO usar:
- Para pesquisar uma lista — usa find_contratos
- Para criar um contrato — usa create_contrato (Sprint 1.4)`,
    schema: OpenContratoArgsSchema,
    requiredRoles: [
      Role.ADMIN,
      Role.LEGAL_LEAD,
      Role.CONTRACT_MANAGER,
      Role.BUSINESS_USER,
      Role.VIEWER,
    ],
    mutates: false,
    async execute(args, ctx) {
      if (!args.contratoId && !args.numeroInterno) {
        return {
          result: {
            error: 'Forneça contratoId ou numeroInterno.',
          },
          isError: true,
          renderHint: 'text',
        };
      }

      const contrato = await prisma.contrato.findFirst({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          ...(args.contratoId && { id: args.contratoId }),
          ...(args.numeroInterno && {
            numeroInterno: { equals: args.numeroInterno, mode: 'insensitive' },
          }),
        },
        select: {
          id: true,
          numeroInterno: true,
          titulo: true,
          estado: true,
          tipo: { select: { nome: true } },
        },
      });

      if (!contrato) {
        return {
          result: {
            error: `Não encontrei contrato ${args.numeroInterno ?? args.contratoId}.`,
          },
          isError: true,
          renderHint: 'text',
        };
      }

      return {
        result: {
          contratoId: contrato.id,
          numeroInterno: contrato.numeroInterno,
          titulo: contrato.titulo,
          estado: contrato.estado,
          tipo: contrato.tipo.nome,
          target: `/contratos/${contrato.id}`,
        },
        renderHint: 'navigate',
        uiPayload: {
          items: [
            {
              id: contrato.id,
              label: `${contrato.numeroInterno} · ${contrato.titulo}`,
              sublabel: `${contrato.tipo.nome} · ${contrato.estado}`,
              href: `/contratos/${contrato.id}`,
            },
          ],
        },
      };
    },
  });
}
