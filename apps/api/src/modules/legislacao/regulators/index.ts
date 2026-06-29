/**
 * Registo de adaptadores de reguladores. Adicionar um novo regulador =
 * criar `<nome>.source.ts` (com o parser validado contra o HTML real) e
 * acrescentá-lo aqui. Cada um é isolado: uma falha não afecta os outros.
 *
 * Estado actual:
 *  - CMC ✅ (HTML estático, validado).
 *  - ANAC, BNA, ARSEG, INACOM — por fazer (ANAC é multi-nível; BNA/ARSEG
 *    são ASPX/JS opacos a um fetch simples). O lex.ao já agrega a maioria.
 */

import { RegSource } from './types';
import { cmcSource } from './cmc.source';

export const REG_SOURCES: RegSource[] = [cmcSource];

export type { RegDoc, RegSource } from './types';
