import { NotificationChannel, NotificationStatus } from '@kamaia/shared-types';
import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  status: z.nativeEnum(NotificationStatus).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;
