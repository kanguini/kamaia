import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  smsOnlyUrgent: z.boolean().optional(),
});

export const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

export const listNotificationsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(500).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
export type SubscribePushDto = z.infer<typeof subscribePushSchema>;
export type ListNotificationsDto = z.infer<typeof listNotificationsSchema>;
