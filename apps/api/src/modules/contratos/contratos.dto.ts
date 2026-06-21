import {
  ContratoEstado,
  ContratoOrigem,
  MOEDAS_SUPORTADAS,
} from '@kamaia/shared-types';
import { z } from 'zod';

export const CreateContratoSchema = z.object({
  titulo: z.string().min(2).max(300),
  descricao: z.string().max(5000).optional(),
  tipoId: z.string().uuid(),
  carteiraId: z.string().uuid().optional(),
  parentContratoId: z.string().uuid().optional(),
  origem: z.nativeEnum(ContratoOrigem).default(ContratoOrigem.CRIADO_INTERNAMENTE),
  modoEngajamento: z.enum(['A', 'B', 'C', 'D']).optional(),

  valor: z.coerce.bigint().optional(),
  moeda: z.enum(MOEDAS_SUPORTADAS).optional(),
  valorEmAKZ: z.coerce.bigint().optional(),
  taxaCambio: z.coerce.number().positive().optional(),

  leiAplicavel: z.string().max(100).optional(),
  foro: z.string().max(200).optional(),

  dataAssinatura: z.coerce.date().optional(),
  dataInicioVigencia: z.coerce.date().optional(),
  dataTermo: z.coerce.date().optional(),
  renovacaoAutomatica: z.boolean().default(false),
  janelaDenunciaDias: z.coerce.number().int().positive().optional(),
  prazoIndeterminado: z.boolean().default(false),

  responsavelId: z.string().uuid().optional(),
});
export type CreateContratoDto = z.infer<typeof CreateContratoSchema>;

export const UpdateContratoSchema = CreateContratoSchema.partial();
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
