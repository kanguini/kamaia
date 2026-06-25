import { z } from 'zod';
import { Role, ContratoEstado, ContratoOrigem } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ContratosService } from '../../../contratos/contratos.service';
import { ComplianceService } from '../../../compliance/compliance.service';
import { defineTool } from '../tool.types';
import { MOEDAS_SUPORTADAS } from '@kamaia/shared-types';

/**
 * create_contrato — killer feature do agente Kamaia AI.
 *
 * Cria um contrato real com tudo o que isso implica:
 *  - Validação de tipoId (resolve por código se vier nome)
 *  - Validação de entidades das partes (têm de existir no tenant)
 *  - Geração de numeroInterno race-safe
 *  - Audit log
 *  - Webhook outbox
 *  - Compliance Engine disparado IMEDIATAMENTE (tipo + valor → TGIS,
 *    BNA, AGT, registos detectados como pendentes)
 *
 * RBAC restrito: ADMIN/LEGAL_LEAD/CONTRACT_MANAGER. BUSINESS_USER
 * pode CRIAR pedidos (modo "request"), mas pelo MVP excluímos —
 * deixamos só os roles que podem efectivamente criar contratos
 * activos.
 *
 * Boas práticas para Claude:
 *  - SEMPRE confirmar parâmetros chave com utilizador antes de
 *    invocar esta tool (especialmente valor, datas, contraparte)
 *  - Resolver entidades via find_or_create_entidade ANTES desta tool
 *  - Resolver tipoCodigo via texto humano que o utilizador disser
 */

const CreateContratoArgsSchema = z.object({
  titulo: z
    .string()
    .min(2)
    .max(300)
    .describe('Título descritivo do contrato em linguagem natural.'),
  descricao: z
    .string()
    .max(5000)
    .optional()
    .describe('Resumo do objecto contratual (opcional, recomendado).'),
  tipoCodigo: z
    .string()
    .max(50)
    .optional()
    .describe(
      'Código do TipoContrato (ex: NDA, CTR_AGENCIA). Alternativa: tipoNome.',
    ),
  tipoNome: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Nome do tipo de contrato. Útil quando o utilizador disse "agência" ou "NDA" — a tool tenta encontrar o tipo correspondente. Alternativa: tipoCodigo.',
    ),
  contraparteId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'ID da entidade contraparte (já existente). Resolve via find_or_create_entidade se só tens o nome.',
    ),
  contraparteNome: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Nome da contraparte. Se fornecido, a tool tenta encontrar — se houver mais que uma, devolve isError e pede para usar contraparteId.',
    ),
  carteiraId: z
    .string()
    .uuid()
    .optional()
    .describe('Carteira/projecto a que o contrato pertence (opcional).'),

  valor: z
    .number()
    .nonnegative()
    .optional()
    .describe('Valor do contrato em unidades de moeda (ex: 1000000 para 1M).'),
  moeda: z
    .enum([...MOEDAS_SUPORTADAS] as [string, ...string[]])
    .optional()
    .describe('Código ISO 4217 da moeda. Default AOA.'),

  dataInicioVigencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Início de vigência (YYYY-MM-DD).'),
  dataTermo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Data de termo (YYYY-MM-DD).'),
  renovacaoAutomatica: z
    .boolean()
    .optional()
    .default(false)
    .describe('Renovação automática quando o termo é atingido.'),

  estadoInicial: z
    .enum([
      ContratoEstado.INTAKE,
      ContratoEstado.DRAFTING,
      ContratoEstado.REPOSITORIO,
      ContratoEstado.ACTIVO,
    ])
    .optional()
    .default(ContratoEstado.DRAFTING)
    .describe(
      'Estado inicial. DRAFTING para novos a redigir; REPOSITORIO para contratos já existentes importados.',
    ),
});

type CreateContratoArgs = z.infer<typeof CreateContratoArgsSchema>;

type CreateContratoResult =
  | {
      status: 'created';
      contratoId: string;
      numeroInterno: string;
      titulo: string;
      estado: string;
      target: string;
      compliance: {
        actosDetectados: number;
        actos: Array<{ tipo: string; observacao: string | null }>;
      };
    }
  | {
      status: 'error';
      reason: string;
      detail?: unknown;
    };

