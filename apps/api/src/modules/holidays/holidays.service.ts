import { Injectable } from '@nestjs/common';
import { resolveAngolaHolidays, ResolvedHoliday } from '@kamaia/shared-types';

/**
 * HolidaysService — feriados públicos angolanos.
 *
 * Não existe modelo `Holiday` no schema (Junho 2026): a lista é
 * derivada dos feriados fixos publicados em `@kamaia/shared-types`.
 * Quando for necessário suportar override por tenant ou feriados
 * móveis (Carnaval, Sexta-Feira Santa), adicionar:
 *
 *   model Holiday { tenantId, year, monthDay, name, isOverride }
 *
 * e fazer merge com `resolveAngolaHolidays(year)` aqui.
 */
@Injectable()
export class HolidaysService {
  list(year: number): ResolvedHoliday[] {
    return resolveAngolaHolidays(year);
  }

  /**
   * Placeholder para futuro override por tenant. Hoje no-op: os
   * feriados são globais e derivados de constantes.
   */
  async seedYear(_tenantId: string, year: number): Promise<ResolvedHoliday[]> {
    return this.list(year);
  }
}
