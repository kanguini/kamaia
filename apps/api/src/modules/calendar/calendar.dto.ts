import { z } from 'zod';
import { CalendarEventType } from '@kamaia/shared-types';

export const listEventsSchema = z.object({
  startDate: z.string().datetime({ message: 'Data inicial obrigatoria' }),
  endDate: z.string().datetime({ message: 'Data final obrigatoria' }),
  type: z.nativeEnum(CalendarEventType).optional(),
  processoId: z.string().uuid().optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(1, 'Titulo obrigatorio'),
  type: z.nativeEnum(CalendarEventType),
  startAt: z.string().datetime({ message: 'Data de inicio obrigatoria' }),
  endAt: z.string().datetime({ message: 'Data de fim obrigatoria' }),
  description: z.string().optional(),
  location: z.string().optional(),
  processoId: z.string().uuid().optional(),
  allDay: z.boolean().default(false),
  reminderMinutes: z.number().int().min(0).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export type ListEventsDto = z.infer<typeof listEventsSchema>;
export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
