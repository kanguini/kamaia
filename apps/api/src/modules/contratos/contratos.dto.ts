import {
  ContratoEstado,
  ContratoOrigem,
  MOEDAS_SUPORTADAS,
  PartePapel,
} from '@kamaia/shared-types';
import { z } from 'zod';

/**
 * Parte inline no payload de criação — evita o round-trip
 * "criar contrato → ir ao tab Partes → adicionar uma a uma" que
 * destrói o ponto da padronização automática prometida ao utilizador.
 *
 * O contrato fica utilizável imediatamente (compliance engine
 * recebe partes na primeira avaliação, drafting IA usa-as no prompt,
 * placeholders de template resolvem em `{{partes.contraparte.nome}}`).
 */
export const ContratoParteInlineSchema = z.object({
  entidadeId: z.string().uuid(),
  papel: z.nativeEnum(PartePapel),
  representanteNome: z.string().max(200).optional(),
  representanteCargo: z.string().max(100).optional(),
  representanteBI: z.string().max(30).optional(),
  ordem: z.coerce.number().int().min(0).default(0),
});
export type ContratoParteInline = z.infer<typeof ContratoParteInlineSchema>;

const CreateContratoObject = z.object({
  titulo: z.string().min(2).max(300),
  descricao: z.string().max(5000).optional(),
  tipoId: z.string().uuid(),
  carteiraId: z.string().uuid().optional(),
  parentContratoId: z.string().uuid().optional(),
  origem: z.nativeEnum(ContratoOrigem).default(ContratoOrigem.CRIADO_INTERNAMENTE),
  modoEngajamento: z.enum(['A', 'B', 'C', 'D']).optional(),

  valor: z.coerce.bigint().refine((v) => v >= 0n, 'Valor não pode ser negativo').optional(),
  moeda: z.enum(MOEDAS_SUPORTADAS).optional(),
  valorEmAKZ: z.coerce.bigint().refine((v) => v >= 0n, 'Valor não pode ser negativo').optional(),
  taxaCambio: z.coerce.number().positive().optional(),

  leiAplicavel: z.string().max(100).optional(),
  foro: z.string().max(200).optional(),

  dataAssinatura: z.coerce.date().optional(),
  dataInicioVigencia: z.coerce.date().optional(),
  dataTermo: z.coerce.date().optional(),
  renovacaoAutomatica: z.boolean().default(false),
  /**
   * Duração do ciclo de renovação tácita (em meses). Necessário se
   * `renovacaoAutomatica=true` para o motor calcular o novo termo.
   * Min 1, max 120 (10 anos é tecto razoável).
   */
  prazoRenovacaoMeses: z.coerce.number().int().min(1).max(120).optional(),
  janelaDenunciaDias: z.coerce.number().int().positive().optional(),
  prazoIndeterminado: z.boolean().default(false),

  responsavelId: z.string().uuid().optional(),

  /** Partes em-linha — opcional; alternativa ao fluxo /partes posterior. */
  partes: z.array(ContratoParteInlineSchema).max(20).optional(),

  /**
   * Permite arrancar o contrato num estado != INTAKE — usado pelo
   * caminho ① (registo de existente: REPOSITORIO ou ACTIVO) e ③
   * (template: DRAFTING). Valores permitidos limitados aos estados
   * válidos como entrada do ciclo de vida.
   */
  estadoInicial: z.enum([
    ContratoEstado.INTAKE,
    ContratoEstado.DRAFTING,
    ContratoEstado.REPOSITORIO,
    ContratoEstado.ACTIVO,
    ContratoEstado.ASSINADO,
  ]).optional(),

  /**
   * ID de Document já uploaded (e.g. PDF do contrato assinado em
   * papel) — quando presente, o service cria automaticamente uma
   * primeira ContratoVersao linkada com direccao=ASSINADO_FINAL.
   * Caminho ① do fluxo "Novo contrato".
   */
  documentoInicialId: z.string().uuid().optional(),
});

/**
 * Sanidade cruzada de datas — defesa-em-profundidade (o cliente também
 * valida). O termo não pode ser anterior ao início da vigência nem à
 * assinatura, senão a matemática de renovação/alertas fica sem sentido.
 */
function crossDateRefine(
  data: {
    dataInicioVigencia?: Date;
    dataAssinatura?: Date;
    dataTermo?: Date;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.dataInicioVigencia &&
    data.dataTermo &&
    data.dataInicioVigencia > data.dataTermo
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataTermo'],
      message: 'A data de termo não pode ser anterior ao início da vigência.',
    });
  }
  if (
    data.dataAssinatura &&
    data.dataTermo &&
    data.dataAssinatura > data.dataTermo
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataTermo'],
      message: 'A data de termo não pode ser anterior à assinatura.',
    });
  }
}

export const CreateContratoSchema =
  CreateContratoObject.superRefine(crossDateRefine);
export type CreateContratoDto = z.infer<typeof CreateContratoSchema>;

/**
 * Cria contrato a partir de um Template — clona `template.conteudo`,
 * resolve placeholders `{{partes.contraparte.nome}}`, `{{valor}}`,
 * etc. com os dados do form, persiste como primeira `ContratoVersao`.
 *
 * Aceita TODOS os campos de CreateContratoSchema + obrigatório
 * `templateId`.
 */
export const CreateFromTemplateSchema = CreateContratoObject.extend({
  templateId: z.string().uuid(),
  /** Se false, persiste o template literal sem substituição (debug). */
  preencherPlaceholders: z.boolean().default(true),
  /** Instruções extras ao utilizador no draft inicial. */
  notaDrafting: z.string().max(2000).optional(),
}).superRefine(crossDateRefine);
export type CreateFromTemplateDto = z.infer<typeof CreateFromTemplateSchema>;

export const UpdateContratoSchema =
  CreateContratoObject.partial().superRefine(crossDateRefine);
export type UpdateContratoDto = z.infer<typeof UpdateContratoSchema>;

export const TransicaoEstadoSchema = z.object({
  para: z.nativeEnum(ContratoEstado),
  motivo: z.string().max(2000).optional(),
});
export type TransicaoEstadoDto = z.infer<typeof TransicaoEstadoSchema>;

export const ListContratosQuerySchema = z.object({
  q: z.string().optional(),
  estado: z.nativeEnum(ContratoEstado).optional(),
  tipoId: z.string().uuid().optional(),
  carteiraId: z.string().uuid().optional(),
  responsavelId: z.string().uuid().optional(),
  contraparteId: z.string().uuid().optional(),
  expiraEm: z.coerce.number().int().min(0).max(365).optional(),  // dias
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  orderBy: z.enum(['createdAt', 'dataTermo', 'titulo']).default('createdAt'),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListContratosQuery = z.infer<typeof ListContratosQuerySchema>;
