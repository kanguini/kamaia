'use client'

/**
 * BulkImportDrawer — importação em massa de entidades via CSV.
 *
 * O cliente faz parse CSV em memória, mostra preview das primeiras
 * linhas, e ao confirmar envia array de entidades para
 * `POST /entidades/bulk-import`. O server valida cada linha contra
 * o Zod schema, dedup por NIF, e devolve relatório.
 *
 * CSV esperado: cabeçalho com colunas:
 *   nome,nif,tipo,nacionalidadeCambial,sectorActividade,
 *   isInstituicaoFinanceira,paisResidencia,numeroBI,matriculaRC
 *
 * Tipo: PESSOA_COLECTIVA | PESSOA_SINGULAR
 * Nacionalidade: RESIDENTE | NAO_RESIDENTE
 * isInstituicaoFinanceira: true | false | 1 | 0
 */

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { UploadCloud, FileText, AlertTriangle } from 'lucide-react'
import {
  EntidadeNacionalidadeCambial,
  EntidadeTipo,
} from '@kamaia/shared-types'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/drawer'

interface ParsedRow {
  _row: number
  nome: string
  nif?: string
  tipo: EntidadeTipo
  nacionalidadeCambial: EntidadeNacionalidadeCambial
  sectorActividade?: string
  isInstituicaoFinanceira?: boolean
  paisResidencia?: string
  numeroBI?: string
  matriculaRC?: string
}

interface ImportResult {
  criadas: number
  ignoradas: number
  falhas: Array<{ row: number; erro: string }>
  ids: string[]
}

