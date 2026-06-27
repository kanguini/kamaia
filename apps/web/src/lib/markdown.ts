/**
 * Kamaia — client-side markdown renderer (preview only).
 *
 * Mirror leve do renderer canónico em
 * `apps/api/src/common/markdown.ts`. NÃO é fonte de verdade — o
 * servidor é quem persiste `corpoHtml`. Aqui só renderizamos enquanto
 * o utilizador escreve, para feedback instantâneo no preview.
 *
 * Features cobertas: headings, bold, italic, code (inline + block),
 * lists, links, parágrafos, escape HTML.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Onda C.2.3: URL escape + rel noopener noreferrer.
  // Antes: `[text](url)` interpolava `$2` raw — uma URL com `"`
  // (que escapa do regex [^\s)]+) podia injectar atributos
  // adicionais ou rebentar o atributo `href`.
  // Agora: encodeURI sobre o URL captura + rel completo.
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, text: string, url: string) => {
      const safeUrl = encodeURI(url).replace(/"/g, '%22');
      return `<a href="${safeUrl}" rel="noopener noreferrer" target="_blank">${text}</a>`;
    },
  )
  // Destaque para placeholders [A COMPLETAR — ...] (audit L.4 / AUDIT.13).
  // Classe (não estilo inline) para respeitar o tema dark/light.
  out = out.replace(
    /\[A COMPLETAR[^\]]*\]/g,
    (match) => `<span class="md-todo">${match}</span>`,
  )
  return out
}

export function renderMarkdownPreview(markdown: string): string {
  const lines = (markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let inCodeBlock = false
  let codeLang = ''
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let paraBuf: string[] = []

  const flushPara = () => {
    if (paraBuf.length === 0) return
    out.push(`<p>${renderInline(paraBuf.join(' '))}</p>`)
    paraBuf = []
  }
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        out.push(
          `<pre><code${codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : ''}>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
        )
        inCodeBlock = false
        codeLang = ''
        codeBuf = []
      } else {
        flushPara()
        closeList()
        inCodeBlock = true
        codeLang = line.slice(3).trim()
      }
      continue
    }
    if (inCodeBlock) {
      codeBuf.push(raw)
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushPara()
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const ul = /^[-*]\s+(.+)$/.exec(line)
    if (ul) {
      flushPara()
      if (listType !== 'ul') {
        closeList()
        listType = 'ul'
        out.push('<ul>')
      }
      out.push(`<li>${renderInline(ul[1])}</li>`)
      continue
    }
    const ol = /^\d+\.\s+(.+)$/.exec(line)
    if (ol) {
      flushPara()
      if (listType !== 'ol') {
        closeList()
        listType = 'ol'
        out.push('<ol>')
      }
      out.push(`<li>${renderInline(ol[1])}</li>`)
      continue
    }

    if (line === '') {
      flushPara()
      closeList()
      continue
    }

    closeList()
    paraBuf.push(line)
  }
  flushPara()
  closeList()
  if (inCodeBlock) {
    out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }

  return out.join('\n')
}