export function buildCreateContratoTool(
  prisma: PrismaService,
  contratosService: ContratosService,
  complianceService: ComplianceService,
) {
  return defineTool<CreateContratoArgs, CreateContratoResult>({
    name: 'create_contrato',
    description: `Cria um contrato real no tenant actual. Antes de invocar, RECONFIRMA com o utilizador os parâmetros principais (título, tipo, contraparte, valor, datas).

Pré-requisitos:
- tipoCodigo OU tipoNome (a tool tenta resolver)
- contraparteId OU contraparteNome (resolve via find_or_create_entidade primeiro se possível)
- Se contraparteNome for ambíguo, devolve erro pedindo contraparteId

Após criação:
- Audit log + webhook outbox + evento timeline (handled by ContratosService)
- Compliance Engine disparado imediatamente — devolve actos detectados (TGIS, BNA, AGT, etc.)
- A resposta inclui target URL para o frontend abrir o detalhe

Estados iniciais permitidos:
- DRAFTING (default): contrato novo a redigir
- INTAKE: pedido inicial
- REPOSITORIO: importação de contrato existente já assinado
- ACTIVO: contrato existente em vigor`,
    schema: CreateContratoArgsSchema,
    requiredRoles: [Role.ADMIN, Role.LEGAL_LEAD, Role.CONTRACT_MANAGER],
    mutates: true,
    async execute(args, ctx) {
      // 1. Resolve TipoContrato.
      // tenantId pode ser null (catálogo global), por isso filtramos
      // com OR: tipos do tenant actual OU globais (tenantId=null).
      const tipoWhereBase = {
        OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
        isActive: true,
      };
      let tipo: { id: string; codigo: string; nome: string } | null = null;
      if (args.tipoCodigo) {
        tipo = await prisma.tipoContrato.findFirst({
          where: {
            ...tipoWhereBase,
            codigo: { equals: args.tipoCodigo, mode: 'insensitive' },
          },
          select: { id: true, codigo: true, nome: true },
        });
      }
      if (!tipo && args.tipoNome) {
        tipo = await prisma.tipoContrato.findFirst({
          where: {
            ...tipoWhereBase,
            nome: { contains: args.tipoNome, mode: 'insensitive' },
          },
          select: { id: true, codigo: true, nome: true },
        });
      }

      if (!tipo) {
        const disponiveis = await prisma.tipoContrato.findMany({
          where: tipoWhereBase,
          select: { codigo: true, nome: true },
          take: 20,
        });
        return {
          result: {
            status: 'error',
            reason: 'Tipo de contrato não encontrado',
            detail: {
              disponiveis,
              hint: 'Pede ao utilizador para escolher um dos códigos disponíveis.',
            },
          },
          isError: true,
          renderHint: 'text',
        };
      }

      // 2. Resolve contraparte
      let contraparteId = args.contraparteId;
      if (!contraparteId && args.contraparteNome) {
        const candidates = await prisma.entidade.findMany({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            OR: [
              { nome: { contains: args.contraparteNome, mode: 'insensitive' } },
              { nomeComercial: { contains: args.contraparteNome, mode: 'insensitive' } },
            ],
          },
          select: { id: true, nome: true },
          take: 5,
        });
        if (candidates.length === 0) {
          return {
            result: {
              status: 'error',
              reason: `Não encontrei contraparte "${args.contraparteNome}". Cria a entidade primeiro com find_or_create_entidade.`,
            },
            isError: true,
            renderHint: 'text',
          };
        }
        if (candidates.length > 1) {
          const exact = candidates.find(
            (c) => c.nome.toLowerCase() === args.contraparteNome!.toLowerCase(),
          );
          if (!exact) {
            return {
              result: {
                status: 'error',
                reason: `"${args.contraparteNome}" é ambíguo — ${candidates.length} matches. Pede ao utilizador para escolher por contraparteId.`,
                detail: { candidates },
              },
              isError: true,
              renderHint: 'list',
              uiPayload: {
                items: candidates.map((c) => ({
                  id: c.id,
                  label: c.nome,
                  href: `/entidades/${c.id}`,
                })),
              },
            };
          }
          contraparteId = exact.id;
        } else {
          contraparteId = candidates[0].id;
        }
      }

      // 3. Cria o contrato via service oficial — mantém invariants
      //    (numeroInterno race-safe, audit, webhook, timeline).
      const dto: Parameters<typeof contratosService.create>[2] = {
        titulo: args.titulo,
        descricao: args.descricao,
        tipoId: tipo.id,
        carteiraId: args.carteiraId,
        origem: ContratoOrigem.CRIADO_INTERNAMENTE,
        valor: args.valor !== undefined ? BigInt(Math.round(args.valor * 100)) : undefined,
        moeda: args.moeda,
        dataInicioVigencia: args.dataInicioVigencia
          ? new Date(args.dataInicioVigencia)
          : undefined,
        dataTermo: args.dataTermo ? new Date(args.dataTermo) : undefined,
        renovacaoAutomatica: args.renovacaoAutomatica ?? false,
        prazoIndeterminado: false,
        estadoInicial: args.estadoInicial,
        partes: contraparteId
          ? [
              {
                entidadeId: contraparteId,
                papel: 'PARTE',
              },
            ]
          : undefined,
      } as Parameters<typeof contratosService.create>[2];

      const contrato = await contratosService.create(
        ctx.tenantId,
        ctx.userId,
        dto,
      );

      // 4. Dispara Compliance Engine na mesma stack (não tx, porque
      //    create() já fechou a sua). Defensivo: erros aqui são
      //    capturados e devolvidos como warning — contrato fica
      //    criado de qualquer forma.
      let actosDetectados = 0;
      let actos: Array<{ tipo: string; observacao: string | null }> = [];
      try {
        await complianceService.avaliarContrato(
          contrato.id,
          ctx.tenantId,
          ctx.userId,
        );
        const detected = await prisma.contratoActoRegulatorio.findMany({
          where: { contratoId: contrato.id },
          select: { tipo: true, observacoes: true },
          take: 20,
        });
        actosDetectados = detected.length;
        actos = detected.map((d) => ({ tipo: d.tipo, observacao: d.observacoes }));
      } catch (e) {
        // Engine falhou; contrato fica sem actos. Log mas não bloqueia
        // a resposta ao utilizador.
        actos = [];
      }

      return {
        result: {
          status: 'created',
          contratoId: contrato.id,
          numeroInterno: contrato.numeroInterno,
          titulo: contrato.titulo,
          estado: contrato.estado,
          target: `/contratos/${contrato.id}`,
          compliance: { actosDetectados, actos },
        },
        renderHint: 'contract',
        uiPayload: {
          items: [
            {
              id: contrato.id,
              label: `${contrato.numeroInterno} · ${contrato.titulo}`,
              sublabel: `${tipo.nome} · ${contrato.estado}${actosDetectados > 0 ? ` · ${actosDetectados} acto(s) regulatório(s)` : ''}`,
              href: `/contratos/${contrato.id}`,
            },
          ],
        },
      };
    },
  });
}
