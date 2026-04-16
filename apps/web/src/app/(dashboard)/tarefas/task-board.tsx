'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  MoreHorizontal,
  Search,
  Calendar,
  CheckSquare,
  MessageSquare,
  GripVertical,
  Pencil,
  Trash2,
  Palette,
  X,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TaskDetailModal } from './task-detail-modal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskColumn {
  id: string
  title: string
  position: number
  color: string | null
  tasks: TaskCard[]
}

interface TaskCard {
  id: string
  title: string
  priority: string
  position: number
  labels: string[]
  dueDate: string | null
  completedAt: string | null
  assignee: { id: string; firstName: string; lastName: string } | null
  processo: { id: string; processoNumber: string; title: string } | null
  cliente: { id: string; name: string } | null
  checklist: { total: number; checked: number }
  _count?: { comments: number }
  createdBy: { firstName: string; lastName: string }
  createdAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMN_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

const PRIORITY_BORDER: Record<string, string> = {
  ALTA: 'border-l-red-500',
  MEDIA: 'border-l-amber-500',
  BAIXA: 'border-l-transparent',
  URGENTE: 'border-l-red-600',
}

const PRIORITY_LABEL: Record<string, string> = {
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa',
  URGENTE: 'danger',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })
}

// ---------------------------------------------------------------------------
// Draggable Task Card
// ---------------------------------------------------------------------------

interface CardProps {
  card: TaskCard
  onClick: () => void
  isDragOverlay?: boolean
}

