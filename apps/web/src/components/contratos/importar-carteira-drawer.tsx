'use client'

/**
 * Importação em massa de carteira (contratos herdados).
 *
 * O cliente faz parse do CSV em memória, mostra preview e erros, e
 * depois orquestra o fluxo de lote:
 *   1. POST /importacao/lotes            → cria o lote
 *   2. POST /importacao/lotes/:id/linhas → uma linha por contrato
 *   3. POST /importacao/lotes/:id/start  → processa (cria os contratos
 *      via ContratosService.create, em REPOSITORIO, com paridade total)
 *
 * CSV esperado (cabeçalho): titulo[,numero,contraparte,valor,moeda,
 * dataAssinatura,dataTermo,descricao]. Só `titulo` é obrigatório.
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, FileText, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  onDone?: () => void
}

interface MetaRow {
  _row: number
  titulo: string
  contraparte?: string
  valor?: string
  moeda?: string
  dataAssinatura?: string
  dataTermo?: string
  descricao?: string
}

interface StartResult {
  estado?: string
  processadas?: number
  falhas?: number
  totalLinhas?: number
}

const COLUNAS = 'titulo, contraparte, valor, moeda, dataAssinatura, dataTermo, descricao'

export function ImportarCarteiraDrawer({ open, onClose, onDone }: Props) {
  const { data: session } = useSession()
  const [fileName, setFileName] = useState('')
  const [linhas, setLinhas] = useState<MetaRow[]>([])
  const [parseErros, setParseErros] = useState<Array<{ row: number; erro: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [resultado, setResultado] = useState<StartResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const reset = () => {
    setFileName('')
    setLinhas([])
    setParseErros([])
    setResultado(null)
    setErr(null)
    setProgresso('')
  }

  const onFile = async (file: File) => {
    reset()
    setFileName(file.name)
    const text = await file.text()
    const { rows, errors } = parseCsv(text)
    setLinhas(rows)
    setParseErros(errors)
  }

  const importar = async () => {
    if (!session?.accessToken || linhas.length === 0) return
    const token = session.accessToken
    setSubmitting(true)
    setErr(null)
    setResultado(null)
    try {
      setProgresso('A criar o lote…')
      const lote = await api<{ id: string }>('/importacao/lotes', {
        method: 'POST',
        token,
        body: JSON.stringify({
          nome: `Importação de carteira — ${fileName || 'CSV'}`.slice(0, 200),
        }),
      })

      for (let i = 0; i < linhas.length; i++) {
        const l = linhas[i]
        setProgresso(`A enviar contrato ${i + 1} de ${linhas.length}…`)
        await api(`/importacao/lotes/${lote.id}/linhas`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            metadataInput: {
              titulo: l.titulo,
              contraparte: l.contraparte,
              valor: l.valor,
              moeda: l.moeda,
              dataAssinatura: l.dataAssinatura,
              dataTermo: l.dataTermo,
              descricao: l.descricao,
            },
          }),
        })
      }

      setProgresso('A processar a carteira…')
      await api(`/importacao/lotes/${lote.id}/start`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      })

      // O processamento pode ser ASSÍNCRONO (BullMQ): faz polling do
      // estado do lote até um estado terminal e lê as contagens reais.
      // Em modo síncrono o lote já vem terminal à primeira leitura.
      const TERMINAIS = ['CONCLUIDO', 'CONCLUIDO_COM_ERROS', 'FALHOU', 'CANCELADO']
      let loteFinal: StartResult = {}
      for (let tentativa = 0; tentativa < 60; tentativa++) {
        const l = await api<StartResult>(`/importacao/lotes/${lote.id}`, { token })
        loteFinal = l ?? {}
        if (l?.estado && TERMINAIS.includes(l.estado)) break
        setProgresso(`A processar… (${l?.processadas ?? 0}/${l?.totalLinhas ?? linhas.length})`)
        await new Promise((r) => setTimeout(r, 1500))
      }
      setResultado(loteFinal)
      onDone?.()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro ao importar a carteira')
    } finally {
      setSubmitting(false)
      setProgresso('')
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={720}>
      <DrawerHeader
        title="Importar carteira"
        subtitle="Carrega um CSV com os contratos existentes. Entram como herdados, em repositório."
        onClose={onClose}
      />
      <DrawerBody>
        {err && <div className="ic-err">{err}</div>}

        {!resultado && (
          <>
            <div className="ic-hint">
              <FileText size={14} /> Colunas: <code>{COLUNAS}</code>. Só <strong>titulo</strong> é obrigatório.
              Valores em kwanzas (ex.: 12 500 000); datas em AAAA-MM-DD.
            </div>

            <label className="ic-drop">
              <Upload size={16} />
              <span>{fileName || 'Escolher ficheiro CSV'}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onFile(f)
                }}
              />
            </label>

            {parseErros.length > 0 && (
              <div className="ic-perr">
                <div className="ic-perr-h">
                  <AlertTriangle size={12} /> {parseErros.length} linha(s) com erro de leitura:
                </div>
                {parseErros.slice(0, 10).map((e) => (
                  <div key={e.row}>Linha {e.row}: {e.erro}</div>
                ))}
                {parseErros.length > 10 && <div>… +{parseErros.length - 10} mais</div>}
              </div>
            )}

            {linhas.length > 0 && (
              <div className="ic-preview">
                <div className="ic-preview-h">{linhas.length} contrato(s) prontos a importar</div>
                <div className="ic-table-wrap">
                  <table className="ic-table">
                    <thead>
                      <tr>
                        <th>Título</th>
                        <th>Contraparte</th>
                        <th>Valor</th>
                        <th>Termo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.slice(0, 50).map((l) => (
                        <tr key={l._row}>
                          <td>{l.titulo}</td>
                          <td>{l.contraparte ?? '—'}</td>
                          <td className="ic-num">{l.valor ?? '—'} {l.valor ? (l.moeda ?? 'AOA') : ''}</td>
                          <td>{l.dataTermo ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {linhas.length > 50 && (
                    <div className="ic-more">… +{linhas.length - 50} contratos (todos serão importados)</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {resultado && (
          <div className="ic-result">
            <div className="ic-result-big">{resultado.processadas ?? linhas.length} importados</div>
            {!!resultado.falhas && (
              <div className="ic-result-fail">{resultado.falhas} com erro</div>
            )}
            <p className="ic-result-sub">
              Os contratos entraram como <strong>herdados</strong>, em repositório. Activa cada um para o pôr em gestão.
            </p>
          </div>
        )}

        <style jsx>{`
          .ic-err { background: var(--color-danger-bg, rgba(220,38,38,0.08)); color: var(--k2-bad); padding: 10px 14px; border-radius: var(--k2-radius-sm); font-size: 13px; margin-bottom: 14px; }
          .ic-hint { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--k2-text-mute); margin-bottom: 14px; line-height: 1.5; }
          .ic-hint code { background: var(--k2-bg-elev-2); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
          .ic-drop { display: flex; align-items: center; gap: 10px; padding: 16px; border: 1px dashed var(--k2-border-strong, var(--k2-border)); border-radius: var(--k2-radius); background: var(--k2-bg-elev); cursor: pointer; color: var(--k2-text-dim); font-size: 13px; }
          .ic-drop:hover { border-color: var(--k2-accent); }
          .ic-perr { margin-top: 12px; background: var(--k2-warn-bg, rgba(180,130,20,0.1)); border: 1px solid var(--k2-border); border-radius: var(--k2-radius-sm); padding: 10px 12px; font-size: 11.5px; color: var(--k2-warn); }
          .ic-perr-h { display: flex; align-items: center; gap: 6px; font-weight: 500; margin-bottom: 4px; }
          .ic-preview { margin-top: 16px; }
          .ic-preview-h { font-size: 12px; color: var(--k2-text-dim); margin-bottom: 8px; font-weight: 500; }
          .ic-table-wrap { border: 1px solid var(--k2-border); border-radius: var(--k2-radius); overflow: hidden; }
          .ic-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          .ic-table th { text-align: left; padding: 8px 12px; background: var(--k2-bg-elev-2); color: var(--k2-text-mute); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
          .ic-table td { padding: 8px 12px; border-top: 1px solid var(--k2-border); color: var(--k2-text-dim); }
          .ic-num { font-variant-numeric: tabular-nums; }
          .ic-more { padding: 8px 12px; font-size: 11.5px; color: var(--k2-text-mute); border-top: 1px solid var(--k2-border); }
          .ic-result { text-align: center; padding: 24px 0; }
          .ic-result-big { font-size: 26px; font-weight: 500; color: var(--k2-text); }
          .ic-result-fail { font-size: 13px; color: var(--k2-warn); margin-top: 4px; }
          .ic-result-sub { font-size: 12.5px; color: var(--k2-text-mute); margin: 14px auto 0; max-width: 380px; line-height: 1.5; }
        `}</style>
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--k2-text-mute)' }}>{progresso}</div>
        {resultado ? (
          <Button type="button" onClick={() => { reset(); onClose() }}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="button" loading={submitting} disabled={linhas.length === 0} onClick={() => void importar()}>
              Importar {linhas.length || ''}
            </Button>
          </>
        )}
      </DrawerFooter>
    </Drawer>
  )
}

// ─── CSV parser ──────────────────────────────────────────────
function parseCsv(text: string): { rows: MetaRow[]; errors: Array<{ row: number; erro: string }> } {
  const rows: MetaRow[] = []
  const errors: Array<{ row: number; erro: string }> = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { rows, errors }

  const header = parseCsvLine(lines[0]).map((s) => s.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name.toLowerCase())
  const iTitulo = idx('titulo')
  const iContra = idx('contraparte')
  const iValor = idx('valor')
  const iMoeda = idx('moeda')
  const iAss = idx('dataassinatura')
  const iTermo = idx('datatermo')
  const iDesc = idx('descricao')

  if (iTitulo === -1) {
    errors.push({ row: 1, erro: 'Cabeçalho não tem coluna "titulo"' })
    return { rows, errors }
  }

  const val = (cols: string[], i: number) => (i === -1 ? '' : (cols[i] ?? '').trim())

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cols = parseCsvLine(lines[i])
    const titulo = val(cols, iTitulo)
    if (!titulo) {
      errors.push({ row: rowNum, erro: 'titulo em falta' })
      continue
    }
    rows.push({
      _row: rowNum,
      titulo,
      contraparte: val(cols, iContra) || undefined,
      valor: val(cols, iValor) || undefined,
      moeda: val(cols, iMoeda) || undefined,
      dataAssinatura: val(cols, iAss) || undefined,
      dataTermo: val(cols, iTermo) || undefined,
      descricao: val(cols, iDesc) || undefined,
    })
  }

  return { rows, errors }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuote = !inQuote
    else if (ch === ',' && !inQuote) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
