import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Gerador de PDF do contrato + folha de assinaturas.
 *
 * Stack:
 *  - pdfkit (puro Node, sem chromium/puppeteer)
 *  - Markdown → PDF traduzido aqui mesmo com um mini-renderer
 *    (headings, listas, parágrafos). Bold/italic ficam para v2 —
 *    PDFKit não tem inline-styled text fácil sem repor fonte por trecho.
 *
 * Estrutura do PDF:
 *  1. Capa: número, título, partes, valor, datas-chave, hash do corpo
 *  2. Corpo do contrato (markdown renderizado)
 *  3. Folha de assinaturas (uma por assinatura) com imagem do canvas,
 *     nome, cargo, método, data, IP, hash que assinou
 *  4. Rodapé em todas as páginas: "Documento gerado por Kamaia · <data>
 *     · Hash <prefixo>"
 *
 * Lei n.º 1/11 (Angola): assinatura electrónica simples (DESENHADA_BROWSER)
 * tem eficácia probatória. Hash do markdown da versão é prova de
 * integridade — qualquer alteração futura ao corpo invalida-o.
 */
@Injectable()
export class ContratoPdfService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera o buffer PDF. Caller decide o transporte (stream HTTP,
   * upload R2, attachment de email).
   */
  async gerar(tenantId: string, contratoId: string): Promise<Buffer> {
    const contrato = await this.prisma.contrato.findFirst({
      where: { id: contratoId, tenantId, deletedAt: null },
      include: {
        tipo: { select: { nome: true, codigo: true } },
        partes: {
          orderBy: { ordem: 'asc' },
          include: { entidade: { select: { nome: true, tipo: true, nif: true } } },
        },
        versoes: {
          orderBy: { ordem: 'desc' },
          take: 1,
        },
        assinaturas: {
          where: { estado: 'ASSINADA' },
          orderBy: { assinadaEm: 'asc' },
        },
        actosRegulatorios: {
          orderBy: [{ tipo: 'asc' }, { prazoLimite: 'asc' }],
        },
      },
    });

    if (!contrato) throw new NotFoundException('Contrato not found');

    const versao = contrato.versoes[0];
    const corpoMarkdown = versao?.corpoMarkdown ?? '';
    const hashCorpo = createHash('sha256')
      .update(corpoMarkdown)
      .digest('hex');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 60, bottom: 70, left: 60, right: 60 },
      info: {
        Title: contrato.titulo,
        Author: 'Kamaia CLM',
        Subject: contrato.numeroInterno,
        Keywords: 'kamaia, contrato, assinatura',
      },
    });

    // Captura output como Buffer (sem fs)
    const chunks: Buffer[] = [];
    const done: Promise<Buffer> = new Promise((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Rodapé em cada página
    const drawFooter = () => {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = doc.page.height - 40;
        doc
          .fontSize(8)
          .fillColor('#6b7280')
          .text(
            `Kamaia CLM · ${new Date().toLocaleDateString('pt-PT')} · Hash corpo: ${hashCorpo.slice(0, 16)}… · Página ${i + 1}/${range.count}`,
            60,
            bottom,
            { align: 'center', width: doc.page.width - 120 },
          );
      }
    };

    // ─── Capa ────────────────────────────────
    doc
      .fillColor('#9ca3af')
      .fontSize(9)
      .text(`CONTRATO ${contrato.numeroInterno}`, { characterSpacing: 1.6 });
    doc.moveDown(0.4);
    doc.fillColor('#0f172a').fontSize(20).text(contrato.titulo);
    if (contrato.descricao) {
      doc.moveDown(0.4);
      doc.fillColor('#475569').fontSize(11).text(contrato.descricao);
    }

    doc.moveDown(1);
    metaRow(doc, [
      ['Tipo', contrato.tipo?.nome ?? '—'],
      ['Estado', contrato.estado.replaceAll('_', ' ')],
    ]);
    metaRow(doc, [
      ['Valor', formatMoney(contrato.valor, contrato.moeda)],
      ['Lei aplicável', contrato.leiAplicavel ?? '—'],
    ]);
    metaRow(doc, [
      ['Foro', contrato.foro ?? '—'],
      ['Início vigência', formatDate(contrato.dataInicioVigencia)],
    ]);
    metaRow(doc, [
      ['Data assinatura', formatDate(contrato.dataAssinatura)],
      ['Data termo', formatDate(contrato.dataTermo)],
    ]);

    doc.moveDown(0.8);
    doc.fillColor('#9ca3af').fontSize(9).text('PARTES', { characterSpacing: 1.6 });
    doc.moveDown(0.2);
    contrato.partes.forEach((p) => {
      doc
        .fillColor('#0f172a')
        .fontSize(10)
        .text(
          `${p.entidade.nome}${p.entidade.nif ? ` (NIF ${p.entidade.nif})` : ''} — ${p.papel.replaceAll('_', ' ').toLowerCase()}`,
        );
    });

    // ─── Corpo ───────────────────────────────
    doc.addPage();
    doc.fillColor('#9ca3af').fontSize(9).text('CORPO DO CONTRATO', { characterSpacing: 1.6 });
    doc.moveDown(0.6);
    if (corpoMarkdown) {
      renderMarkdownPdf(doc, corpoMarkdown);
    } else {
      doc
        .fillColor('#6b7280')
        .fontSize(11)
        .text('(sem conteúdo redigido)');
    }

    // ─── Assinaturas ─────────────────────────
    doc.addPage();
    doc.fillColor('#9ca3af').fontSize(9).text('FOLHA DE ASSINATURAS', { characterSpacing: 1.6 });
    doc.moveDown(0.4);
    doc
      .fillColor('#475569')
      .fontSize(9)
      .text(
        `As assinaturas abaixo foram registadas ao abrigo da Lei n.º 1/11 (assinatura electrónica simples). O hash criptográfico SHA-256 do corpo do contrato no momento de cada assinatura é exibido — qualquer alteração posterior ao corpo invalida o vínculo.`,
        { align: 'justify' },
      );
    doc.moveDown(1);

    if (contrato.assinaturas.length === 0) {
      doc.fillColor('#6b7280').fontSize(11).text('Sem assinaturas registadas.');
    } else {
      contrato.assinaturas.forEach((a, i) => {
        if (i > 0) doc.moveDown(1.2);
        renderAssinaturaBlock(doc, a);
      });
    }

    // ─── Notas regulatórias (compliance) ──────────────
    // Adicionado por L.4 — o engine sugere actos regulatórios mas é
    // crítico que o PDF assinado inclua o disclaimer + lista dos
    // actos detectados para defesa em auditoria fiscal/regulatória.
    if (contrato.actosRegulatorios.length > 0) {
      doc.addPage();
      doc
        .fillColor('#9ca3af')
        .fontSize(9)
        .text('NOTAS REGULATÓRIAS (COMPLIANCE)', { characterSpacing: 1.6 });
      doc.moveDown(0.4);
      doc
        .fillColor('#475569')
        .fontSize(9)
        .text(
          'O motor de compliance do Kamaia sugere os actos regulatórios abaixo com base nas regras versionadas aplicáveis. Cada acto requer confirmação humana antes de produzir efeitos. A lei vigente à data do facto tributário (não a data presente) é a aplicável.',
          { align: 'justify' },
        );
      doc.moveDown(1);

      renderComplianceTable(doc, contrato.actosRegulatorios);
    }

    drawFooter();
    doc.end();
    return done;
  }
}

