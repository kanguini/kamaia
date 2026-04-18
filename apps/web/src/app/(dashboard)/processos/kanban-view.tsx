'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { AlertTriangle, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { ProcessoType } from '@kamaia/shared-types'

interface WorkflowStage {
  id: string
  key: string
  label: string
  position: number
  color: string | null
  category: string | null
  allowsParallel: boolean
  isTerminal: boolean
}
interface Workflow {
  id: string
  name: string
  scope: 'PROCESSO' | 'PROJECT'
  appliesTo: string[]
  isDefault: boolean
  stages: WorkflowStage[]
}

interface KanbanProcesso {
  id: string
  processoNumber: string
  title: string
  type: string
  status: string
  stage: string | null
  priority: string
  tags: string[]
  updatedAt: string
  cliente: { id: string; name: string }
  prazos: Array<{ id: string; dueDate: string; isUrgent: boolean }>
}

const TYPE_LABELS: Record<string, string> = {
  CIVEL: 'Civel',
  LABORAL: 'Laboral',
  COMERCIAL: 'Comercial',
  CRIMINAL: 'Criminal',
  ADMINISTRATIVO: 'Admin.',
  FAMILIA: 'Familia',
  ARBITRAGEM: 'Arbitragem',
}

function DroppableColumn({
  stageId,
  label,
  children,
  count,
}: {
  stageId: string
  label: string
  children: React.ReactNode
  count: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[260px] max-w-[300px] bg-surface-raised rounded-lg border border-border',
        isOver && 'ring-2 ring-ink/20 border-ink/30',
      )}
    >
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide truncate">
          {label}
        </h3>
        <span className="text-xs font-mono text-ink-muted bg-surface px-1.5 py-0.5 rounded">
          {count}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {children}
      </div>
    </div>
  )
}

function KanbanCard({ processo }: { processo: KanbanProcesso }) {
  const hasUrgentPrazo =
    processo.prazos.length > 0 &&
    (processo.prazos[0].isUrgent ||
      new Date(processo.prazos[0].dueDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000)

  return (
    <Link
      href={`/processos/${processo.id}`}
      className={cn(
        'block bg-surface border border-border rounded-lg p-3 hover:border-ink/20 transition-colors cursor-grab active:cursor-grabbing',
        hasUrgentPrazo && 'border-l-2 border-l-red-500',
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-ink-muted/40 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{processo.title}</p>
          <p className="text-xs text-ink-muted mt-0.5 font-mono">{processo.processoNumber}</p>
          <p className="text-xs text-ink-muted mt-1 truncate">{processo.cliente.name}</p>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge variant={processo.priority.toLowerCase()}>{processo.priority}</Badge>
            {hasUrgentPrazo && (
              <span className="flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="w-3 h-3" />
              </span>
            )}
            {processo.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 bg-surface-raised text-ink-muted rounded border border-border"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function KanbanView() {
  const { data: session } = useSession()
  const toast = useToast()
  const [selectedType, setSelectedType] = useState<ProcessoType>(ProcessoType.CIVEL)
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data: grouped, loading, refetch } = useApi<Record<string, KanbanProcesso[]>>(
    `/processos/kanban?type=${selectedType}`,
    [selectedType],
  )

  // Load the gabinete's workflow for this processo type (auto-seeds on first use).
  // Stage labels come straight from DB, so adding Tréplica/Quadruplica or custom
  // parallel stages in the editor is reflected live.
  const { data: workflows } = useApi<Workflow[]>(
    `/workflows?scope=PROCESSO&appliesTo=${selectedType}`,
    [selectedType],
  )
  const workflow = workflows?.find((w) => w.isDefault) ?? workflows?.[0]
  const stages = workflow?.stages?.map((s) => s.label) ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || !session?.accessToken) return

    const processoId = active.id as string
    const newStage = over.id as string

    // Find current stage of the processo
    const currentStage = Object.entries(grouped || {}).find(([_, processos]) =>
      processos.some((p) => p.id === processoId),
    )?.[0]

    if (currentStage === newStage) return

    try {
      await api(`/processos/${processoId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage }),
        token: session.accessToken,
      })
      toast.success(`Fase alterada para "${newStage}"`)
      refetch()
    } catch {
      toast.error('Erro ao alterar fase')
    }
  }

  // Find the active processo for drag overlay
  const activeProcesso = activeId
    ? Object.values(grouped || {})
        .flat()
        .find((p) => p.id === activeId)
    : null

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(TYPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as ProcessoType)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors',
              selectedType === type
                ? 'bg-ink text-surface font-medium'
                : 'text-ink-muted hover:bg-surface-raised',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[260px] h-[300px] bg-surface-raised rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const processos = grouped?.[stage] || []
              return (
                <DroppableColumn
                  key={stage}
                  stageId={stage}
                  label={stage}
                  count={processos.length}
                >
                  {processos.map((p) => (
                    <div key={p.id} id={p.id}>
                      <KanbanCard processo={p} />
                    </div>
                  ))}
                  {processos.length === 0 && (
                    <div className="text-xs text-ink-muted text-center py-6 italic">
                      Sem processos
                    </div>
                  )}
                </DroppableColumn>
              )
            })}
          </div>

          <DragOverlay>
            {activeProcesso && <KanbanCard processo={activeProcesso} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
