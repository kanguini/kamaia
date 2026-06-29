import { TarefaEstado, TarefaPrioridade } from '@kamaia/shared-types';
import { z } from 'zod';

export const CreateTarefaSchema = z.object({
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(5000).optional(),
  prioridade: z.nativeEnum(TarefaPrioridade).default(TarefaPrioridade.MEDIA),
  dataVencimento: z.coerce.date().optional(),
  responsavelId: z.string().uuid().optional(),
  contratoId: z.string().uuid().optional(),
  entidadeId: z.string().uuid().optional(),
});
export type CreateTarefaDto = z.infer<typeof CreateTarefaSchema>;

export const UpdateTarefaSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(5000).nullable().optional(),
  prioridade: z.nativeEnum(TarefaPrioridade).optional(),
  estado: z.nativeEnum(TarefaEstado).optional(),
  dataVencimento: z.coerce.date().nullable().optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  contratoId: z.string().uuid().nullable().optional(),
  entidadeId: z.string().uuid().nullable().optional(),
});
export type UpdateTarefaDto = z.infer<typeof UpdateTarefaSchema>;

export const ListTarefasQuerySchema = z.object({
  estado: z.nativeEnum(TarefaEstado).optional(),
  prioridade: z.nativeEnum(TarefaPrioridade).optional(),
  responsavelId: z.string().uuid().optional(),
  contratoId: z.string().uuid().optional(),
  /// Por defeito esconde tarefas fechadas (concluídas/canceladas).
  incluirFechadas: z.coerce.boolean().optional(),
  /// Só as com prazo já passado e ainda abertas.
  vencidas: z.coerce.boolean().optional(),
  cursor: z.string().uuid().optional(),
  // O quadro de tarefas pede limit=200 para mostrar tudo de uma vez; o
  // tecto de 100 dava 400 e o quadro ficava vazio (mesmo com tarefas
  // criadas com sucesso). 200 acomoda a vista; paginação fica para depois.
  limit: z.coerce.number().int().min(1).max(200).default(50),
  orderBy: z.enum(['dataVencimento', 'prioridade', 'createdAt']).default('dataVencimento'),
  orderDir: z.enum(['asc', 'desc']).default('asc'),
});
export type ListTarefasQuery = z.infer<typeof ListTarefasQuerySchema>;

export const TrabalhoQuerySchema = z.object({
  dias: z.coerce.number().int().min(1).max(365).default(90),
});
export type TrabalhoQuery = z.infer<typeof TrabalhoQuerySchema>;

export const AddChecklistSchema = z.object({
  texto: z.string().min(1).max(500),
});
export type AddChecklistDto = z.infer<typeof AddChecklistSchema>;

export const UpdateChecklistSchema = z.object({
  texto: z.string().min(1).max(500).optional(),
  concluido: z.boolean().optional(),
});
export type UpdateChecklistDto = z.infer<typeof UpdateChecklistSchema>;

export const AddComentarioSchema = z.object({
  texto: z.string().min(1).max(5000),
});
export type AddComentarioDto = z.infer<typeof AddComentarioSchema>;