interface ActoForPdf {
  tipo: string;
  estado: string;
  prazoLimite: Date | null;
  valorLiquidar: bigint | null;
  custoEmAKZ: bigint | null;
  referenciaLegal: string | null;
  observacoes: string | null;
  detectadoAutomaticamente: boolean;
}

function renderComplianceTable(
  doc: PDFKit.PDFDocument,
  actos: ActoForPdf[],
) {
  for (const a of actos) {
    const startY = doc.y;
    if (startY > doc.page.height - 150) {
      doc.addPage();
    }
    doc
      .fillColor('#0f172a')
      .fontSize(11)
      .text(a.tipo.replaceAll('_', ' '));
    doc.fillColor('#475569').fontSize(9);
    const meta: string[] = [`Estado: ${a.estado.replaceAll('_', ' ').toLowerCase()}`];
    if (a.prazoLimite) meta.push(`Prazo: ${formatDatePt(a.prazoLimite)}`);
    if (a.valorLiquidar) meta.push(`Valor a liquidar: ${formatMoneyPt(a.valorLiquidar)}`);
    if (a.custoEmAKZ && a.custoEmAKZ !== a.valorLiquidar)
      meta.push(`Custo: ${formatMoneyPt(a.custoEmAKZ)}`);
    doc.text(meta.join(' · '));
    if (a.referenciaLegal) {
      doc.fillColor('#6b7280').fontSize(8).text(`Referência legal: ${a.referenciaLegal}`);
    }
    if (a.observacoes) {
      doc.fillColor('#475569').fontSize(9).text(a.observacoes);
    }
    if (a.detectadoAutomaticamente) {
      doc
        .fillColor('#9ca3af')
        .fontSize(7)
        .text('Detectado automaticamente pelo motor de compliance — confirmar.');
    }
    doc.moveDown(0.6);
    doc
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .moveTo(60, doc.y)
      .lineTo(doc.page.width - 60, doc.y)
      .stroke();
    doc.moveDown(0.4);
  }
}

function formatDatePt(d: Date): string {
  return new Date(d).toLocaleDateString('pt-PT');
}

