/**
 * Markdown → HTML render leve.
 *
 * Sem dependência externa (sem `marked`, `markdown-it`, etc) — o set
 * de features que o editor de contratos precisa é pequeno e estável:
 *
 *   - Headings (# ## ### #### ##### ######)
 *   - Bold (**)
 *   - Italic (*)
 *   - Lists (- ou 1.)
 *   - Code blocks (```), inline code (`)
 *   - Links [text](url)
 *   - Linhas em branco → parágrafos
 *   - Escape HTML em todas as inserções
 *
 * Para features avançadas (tabelas, footnotes, anchors automáticos)
 * vamos adicionar uma dep dedicada quando justificar — hoje o foco é
 * editor + diff + render PDF.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // Code inline `code`
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links [text](url) — só http(s)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" rel="noopener" target="_blank">$1</a>',
  );
  // AUDIT.13: destaque visual para placeholders [A COMPLETAR — ...]
  // Engine de templates + IA + stub usam esta convenção para marcar
  // dados em falta. Pintar em vermelho-âmbar evita que o utilizador
  // assine um contrato com placeholders esquecidos no meio.
  // Padrão: \[A COMPLETAR.+?\] — case-sensitive porque o trigger
  // sempre vem em caixa alta.
  out = out.replace(
    /\[A COMPLETAR[^\]]*\]/g,
    (match) =>
      `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-weight:600;">${match}</span>`,
  );
  return out;
}

interface Anchor {
  /** Para anchors estáveis em comentários por cláusula. */
  id: string;
  level: number;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  anchors: Anchor[];
}

export function renderMarkdownFull(markdown: string): RenderedMarkdown {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const anchors: Anchor[] = [];

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuf: string[] = [];

  let listType: 'ul' | 'ol' | null = null;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    out.push(`<p>${renderInline(paraBuf.join(' '))}</p>`);
    paraBuf = [];
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  let counter = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();

    // Code fence
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        out.push(`<pre><code${codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeLang = '';
        codeBuf = [];
      } else {
        flushPara();
        closeList();
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuf.push(raw);
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      const text = heading[2];
      counter += 1;
      const id = `cl-${level}-${counter}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      anchors.push({ id, level, text });
      out.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      continue;
    }

    // Lista não-ordenada
    const ul = /^[-*]\s+(.+)$/.exec(line);
    if (ul) {
      flushPara();
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      continue;
    }
    // Lista ordenada
    const ol = /^\d+\.\s+(.+)$/.exec(line);
    if (ol) {
      flushPara();
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      continue;
    }

    // Linha em branco
    if (line === '') {
      flushPara();
      closeList();
      continue;
    }

    // Parágrafo
    closeList();
    paraBuf.push(line);
  }
  flushPara();
  closeList();
  if (inCodeBlock) {
    // Não fechou — fecha graciosamente
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }

  return { html: out.join('\n'), anchors };
}

export function renderMarkdownToHtml(markdown: string): string {
  return renderMarkdownFull(markdown).html;
}
