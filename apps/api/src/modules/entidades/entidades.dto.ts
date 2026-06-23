import {
  EntidadeNacionalidadeCambial,
  EntidadeTipo,
} from '@kamaia/shared-types';
import { z } from 'zod';

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
  morada: z.record(z.string(), z.unknown()).optional(),
  paisResidencia: z.string().length(2).default('AO'),
  observacoes: z.string().max(2000).optional(),
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

export const CreateEntidadeSchema = EntidadeBaseObject.superRefine(
  validateNifConditional,
);
export type CreateEntidadeDto = z.infer<typeof CreateEntidadeSchema>;

export const UpdateEntidadeSchema = EntidadeBaseObject.partial().superRefine(
  validateNifConditional,
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
