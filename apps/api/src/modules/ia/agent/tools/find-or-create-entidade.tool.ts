import { z } from 'zod';
import { Role, EntidadeTipo, EntidadeNacionalidadeCambial } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EntidadesService } from '../../../entidades/entidades.service';
import { defineTool } from '../tool.types';

/**
 * find_or_create_entidade — resolve uma referência a uma entidade.
 *
 * Cenário típico: o utilizador diz "cria contrato com a Hexa".
 * O agente precisa de saber o entidadeId. Em vez de pedir ao
 * utilizador, esta tool:
 *  - Procura por nome (case-insensitive) ou NIF
 *  - Se encontra UMA correspondência clara, devolve o id
 *  - Se encontra várias, devolve a lista e devolve isError para
 *    que Claude peça ao utilizador para escolher
 *  - Se não encontra nada E o utilizador autorizou (`createIfMissing`),
 *    cria uma stub com o mínimo (nome) e marca para revisão posterior
 *
 * `createIfMissing` força criação. Sem isto, NUNCA cria — apenas
 * sugere. Isto protege contra ficheiros inflados de entidades
 * acidentais.
 */

const FindOrCreateEntidadeArgsSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(200)
    .describe('Nome ou NIF a procurar.'),
  createIfMissing: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Se true, cria entidade stub com apenas o nome quando não encontra. Só deve ser true se o utilizador autorizou claramente.',
    ),
  tipo: z
    .enum(['PESSOA_SINGULAR', 'PESSOA_COLECTIVA'])
    .optional()
    .default('PESSOA_COLECTIVA')
    .describe('Tipo a usar se for preciso criar. Default: empresa.'),
});

type FindOrCreateEntidadeArgs = z.infer<typeof FindOrCreateEntidadeArgsSchema>;

type FindOrCreateResult =
  | {
      status: 'found';
      entidadeId: string;
      nome: string;
      nif: string | null;
    }
  | {
      status: 'created';
      entidadeId: string;
      nome: string;
      hint: string;
    }
  | {
      status: 'ambiguous';
      candidates: Array<{ id: string; nome: string; nif: string | null }>;
      hint: string;
    }
  | {
      status: 'not_found';
      hint: string;
    };

export function buildFindOrCreateEntidadeTool(
  prisma: PrismaService,
  entidadesService: EntidadesService,
) {
  return defineTool<FindOrCreateEntidadeArgs, FindOrCreateResult>({
    name: 'find_or_create_entidade',
    description: `Resolve uma referência a uma entidade (contraparte). Usa esta tool quando precisas de um entidadeId mas só tens nome ou NIF.

Comportamento:
- 1 match → devolve o id directamente
- Vários matches → devolve candidatos para o utilizador escolher
- Nenhum match → devolve not_found; pede ao utilizador para confirmar a criação
- Apenas se o utilizador autorizar explicitamente, invoca com createIfMissing=true para criar uma stub

NUNCA invoca com createIfMissing=true sem o utilizador ter autorizado claramente.`,
    schema: FindOrCreateEntidadeArgsSchema,
    requiredRoles: [Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER],
    mutates: true,
    // Só precisa de confirmação quando vai mesmo criar — uma pesquisa
    // pura (createIfMissing=false) não muta e não deve gatear.
    needsConfirmation: (args) => args.createIfMissing === true,
    async execute(args, ctx) {
      // Pesquisa por nome / NIF
      const matches = await prisma.entidade.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          OR: [
            { nome: { contains: args.query, mode: 'insensitive' } },
            { nomeComercial: { contains: args.query, mode: 'insensitive' } },
            { nif: { contains: args.query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, nome: true, nif: true },
        take: 5,
      });

      if (matches.length === 1) {
        return {
          result: {
            status: 'found',
            entidadeId: matches[0].id,
            nome: matches[0].nome,
            nif: matches[0].nif,
          },
          renderHint: 'text',
        };
      }

      if (matches.length > 1) {
        // Match exacto por nome — desempate
        const exact = matches.find(
          (m) => m.nome.toLowerCase() === args.query.toLowerCase(),
        );
        if (exact) {
          return {
            result: {
              status: 'found',
              entidadeId: exact.id,
              nome: exact.nome,
              nif: exact.nif,
            },
            renderHint: 'text',
          };
        }
        return {
          result: {
            status: 'ambiguous',
            candidates: matches,
            hint: `Encontrei ${matches.length} entidades parecidas. Pede ao utilizador para escolher.`,
          },
          renderHint: 'list',
          uiPayload: {
            items: matches.map((m) => ({
              id: m.id,
              label: m.nome,
              sublabel: m.nif ? `NIF ${m.nif}` : undefined,
              href: `/entidades/${m.id}`,
            })),
          },
        };
      }

      // matches.length === 0
      if (!args.createIfMissing) {
        return {
          result: {
            status: 'not_found',
            hint: `Não encontrei "${args.query}". Confirma com o utilizador se devo criar uma nova entidade — se sim, invoca de novo com createIfMissing=true.`,
          },
          renderHint: 'text',
        };
      }

      // Onda B.RACE.5: dois calls paralelos com `createIfMissing=true`
      // e a mesma `query` ambos passavam o find vazio e ambos
      // criavam stubs duplicadas. Mitigação:
      //  1. Advisory xact lock key = hashtext(tenantId::query.lower)
      //     — serializa calls para o mesmo nome no mesmo tenant.
      //  2. Re-busca depois do lock — se uma criação concorrente
      //     entretanto inseriu a entidade, devolve `found` em vez de
      //     criar duplicado.
      //
      // Lock liberta no commit. Custo: minimal (uma trip Postgres
      // adicional). Trade-off justificado pelo dano de duplicados.
      const normalizedQuery = args.query.trim().toLowerCase();
      const created = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.tenantId}::ent::${normalizedQuery}`}))`;

        const reCheck = await tx.entidade.findFirst({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            nome: { equals: args.query.trim(), mode: 'insensitive' },
          },
          select: { id: true, nome: true, nif: true },
        });
        if (reCheck) {
          return { recheck: reCheck, created: null };
        }

        const newEnt = await entidadesService.create(ctx.tenantId, ctx.userId, {
          nome: args.query.trim(),
          tipo: args.tipo as EntidadeTipo,
          nacionalidadeCambial: EntidadeNacionalidadeCambial.RESIDENTE,
          isInstituicaoFinanceira: false,
          paisResidencia: 'AO',
        } as never);
        return { recheck: null, created: newEnt };
      });

      // Se a re-check encontrou uma criação concorrente, devolve
      // como `found` em vez de fingir que criámos.
      if (created.recheck) {
        return {
          result: {
            status: 'found',
            entidadeId: created.recheck.id,
            nome: created.recheck.nome,
            nif: created.recheck.nif,
          },
          renderHint: 'text',
        };
      }
      const finalCreated = created.created!;

      return {
        result: {
          status: 'created',
          entidadeId: finalCreated.id,
          nome: finalCreated.nome,
          hint: `Criei stub "${finalCreated.nome}". O utilizador precisa de a completar depois (NIF, sector, morada).`,
        },
        renderHint: 'entity',
        uiPayload: {
          items: [
            {
              id: finalCreated.id,
              label: finalCreated.nome,
              sublabel: 'Stub — completa depois',
              href: `/entidades/${finalCreated.id}`,
            },
          ],
        },
      };
    },
  });
}
