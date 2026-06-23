import {
  EntidadeEstadoCivil,
  EntidadeFormaJuridica,
  EntidadeNacionalidadeCambial,
  EntidadeRegimeBens,
  EntidadeTipo,
} from '@kamaia/shared-types';
import { z } from 'zod';

/**
 * Morada estruturada — mapeada para Json no DB. Esta forma facilita
 * pesquisa e exibição uniforme; rua + município + província são os
 * mínimos legais para identificar uma sede social ou domicílio.
 */
const MoradaSchema = z.object({
  rua: z.string().max(300).optional(),
  numero: z.string().max(20).optional(),
  bairro: z.string().max(100).optional(),
  municipio: z.string().max(100).optional(),
  provincia: z.string().max(100).optional(),
  codigoPostal: z.string().max(20).optional(),
  pais: z.string().length(2).default('AO').optional(),
});

/**
 * Representante legal inline — quando submetido com a entidade,
 * cria também um EntidadeContacto com isPrincipal=true.
 *
 * Para pessoa colectiva é EXIGIDO pela prática contratual angolana
 * — o documento tem de identificar quem assina em nome da empresa,
 * com cargo e BI. Para pessoa singular é opcional (e.g. procurador).
 */
const RepresentanteInlineSchema = z.object({
  nome: z.string().min(2).max(200),
  cargo: z.string().max(100).optional(),
  bi: z.string().max(30).optional(),
  nif: z.string().max(20).optional(),
  email: z.string().email().max(200).optional(),
  telefone: z.string().max(30).optional(),
  /** Procuração: documento/data que confere os poderes. */
  procuracaoRef: z.string().max(200).optional(),
});

/**
 * E.3 — Validação NIF Angola.
 *
 * Regras (estado actual):
 *  - Pessoas colectivas: 10 dígitos numéricos (5xxxxxxxxx para
 *    empresas privadas; 1xxxxxxxxx para singulares com NIF
 *    atribuído pela AGT no âmbito do contribuinte profissional/
 *    individual)
 *  - Pessoas singulares podem usar BI (regex separado) em vez de NIF
 *  - Não-residentes podem ter NIF de outro país — não forçamos
 *    formato angolano nesses casos
 *
 * Estratégia: regex permissivo de 9-15 chars alfanuméricos quando
 * `nacionalidadeCambial=NAO_RESIDENTE`; estrito 10-dígitos quando
 * RESIDENTE. Check-digit não é validada por enquanto — não há
 * algoritmo público da AGT estabilizado.
 */
const NIF_RESIDENTE_RE = /^\d{10}$/;
const NIF_NAO_RESIDENTE_RE = /^[A-Z0-9]{6,15}$/;

const EntidadeBaseObject = z.object({
  tipo: z.nativeEnum(EntidadeTipo),
  nome: z.string().min(2).max(300),
  nomeComercial: z.string().max(300).optional(),
  nif: z.string().max(20).optional(),
  numeroBI: z.string().max(30).optional(),
  matriculaRC: z.string().max(50).optional(),
  nacionalidadeCambial: z
    .nativeEnum(EntidadeNacionalidadeCambial)
    .default(EntidadeNacionalidadeCambial.RESIDENTE),
  sectorActividade: z.string().max(100).optional(),
  /**
   * E.5: flag de identificação como instituição financeira (banco,
   * seguradora, leasing). Quando true, o ComplianceEngine deve
   * activar regras específicas (e.g. BNA submissions, garantias
   * bancárias). O `sectorActividade` pode ser usado para sub-
   * classificar (BANCO_COMERCIAL, SEGURADORA, MICROFINANCAS, etc.).
   */
  isInstituicaoFinanceira: z.boolean().optional(),
  morada: MoradaSchema.optional(),
  paisResidencia: z.string().length(2).default('AO'),
  observacoes: z.string().max(2000).optional(),

  // ─── Pessoa singular ─────────────────────────────────────
  estadoCivil: z.nativeEnum(EntidadeEstadoCivil).optional(),
  regimeBens: z.nativeEnum(EntidadeRegimeBens).optional(),
  profissao: z.string().max(100).optional(),
  biEmitidoEm: z.coerce.date().optional(),
  biValidoAte: z.coerce.date().optional(),
  biEmissor: z.string().max(100).optional(),

  // ─── Pessoa colectiva ────────────────────────────────────
  formaJuridica: z.nativeEnum(EntidadeFormaJuridica).optional(),
  /** Capital social — recebemos número decimal em kwanzas e convertemos
   *  para BigInt (centavos) no service. */
  capitalSocial: z.coerce.number().min(0).optional(),
  capitalSocialMoeda: z.string().length(3).optional(),
  objectoSocial: z.string().max(4000).optional(),
  dataConstituicao: z.coerce.date().optional(),

  // ─── Representante legal inline ──────────────────────────
  /** Quando enviado, cria um EntidadeContacto com isPrincipal=true. */
  representante: RepresentanteInlineSchema.optional(),
});

