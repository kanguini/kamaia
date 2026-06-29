/**
 * Adaptadores de reguladores: cada site oficial é uma peça isolada. Se um
 * partir (mudança de layout), os outros continuam. Os documentos dos
 * reguladores são tipicamente PDFs — guardamos metadados + link (conteúdo
 * fica null; extracção de texto de PDF é uma fase posterior).
 */

export interface RegDoc {
  url: string; // link para o documento (PDF) — chave natural única
  titulo: string;
  diploma: string;
  orgao: string;
  ano: number | null;
  publicacao?: Date | null;
  conteudo?: string | null;
}

export interface RegSource {
  /** Código curto da fonte, gravado em LegislationDocument.fonte (ex. 'CMC'). */
  codigo: string;
  nome: string;
  /** Lê o(s) índice(s) do regulador e devolve os diplomas encontrados. */
  listDocs(fetchText: (url: string) => Promise<string>): Promise<RegDoc[]>;
}

/** Ano a partir de uma referência tipo "n.º 1/26" ou "no. 5/2021". */
export function anoFromDiploma(diploma: string): number | null {
  const m = diploma.match(/n\.?\s*[ºo°.]?\s*\d+\s*[/-]\s*(\d{2,4})/i);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  if (Number.isNaN(yy)) return null;
  return yy < 100 ? 2000 + yy : yy;
}
