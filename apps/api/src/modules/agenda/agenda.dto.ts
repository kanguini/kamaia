import { z } from 'zod';
import { AgendaEventoTipo } from '@kamaia/shared-types';

/**
 * Janela temporal para listar a agenda. `from`/`to` são instantes ISO.
 * O serviço agrega eventos próprios + datas derivadas de contratos
 * (datas-chave, actos regulatórios, obrigações) dentro da janela.
 */
export const ListAgendaQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type ListAgendaQuery = z.infer<typeof ListAgendaQuerySchema>;

export const CreateAgendaEventoSchema = z
  .object({
    titulo: z.string().min(1).max(200),
    descricao: z.string().max(5000).optional(),
    tipo: z.nativeEnum(AgendaEventoTipo).default(AgendaEventoTipo.GERAL),
    inicio: z.coerce.date(),
    fim: z.coerce.date().optional(),
    diaInteiro: z.boolean().default(false),
    local: z.string().max(200).optional(),
    cor: z.string().max(20).optional(),
    contratoId: z.string().uuid().optional(),
    entidadeId: z.string().uuid().optional(),
  })
  .refine((d) => !d.fim || d.fim >= d.inicio, {
    message: 'fim deve ser igual ou posterior a inicio',
    path: ['fim'],
  });
export type CreateAgendaEventoDto = z.infer<typeof CreateAgendaEventoSchema>;

export const UpdateAgendaEventoSchema = z
  .object({
    titulo: z.string().min(1).max(200).optional(),
    descricao: z.string().max(5000).nullable().optional(),
    tipo: z.nativeEnum(AgendaEventoTipo).optional(),
    inicio: z.coerce.date().optional(),
    fim: z.coerce.date().nullable().optional(),
    diaInteiro: z.boolean().optional(),
    local: z.string().max(200).nullable().optional(),
    cor: z.string().max(20).nullable().optional(),
    contratoId: z.string().uuid().nullable().optional(),
    entidadeId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (d) => !d.inicio || !d.fim || d.fim >= d.inicio,
    { message: 'fim deve ser igual ou posterior a inicio', path: ['fim'] },
  );
export type UpdateAgendaEventoDto = z.infer<typeof UpdateAgendaEventoSchema>;
