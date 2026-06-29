/**
 * Adaptador CMC — Comissão do Mercado de Capitais.
 *
 * Página validada: https://www.cmc.ao/pt-pt/regulamento — HTML estático
 * (Drupal) com ~31 regulamentos, cada um um <a href> para um PDF em
 * /sites/default/files/. O título traz a referência e o assunto separados
 * por "|", ex.:
 *   "Regulamento n.º 1/26, de 13 de Abril | Comissão do Mercado de Capitais
 *    | Plano de Contas das IFNB e dos OIC"
 */

import { decodeEntities, parseDiploma, stripTags } from '../lex-ao.parse';
import { RegDoc, RegSource, anoFromDiploma } from './types';

const BASE = 'https://www.cmc.ao';
const INDEX = `${BASE}/pt-pt/regulamento`;

export const cmcSource: RegSource = {
  codigo: 'CMC',
  nome: 'Comissão do Mercado de Capitais',
  async listDocs(fetchText) {
    const html = await fetchText(INDEX);
    const docs: RegDoc[] = [];
    const seen = new Set<string>();
    const re = /<a\b[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      let url = decodeEntities(m[1]).trim();
      if (url.startsWith('/')) url = BASE + url;
      if (!/^https?:\/\//i.test(url)) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      const texto = stripTags(m[2]).replace(/\s+/g, ' ').trim();
      if (texto.length < 4) continue;

      const partes = texto
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const diploma =
        partes.length > 1 ? partes[0].slice(0, 200) : parseDiploma(texto);
      const titulo = (
        partes.length > 1 ? partes[partes.length - 1] : texto
      ).slice(0, 300);

      docs.push({
        url,
        titulo,
        diploma,
        orgao: 'Comissão do Mercado de Capitais',
        ano: anoFromDiploma(diploma),
      });
    }
    return docs;
  },
};