export function BulkImportDrawer({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { data: session } = useSession()
  const [linhas, setLinhas] = useState<ParsedRow[]>([])
  const [parseErros, setParseErros] = useState<Array<{ row: number; erro: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setErr(null); setResultado(null)
    if (file.size > 2 * 1024 * 1024) {
      setErr('Ficheiro maior que 2 MB.'); return
    }
    const text = await file.text()
    const { rows, errors } = parseCsv(text)
    setLinhas(rows)
    setParseErros(errors)
  }

  const submit = async () => {
    if (!session?.accessToken || linhas.length === 0) return
    setSubmitting(true); setErr(null)
    try {
      const r = await api<ImportResult>('/entidades/bulk-import', {
        method: 'POST',
        token: session.accessToken,
        body: JSON.stringify({ linhas }),
      })
      setResultado(r)
      if (r.criadas > 0) onDone()
    } catch (e) {
      setErr((e as { error?: string })?.error ?? 'Erro a importar')
    } finally { setSubmitting(false) }
  }

  return (
    <Drawer open={open} onClose={onClose} width={680}>
      <DrawerHeader
        title="Importar entidades"
        subtitle="Carrega CSV com cabeçalho. NIFs duplicados são ignorados; linhas inválidas reportadas no fim."
        onClose={onClose}
      />
      <DrawerBody>
        {err && <div style={errBoxStyle}>{err}</div>}

        {!resultado && (
          <>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '20px 16px',
                background: 'var(--k2-bg-elev)',
                border: '1px dashed var(--k2-border-strong, var(--k2-border))',
                borderRadius: 'var(--k2-radius-sm)',
                cursor: 'pointer',
              }}
            >
              <UploadCloud size={20} color="var(--k2-text-dim)" />
              <div style={{ fontSize: 13 }}>Selecciona ficheiro CSV</div>
              <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>até 2 MB</div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
            </label>

            <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
              <strong>Cabeçalho esperado:</strong> nome, nif, tipo (PESSOA_COLECTIVA/SINGULAR),
              nacionalidadeCambial (RESIDENTE/NAO_RESIDENTE), sectorActividade,
              isInstituicaoFinanceira (true/false), paisResidencia (e.g. AO), numeroBI, matriculaRC.
            </div>

            {parseErros.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--k2-radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7f1d1d' }}>
                  <AlertTriangle size={12} /> Linhas com erros de parse ({parseErros.length}):
                </div>
                <div style={{ fontSize: 11, color: '#7f1d1d', maxHeight: 80, overflow: 'auto' }}>
                  {parseErros.slice(0, 10).map((e) => (
                    <div key={e.row}>L{e.row}: {e.erro}</div>
                  ))}
                  {parseErros.length > 10 && <div>… +{parseErros.length - 10} mais</div>}
                </div>
              </div>
            )}

            {linhas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--k2-text-dim)' }}>
                  Preview ({linhas.length} linha(s) válida(s))
                </div>
                <div style={{ maxHeight: 280, overflow: 'auto', background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)' }}>
                  {linhas.slice(0, 50).map((l) => (
                    <div key={l._row} style={{ padding: '8px 12px', borderTop: '1px solid var(--k2-border)', fontSize: 12 }}>
                      <div style={{ fontWeight: 500 }}>{l.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--k2-text-mute)' }}>
                        {l.tipo} · {l.nacionalidadeCambial}{l.nif ? ` · NIF ${l.nif}` : ''}{l.sectorActividade ? ` · ${l.sectorActividade}` : ''}
                      </div>
                    </div>
                  ))}
                  {linhas.length > 50 && <div style={{ padding: 10, fontSize: 11, color: 'var(--k2-text-mute)', textAlign: 'center' }}>… +{linhas.length - 50} restantes</div>}
                </div>
              </div>
            )}
          </>
        )}

        {resultado && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Stat label="Criadas" value={resultado.criadas} color="#16a34a" />
              <Stat label="Ignoradas (dedup NIF)" value={resultado.ignoradas} color="#d97706" />
              <Stat label="Falhas" value={resultado.falhas.length} color="#b91c1c" />
            </div>
            {resultado.falhas.length > 0 && (
              <div style={{ padding: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 'var(--k2-radius-sm)', maxHeight: 200, overflow: 'auto' }}>
                {resultado.falhas.map((f) => (
                  <div key={f.row} style={{ fontSize: 11, color: '#7f1d1d' }}>L{f.row}: {f.erro}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </DrawerBody>
      <DrawerFooter>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" type="button" onClick={onClose}>
          {resultado ? 'Fechar' : 'Cancelar'}
        </Button>
        {!resultado && (
          <Button onClick={submit} loading={submitting} disabled={linhas.length === 0} leftIcon={<FileText size={13} />}>
            Importar {linhas.length} linha(s)
          </Button>
        )}
      </DrawerFooter>
    </Drawer>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'var(--k2-bg-elev)', border: '1px solid var(--k2-border)', borderRadius: 'var(--k2-radius-sm)', padding: '10px 14px', minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--k2-text-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

// ─── CSV parser (minimalista) ───────────────────

interface ParseOut {
  rows: ParsedRow[]
  errors: Array<{ row: number; erro: string }>
}

function parseCsv(text: string): ParseOut {
  const rows: ParsedRow[] = []
  const errors: Array<{ row: number; erro: string }> = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { rows, errors }

  // Cabeçalho
  const header = parseCsvLine(lines[0]).map((s) => s.trim())
  const idx = (name: string) => header.indexOf(name)
  const iNome = idx('nome')
  const iNif = idx('nif')
  const iTipo = idx('tipo')
  const iNac = idx('nacionalidadeCambial')
  const iSec = idx('sectorActividade')
  const iIf = idx('isInstituicaoFinanceira')
  const iPais = idx('paisResidencia')
  const iBI = idx('numeroBI')
  const iRC = idx('matriculaRC')

  if (iNome === -1) {
    errors.push({ row: 1, erro: 'Cabeçalho não tem coluna "nome"' })
    return { rows, errors }
  }

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1
    const cols = parseCsvLine(lines[i])
    const nome = (cols[iNome] ?? '').trim()
    if (!nome) {
      errors.push({ row: rowNum, erro: 'nome em falta' })
      continue
    }
    const tipoRaw = (cols[iTipo] ?? 'PESSOA_COLECTIVA').trim().toUpperCase()
    if (tipoRaw !== 'PESSOA_COLECTIVA' && tipoRaw !== 'PESSOA_SINGULAR') {
      errors.push({ row: rowNum, erro: `tipo inválido "${tipoRaw}"` })
      continue
    }
    const nacRaw = (cols[iNac] ?? 'RESIDENTE').trim().toUpperCase()
    if (nacRaw !== 'RESIDENTE' && nacRaw !== 'NAO_RESIDENTE' && nacRaw !== 'NÃO_RESIDENTE') {
      errors.push({ row: rowNum, erro: `nacionalidadeCambial inválida "${nacRaw}"` })
      continue
    }
    const ifRaw = (cols[iIf] ?? '').trim().toLowerCase()
    const isIF = ifRaw === 'true' || ifRaw === '1' || ifRaw === 'sim'

    rows.push({
      _row: rowNum,
      nome,
      nif: (cols[iNif] ?? '').trim() || undefined,
      tipo: tipoRaw as EntidadeTipo,
      nacionalidadeCambial: (nacRaw === 'RESIDENTE' ? EntidadeNacionalidadeCambial.RESIDENTE : EntidadeNacionalidadeCambial.NAO_RESIDENTE),
      sectorActividade: (cols[iSec] ?? '').trim() || undefined,
      isInstituicaoFinanceira: isIF || undefined,
      paisResidencia: (cols[iPais] ?? '').trim().toUpperCase() || undefined,
      numeroBI: (cols[iBI] ?? '').trim() || undefined,
      matriculaRC: (cols[iRC] ?? '').trim() || undefined,
    })
  }

  return { rows, errors }
}

/**
 * Parser de linha CSV — suporta aspas duplas e separador vírgula.
 * Não cobre escape de aspas internas (não relevante para o nosso uso).
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

const errBoxStyle: React.CSSProperties = {
  background: 'var(--color-danger-bg)',
  color: 'var(--color-danger-text)',
  padding: '10px 14px',
  borderRadius: 'var(--k2-radius-sm)',
  fontSize: 13,
}