function SortableCard({ card, onClick }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'task', card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-surface border border-border rounded-2xl p-3 cursor-pointer',
        'hover:border-ink/20 transition-colors',
        'border-l-[3px]',
        PRIORITY_BORDER[card.priority] || 'border-l-transparent',
        isDragging && 'opacity-30',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing shrink-0"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastar tarefa"
        >
          <GripVertical className="w-3.5 h-3.5 text-ink-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink leading-snug line-clamp-2">
            {card.title}
          </p>
        </div>
      </div>

      {/* Labels */}
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {card.labels.slice(0, 4).map((label) => (
            <span
              key={label}
              className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-surface-raised text-ink-muted border border-border"
            >
              #{label}
            </span>
          ))}
          {card.labels.length > 4 && (
            <span className="text-[10px] text-ink-muted">
              +{card.labels.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: metadata */}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {card.priority && card.priority !== 'BAIXA' && (
            <Badge variant={PRIORITY_LABEL[card.priority] || 'default'} className="text-[10px] px-1.5">
              {card.priority}
            </Badge>
          )}
          {card.processo && (
            <span className="text-[10px] text-ink-muted font-mono truncate">
              {card.processo.processoNumber}
            </span>
          )}
          {card.dueDate && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px]',
                isOverdue(card.dueDate) && !card.completedAt
                  ? 'text-red-500'
                  : 'text-ink-muted',
              )}
            >
              <Calendar className="w-3 h-3" />
              {formatShortDate(card.dueDate)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {card.checklist.total > 0 && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[10px]',
                card.checklist.checked === card.checklist.total
                  ? 'text-green-500'
                  : 'text-ink-muted',
              )}
            >
              <CheckSquare className="w-3 h-3" />
              {card.checklist.checked}/{card.checklist.total}
            </span>
          )}
          {(card._count?.comments ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-muted">
              <MessageSquare className="w-3 h-3" />
              {card._count!.comments}
            </span>
          )}
          {card.assignee && (
            <div
              className="w-6 h-6 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0"
              title={`${card.assignee.firstName} ${card.assignee.lastName}`}
            >
              <span className="text-[9px] font-semibold text-ink-muted">
                {getInitials(card.assignee.firstName, card.assignee.lastName)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CardOverlay({ card }: { card: TaskCard }) {
  return (
    <div
      className={cn(
        'bg-surface border border-ink/20 rounded-2xl p-3 shadow-xl w-[300px]',
        'border-l-[3px]',
        PRIORITY_BORDER[card.priority] || 'border-l-transparent',
      )}
    >
      <p className="text-sm font-medium text-ink leading-snug line-clamp-2">
        {card.title}
      </p>
      {card.assignee && (
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-5 h-5 rounded-full bg-surface-raised border border-border flex items-center justify-center">
            <span className="text-[8px] font-semibold text-ink-muted">
              {getInitials(card.assignee.firstName, card.assignee.lastName)}
            </span>
          </div>
          <span className="text-[10px] text-ink-muted">
            {card.assignee.firstName} {card.assignee.lastName}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable Column
// ---------------------------------------------------------------------------

interface ColumnProps {
  column: TaskColumn
  onCardClick: (card: TaskCard) => void
  onRenameColumn: (id: string, title: string) => void
  onChangeColumnColor: (id: string, color: string) => void
  onDeleteColumn: (id: string) => void
  onAddTask: (columnId: string, title: string) => void
}

function KanbanColumn({
  column,
  onCardClick,
  onRenameColumn,
  onChangeColumnColor,
  onDeleteColumn,
  onAddTask,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id },
  })

  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(column.title)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newTaskRef = useRef<HTMLInputElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Auto-focus inputs
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (addingTask) newTaskRef.current?.focus()
  }, [addingTask])

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== column.title) {
      onRenameColumn(column.id, trimmed)
    } else {
      setTitleDraft(column.title)
    }
    setEditingTitle(false)
  }

  const handleAddTask = () => {
    const trimmed = newTaskTitle.trim()
    if (trimmed) {
      onAddTask(column.id, trimmed)
      setNewTaskTitle('')
    }
    setAddingTask(false)
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-surface-raised rounded-2xl min-w-[300px] max-w-[340px] shrink-0',
        'border border-border transition-colors',
        isOver && 'border-ink/30 bg-surface-raised/80',
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        {column.color && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: column.color }}
          />
        )}
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setTitleDraft(column.title)
                setEditingTitle(false)
              }
            }}
            className="flex-1 bg-transparent text-sm font-semibold text-ink outline-none border-b border-ink/30"
          />
        ) : (
          <button
            type="button"
            className="flex-1 text-left text-sm font-semibold text-ink truncate hover:text-ink/80"
            onClick={() => {
              setTitleDraft(column.title)
              setEditingTitle(true)
            }}
            title="Clique para editar"
          >
            {column.title}
          </button>
        )}

        <span className="text-[10px] text-ink-muted bg-surface rounded px-1.5 py-0.5 font-medium tabular-nums">
          {column.tasks.length}
        </span>

        {/* Column menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:bg-surface text-ink-muted hover:text-ink transition-colors"
            aria-label="Menu da coluna"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-surface border border-border rounded-lg shadow-lg py-1">
              {showColorPicker ? (
                <div className="px-3 py-2">
                  <p className="text-xs text-ink-muted mb-2">Cor da coluna</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLUMN_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                          column.color === c
                            ? 'border-ink'
                            : 'border-transparent',
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          onChangeColumnColor(column.id, c)
                          setShowColorPicker(false)
                          setMenuOpen(false)
                        }}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-raised flex items-center gap-2"
                    onClick={() => {
                      setMenuOpen(false)
                      setEditingTitle(true)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Renomear
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-raised flex items-center gap-2"
                    onClick={() => setShowColorPicker(true)}
                  >
                    <Palette className="w-3.5 h-3.5" /> Alterar cor
                  </button>
                  <div className="border-t border-border my-1" />
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmDelete(true)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cards list */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]"
      >
        {column.tasks.map((card) => (
          <SortableCard
            key={card.id}
            card={card}
            onClick={() => onCardClick(card)}
          />
        ))}

        {column.tasks.length === 0 && !addingTask && (
          <div className="flex items-center justify-center py-8 text-xs text-ink-muted">
            Sem tarefas
          </div>
        )}
      </div>

      {/* Add task */}
      <div className="p-2 border-t border-border">
        {addingTask ? (
          <div className="space-y-2">
            <input
              ref={newTaskRef}
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask()
                if (e.key === 'Escape') {
                  setNewTaskTitle('')
                  setAddingTask(false)
                }
              }}
              placeholder="Titulo da tarefa..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-ink/20"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleAddTask}>
                Adicionar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNewTaskTitle('')
                  setAddingTask(false)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm text-ink-muted hover:text-ink hover:bg-surface rounded-lg transition-colors"
            onClick={() => setAddingTask(true)}
          >
            <Plus className="w-4 h-4" />
            Adicionar tarefa
          </button>
        )}
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDeleteColumn(column.id)
          setConfirmDelete(false)
        }}
        title="Eliminar coluna"
        description={
          column.tasks.length > 0
            ? 'Esta coluna tem tarefas. Mova-as para outra coluna antes de eliminar.'
            : `Tem a certeza que deseja eliminar a coluna "${column.title}"?`
        }
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Board
// ---------------------------------------------------------------------------

