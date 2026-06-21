import { z } from 'zod';

export const YearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type YearParam = z.infer<typeof YearParamSchema>;