function formatMoneyPt(v: bigint, moeda = 'AOA'): string {
  const major = Number(v) / 100;
  try {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: moeda,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${moeda}`.trim();
  }
}

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────

function metaRow(
  doc: PDFKit.PDFDocument,
  pairs: Array<[string, string]>,
) {
  const cellW = (doc.page.width - 120) / pairs.length;
  const x0 = 60;
  const y = doc.y;
  pairs.forEach(([label, value], i) => {
    const x = x0 + i * cellW;
    doc
      .fillColor('#9ca3af')
      .fontSize(7)
      .text(label.toUpperCase(), x, y, { width: cellW, characterSpacing: 1.2 });
    doc
      .fillColor('#0f172a')
      .fontSize(10)
      .text(value, x, y + 12, { width: cellW });
  });
  doc.y = y + 36;
}

/**
 * Mini Markdown → PDFKit (apenas o subset usado nos contratos).
 * Suporta headings ##/###/####, listas com `-`/`*`, listas numéricas,
 * parágrafos e linhas em branco. Bold/italic ficam plain (placeholder
 * para v2 com style-runs).
 */
function renderMarkdownPdf(doc: PDFKit.PDFDocument, md: string) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let buf: string[] = [];

  const flushPara = () => {
    if (buf.length === 0) return;
    doc
      .fillColor('#0f172a')
      .fontSize(10.5)
      .text(stripInline(buf.join(' ')), { align: 'justify', lineGap: 2 });
    doc.moveDown(0.4);
    buf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushPara();
      continue;
    }

    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    if (h) {
      flushPara();
      const level = h[1].length;
      const text = stripInline(h[2]);
      const size = level === 1 ? 16 : level === 2 ? 13 : level === 3 ? 11.5 : 11;
      doc.moveDown(0.4);
      doc.fillColor('#0f172a').fontSize(size).text(text, { underline: false });
      doc.moveDown(0.2);
      continue;
    }

    const ul = /^[-*]\s+(.+)$/.exec(line);
    if (ul) {
      flushPara();
      doc
        .fillColor('#0f172a')
        .fontSize(10.5)
        .text(`• ${stripInline(ul[1])}`, { indent: 14, lineGap: 1.5 });
      continue;
    }

    const ol = /^(\d+)\.\s+(.+)$/.exec(line);
    if (ol) {
      flushPara();
      doc
        .fillColor('#0f172a')
        .fontSize(10.5)
        .text(`${ol[1]}. ${stripInline(ol[2])}`, { indent: 14, lineGap: 1.5 });
      continue;
    }

    buf.push(line);
  }
  flushPara();
}

/** Tira markup markdown inline (**, *, `, links) reduzindo para texto puro. */
function stripInline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/g, '$1');
}

function renderAssinaturaBlock(
  doc: PDFKit.PDFDocument,
  a: {
    signatarioNome: string;
    signatarioBI: string | null;
    cargo: string | null;
    metodo: string;
    assinadaEm: Date | null;
    ipAddress: string | null;
    imagemBase64: string | null;
    hashContratoSnapshot: string;
  },
) {
  const startY = doc.y;
  const w = doc.page.width - 120;

  // Caixa
  doc
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .rect(60, startY, w, 130)
    .stroke();

  const padX = 70;
  const y = startY + 12;

  // Imagem
  if (a.imagemBase64) {
    try {
      const m = /^data:image\/[a-z]+;base64,(.+)$/.exec(a.imagemBase64);
      const b64 = m ? m[1] : a.imagemBase64;
      const img = Buffer.from(b64, 'base64');
      doc.image(img, padX, y, { fit: [180, 60] });
    } catch {
      doc
        .fillColor('#9ca3af')
        .fontSize(9)
        .text('[imagem indisponível]', padX, y);
    }
  } else {
    doc
      .fillColor('#9ca3af')
      .fontSize(9)
      .text(`[${a.metodo.replaceAll('_', ' ').toLowerCase()}]`, padX, y);
  }

  // Metadados à direita
  const metaX = padX + 200;
  const metaW = w - 200 - 20;
  let metaY = y;
  doc
    .fillColor('#0f172a')
    .fontSize(11)
    .text(a.signatarioNome, metaX, metaY, { width: metaW });
  metaY = doc.y;
  if (a.cargo) {
    doc.fillColor('#475569').fontSize(9).text(a.cargo, metaX, metaY, { width: metaW });
    metaY = doc.y;
  }
  if (a.signatarioBI) {
    doc.fillColor('#475569').fontSize(9).text(`BI/Passaporte: ${a.signatarioBI}`, metaX, metaY, { width: metaW });
    metaY = doc.y;
  }
  doc
    .fillColor('#6b7280')
    .fontSize(8)
    .text(
      `Método: ${a.metodo.replaceAll('_', ' ').toLowerCase()} · IP: ${a.ipAddress ?? '—'}`,
      metaX,
      metaY,
      { width: metaW },
    );
  metaY = doc.y;
  doc
    .fillColor('#6b7280')
    .fontSize(8)
    .text(
      `Assinada em: ${a.assinadaEm ? new Date(a.assinadaEm).toLocaleString('pt-PT') : '—'}`,
      metaX,
      metaY,
      { width: metaW },
    );

  // Hash em rodapé da caixa
  doc
    .fillColor('#94a3b8')
    .fontSize(7)
    .text(
      `Hash corpo ao assinar: ${a.hashContratoSnapshot}`,
      padX,
      startY + 110,
      { width: w - 20 },
    );

  doc.y = startY + 140;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-PT');
}

function formatMoney(v: bigint | null, moeda: string | null): string {
  if (!v) return '—';
  // Centavos → unidade
  const major = Number(v) / 100;
  try {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: moeda ?? 'AOA',
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${moeda ?? ''}`.trim();
  }
}