export function TaskBoard() {
  const { data: session } = useSession()
  const token = session?.accessToken as string | undefined
  const toast = useToast()

  // Data
  const {
    data: columns,
    loading,
    error,
    refetch,
  } = useApi<TaskColumn[]>('/tasks/columns')

  const [boardColumns, setBoardColumns] = useState<TaskColumn[]>([])
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null)
  const [selectedCard, setSelectedCard] = useState<TaskCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')

  // New column
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const newColumnRef = useRef<HTMLInputElement>(null)

  // Sync API data → local state
  useEffect(() => {
    if (columns) {
      setBoardColumns(
        [...columns].sort((a, b) => a.position - b.position),
      )
    }
  }, [columns])

  useEffect(() => {
    if (addingColumn) newColumnRef.current?.focus()
  }, [addingColumn])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  // ---------------------------------------------------------------------------
  // Filtered columns
  // ---------------------------------------------------------------------------

  const filteredColumns = useMemo(() => {
    return boardColumns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const matches =
            t.title.toLowerCase().includes(q) ||
            t.processo?.processoNumber.toLowerCase().includes(q) ||
            t.cliente?.name.toLowerCase().includes(q) ||
            t.labels.some((l) => l.toLowerCase().includes(q))
          if (!matches) return false
        }
        if (filterPriority && t.priority !== filterPriority) return false
        if (filterAssignee && t.assignee?.id !== filterAssignee) return false
        return true
      }),
    }))
  }, [boardColumns, searchQuery, filterPriority, filterAssignee])

  // Collect unique assignees for filter dropdown
  const allAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    boardColumns.forEach((col) =>
      col.tasks.forEach((t) => {
        if (t.assignee) {
          map.set(t.assignee.id, {
            id: t.assignee.id,
            name: `${t.assignee.firstName} ${t.assignee.lastName}`,
          })
        }
      }),
    )
    return Array.from(map.values())
  }, [boardColumns])

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === 'task') {
      setActiveCard(data.card as TaskCard)
    }
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      // Find source column
      const sourceCol = boardColumns.find((c) =>
        c.tasks.some((t) => t.id === activeId),
      )
      if (!sourceCol) return

      // Determine target column
      let targetColId: string
      if (overId.startsWith('column-')) {
        targetColId = overId.replace('column-', '')
      } else {
        const col = boardColumns.find((c) =>
          c.tasks.some((t) => t.id === overId),
        )
        if (!col) return
        targetColId = col.id
      }

      if (sourceCol.id === targetColId) return

      // Optimistic move across columns during drag
      setBoardColumns((prev) => {
        const updated = prev.map((c) => ({ ...c, tasks: [...c.tasks] }))
        const srcIdx = updated.findIndex((c) => c.id === sourceCol.id)
        const dstIdx = updated.findIndex((c) => c.id === targetColId)
        if (srcIdx === -1 || dstIdx === -1) return prev

        const taskIdx = updated[srcIdx].tasks.findIndex(
          (t) => t.id === activeId,
        )
        if (taskIdx === -1) return prev

        const [task] = updated[srcIdx].tasks.splice(taskIdx, 1)

        // Insert at position of the over card, or at end
        if (!overId.startsWith('column-')) {
          const overIdx = updated[dstIdx].tasks.findIndex(
            (t) => t.id === overId,
          )
          updated[dstIdx].tasks.splice(
            overIdx >= 0 ? overIdx : updated[dstIdx].tasks.length,
            0,
            task,
          )
        } else {
          updated[dstIdx].tasks.push(task)
        }

        return updated
      })
    },
    [boardColumns],
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCard(null)
      const { active, over } = event
      if (!over || !token) return

      const activeId = active.id as string

      // Determine the column and position where it landed
      let targetColId: string
      let position: number

      const overId = over.id as string

      if (overId.startsWith('column-')) {
        targetColId = overId.replace('column-', '')
        const col = boardColumns.find((c) => c.id === targetColId)
        position = col ? col.tasks.length : 0
      } else {
        const col = boardColumns.find((c) =>
          c.tasks.some((t) => t.id === overId),
        )
        if (!col) return
        targetColId = col.id
        const idx = col.tasks.findIndex((t) => t.id === overId)
        position = idx >= 0 ? idx : col.tasks.length
      }

      // Already handled optimistically in handleDragOver for cross-column.
      // For same-column reorder, handle here:
      setBoardColumns((prev) => {
        const updated = prev.map((c) => ({ ...c, tasks: [...c.tasks] }))
        const colIdx = updated.findIndex((c) => c.id === targetColId)
        if (colIdx === -1) return prev
        const col = updated[colIdx]
        const fromIdx = col.tasks.findIndex((t) => t.id === activeId)
        if (fromIdx === -1) return prev
        const [task] = col.tasks.splice(fromIdx, 1)
        const insertAt = Math.min(position, col.tasks.length)
        col.tasks.splice(insertAt, 0, task)
        return updated
      })

      // Persist
      try {
        await api('/tasks/' + activeId + '/move', {
          method: 'PATCH',
          body: JSON.stringify({ columnId: targetColId, position }),
          token,
        })
      } catch {
        toast.error('Erro ao mover tarefa')
        refetch()
      }
    },
    [boardColumns, token, toast, refetch],
  )

  // ---------------------------------------------------------------------------
  // Column CRUD
  // ---------------------------------------------------------------------------

  const handleAddColumn = async () => {
    const trimmed = newColumnTitle.trim()
    if (!trimmed || !token) return
    try {
      await api('/tasks/columns', {
        method: 'POST',
        body: JSON.stringify({ title: trimmed }),
        token,
      })
      setNewColumnTitle('')
      setAddingColumn(false)
      refetch()
      toast.success('Coluna criada')
    } catch {
      toast.error('Erro ao criar coluna')
    }
  }

  const handleRenameColumn = async (id: string, title: string) => {
    if (!token) return
    setBoardColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    )
    try {
      await api('/tasks/columns/' + id, {
        method: 'PUT',
        body: JSON.stringify({ title }),
        token,
      })
    } catch {
      toast.error('Erro ao renomear coluna')
      refetch()
    }
  }

  const handleChangeColumnColor = async (id: string, color: string) => {
    if (!token) return
    setBoardColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, color } : c)),
    )
    try {
      await api('/tasks/columns/' + id, {
        method: 'PUT',
        body: JSON.stringify({ color }),
        token,
      })
    } catch {
      toast.error('Erro ao alterar cor')
      refetch()
    }
  }

  const handleDeleteColumn = async (id: string) => {
    if (!token) return
    const col = boardColumns.find((c) => c.id === id)
    if (col && col.tasks.length > 0) {
      toast.warning('Mova as tarefas antes de eliminar a coluna')
      return
    }
    try {
      await api('/tasks/columns/' + id, { method: 'DELETE', token })
      setBoardColumns((prev) => prev.filter((c) => c.id !== id))
      toast.success('Coluna eliminada')
    } catch {
      toast.error('Erro ao eliminar coluna')
      refetch()
    }
  }

  // ---------------------------------------------------------------------------
  // Task CRUD (quick-add)
  // ---------------------------------------------------------------------------

  const handleAddTask = async (columnId: string, title: string) => {
    if (!token) return
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, columnId }),
        token,
      })
      refetch()
      toast.success('Tarefa criada')
    } catch {
      toast.error('Erro ao criar tarefa')
    }
  }

  // ---------------------------------------------------------------------------
  // Detail modal
  // ---------------------------------------------------------------------------

  const openDetail = (card: TaskCard) => {
    setSelectedCard(card)
    setDetailOpen(true)
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelectedCard(null)
    refetch()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
          <p className="text-sm text-ink-muted">A carregar tarefas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <Button size="sm" variant="outline" onClick={refetch}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <Input
            placeholder="Pesquisar tarefas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-ink-muted hover:text-ink"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar pesquisa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
        >
          <option value="">Prioridade</option>
          <option value="URGENTE">Urgente</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option>
          <option value="BAIXA">Baixa</option>
        </select>

        {allAssignees.length > 0 && (
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
          >
            <option value="">Responsavel</option>
            {allAssignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}

        {(searchQuery || filterPriority || filterAssignee) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearchQuery('')
              setFilterPriority('')
              setFilterAssignee('')
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-[calc(100vh-200px)] items-start">
            {filteredColumns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                onCardClick={openDetail}
                onRenameColumn={handleRenameColumn}
                onChangeColumnColor={handleChangeColumnColor}
                onDeleteColumn={handleDeleteColumn}
                onAddTask={handleAddTask}
              />
            ))}

            {/* Add column */}
            {addingColumn ? (
              <div className="min-w-[300px] max-w-[340px] shrink-0 bg-surface-raised rounded-2xl border border-border p-3 space-y-2">
                <input
                  ref={newColumnRef}
                  type="text"
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') {
                      setNewColumnTitle('')
                      setAddingColumn(false)
                    }
                  }}
                  placeholder="Nome da coluna..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-ink/20"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleAddColumn}>
                    Criar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewColumnTitle('')
                      setAddingColumn(false)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="min-w-[300px] max-w-[340px] shrink-0 flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-border text-sm text-ink-muted hover:text-ink hover:border-ink/30 transition-colors"
                onClick={() => setAddingColumn(true)}
              >
                <Plus className="w-4 h-4" />
                Adicionar coluna
              </button>
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? <CardOverlay card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail modal */}
      {selectedCard && (
        <TaskDetailModal
          open={detailOpen}
          onClose={closeDetail}
          taskId={selectedCard.id}
        />
      )}
    </div>
  )
}