/** Validação cruzada: NIF deve respeitar formato conforme nacionalidade. */
function validateNifConditional(data: {
  nif?: string;
  nacionalidadeCambial?: EntidadeNacionalidadeCambial;
}, ctx: z.RefinementCtx) {
  if (!data.nif) return;
  const cleaned = data.nif.replace(/[\s.-]/g, '').toUpperCase();
  const isResidente =
    !data.nacionalidadeCambial ||
    data.nacionalidadeCambial === EntidadeNacionalidadeCambial.RESIDENTE;
  const re = isResidente ? NIF_RESIDENTE_RE : NIF_NAO_RESIDENTE_RE;
  if (!re.test(cleaned)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nif'],
      message: isResidente
        ? 'NIF angolano deve ter exactamente 10 dígitos numéricos.'
        : 'NIF estrangeiro deve ter 6-15 chars alfanuméricos.',
    });
  }
}

/**
 * Validações cruzadas tipo↔campos:
 *  - regimeBens só faz sentido se estadoCivil=CASADO
 *  - formaJuridica + capitalSocial + objectoSocial são para colectiva
 *  - estadoCivil + profissão + dados BI são para singular
 *
 * Não bloqueamos campos "errados" (e.g. estadoCivil numa colectiva)
 * porque o utilizador pode estar a editar incrementalmente. Apenas
 * validamos coerência interna obrigatória.
 */
function validateConsistency(
  data: {
    tipo?: EntidadeTipo;
    estadoCivil?: EntidadeEstadoCivil;
    regimeBens?: EntidadeRegimeBens;
  },
  ctx: z.RefinementCtx,
) {
  if (
    data.regimeBens &&
    data.estadoCivil &&
    data.estadoCivil !== EntidadeEstadoCivil.CASADO
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['regimeBens'],
      message: 'Regime de bens só se aplica quando estado civil é CASADO.',
    });
  }
}

export const CreateEntidadeSchema = EntidadeBaseObject.superRefine(
  (data, ctx) => {
    validateNifConditional(data, ctx);
    validateConsistency(data, ctx);
  },
);
export type CreateEntidadeDto = z.infer<typeof CreateEntidadeSchema>;

export const UpdateEntidadeSchema = EntidadeBaseObject.partial().superRefine(
  (data, ctx) => {
    validateNifConditional(data, ctx);
    validateConsistency(data, ctx);
  },
);
export type UpdateEntidadeDto = z.infer<typeof UpdateEntidadeSchema>;

export const ListEntidadesQuerySchema = z.object({
  q: z.string().optional(),
  tipo: z.nativeEnum(EntidadeTipo).optional(),
  nacionalidadeCambial: z
    .nativeEnum(EntidadeNacionalidadeCambial)
    .optional(),
  sectorActividade: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListEntidadesQuery = z.infer<typeof ListEntidadesQuerySchema>;
