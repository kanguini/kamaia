import {
  EntidadeNacionalidadeCambial,
  EntidadeTipo,
} from '@kamaia/shared-types';
import { z } from 'zod';

export const CreateEntidadeSchema = z.object({
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
  morada: z.record(z.string(), z.unknown()).optional(),
  paisResidencia: z.string().length(2).default('AO'),
  observacoes: z.string().max(2000).optional(),
});
export type CreateEntidadeDto = z.infer<typeof CreateEntidadeSchema>;

export const UpdateEntidadeSchema = CreateEntidadeSchema.partial();
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
