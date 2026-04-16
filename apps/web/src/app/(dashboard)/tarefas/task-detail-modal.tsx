'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Calendar,
  User,
  Flag,
  Briefcase,
  Users,
  Tag,
  CheckSquare,
  Plus,
  Trash2,
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { TagInput } from '@/components/ui/tag-input'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  id: string
  title: string
  checked: boolean
  position: number
}

interface Comment {
  id: string
  content: string
  createdAt: string
  user: { firstName: string; lastName: string }
}

interface TaskDetail {
  id: string
  title: string
  description: string | null
  priority: string
  position: number
  labels: string[]
  dueDate: string | null
  completedAt: string | null
  columnId: string
  assignee: { id: string; firstName: string; lastName: string } | null
  processo: { id: string; processoNumber: string; title: string } | null
  cliente: { id: string; name: string } | null
  checklist: { total: number; checked: number }
  checklistItems: ChecklistItem[]
  comments: Comment[]
  _count?: { comments: number }
  createdBy: { firstName: string; lastName: string }
  createdAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateInput(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().split('T')[0]
}

const PRIORITY_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TaskDetailModalProps {
  open: boolean
  onClose: () => void
  taskId: string
}

export function TaskDetailModal({ open, onClose, taskId }: TaskDetailModalProps) {
  const { data: session } = useSession()
  const token = session?.accessToken as string | undefined
  const toast = useToast()

  // Fetch full task detail
  const {
    data: task,
    loading,
    refetch,
  } = useApi<TaskDetail>(open ? `/tasks/${taskId}` : null, [taskId])

  // Local editable state
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [description, setDescription] = useState('')
  const [descDirty, setDescDirty] = useState(false)
  const [priority, setPriority] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Checklist
  const [newCheckItem, setNewCheckItem] = useState('')
  const [addingCheckItem, setAddingCheckItem] = useState(false)

  // Comments
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const checkItemInputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Sync task data to local state
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setPriority(task.priority)
      setDueDate(formatDateInput(task.dueDate))
      setLabels(task.labels || [])
      setComments(task.comments || [])
      setDescDirty(false)
    }
  }, [task])

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  useEffect(() => {
    if (addingCheckItem) checkItemInputRef.current?.focus()
  }, [addingCheckItem])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ---------------------------------------------------------------------------
  // Update task field
  // ---------------------------------------------------------------------------

  const updateField = useCallback(
    async (field: string, value: unknown) => {
      if (!token) return
      setSaving(true)
      try {
        await api(`/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: value }),
          token,
        })
      } catch {
        toast.error('Erro ao actualizar tarefa')
        refetch()
      } finally {
        setSaving(false)
      }
    },
    [taskId, token, toast, refetch],
  )

  // ---------------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------------

  const commitTitle = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task?.title) {
      updateField('title', trimmed)
    } else {
      setTitle(task?.title || '')
    }
    setEditingTitle(false)
  }

  // ---------------------------------------------------------------------------
  // Description
  // ---------------------------------------------------------------------------

  const commitDescription = () => {
    if (descDirty) {
      updateField('description', description || null)
      setDescDirty(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Priority
  // ---------------------------------------------------------------------------

  const handlePriorityChange = (val: string) => {
    setPriority(val)
    updateField('priority', val)
  }

  // ---------------------------------------------------------------------------
  // Due date
  // ---------------------------------------------------------------------------

  const handleDueDateChange = (val: string) => {
    setDueDate(val)
    updateField('dueDate', val || null)
  }

  // ---------------------------------------------------------------------------
  // Labels
  // ---------------------------------------------------------------------------

  const handleLabelsChange = (newLabels: string[]) => {
    setLabels(newLabels)
    updateField('labels', newLabels)
  }

  // ---------------------------------------------------------------------------
  // Checklist
  // ---------------------------------------------------------------------------

  const handleAddCheckItem = async () => {
    const trimmed = newCheckItem.trim()
    if (!trimmed || !token) return
    try {
      await api(`/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ title: trimmed }),
        token,
      })
      setNewCheckItem('')
      setAddingCheckItem(false)
      refetch()
    } catch {
      toast.error('Erro ao adicionar item')
    }
  }

  const handleToggleCheckItem = async (itemId: string, checked: boolean) => {
    if (!token) return
    try {
      await api(`/tasks/${taskId}/checklist/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: !checked }),
        token,
      })
      refetch()
    } catch {
      toast.error('Erro ao actualizar item')
    }
  }

  const handleDeleteCheckItem = async (itemId: string) => {
    if (!token) return
    try {
      await api(`/tasks/${taskId}/checklist/${itemId}`, {
        method: 'DELETE',
        token,
      })
      refetch()
    } catch {
      toast.error('Erro ao remover item')
    }
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  const handleAddComment = async () => {
    const trimmed = commentText.trim()
    if (!trimmed || !token) return
    setSendingComment(true)
    try {
      await api(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: trimmed }),
        token,
      })
      setCommentText('')
      refetch()
    } catch {
      toast.error('Erro ao adicionar comentario')
    } finally {
      setSendingComment(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete task
  // ---------------------------------------------------------------------------

  const handleDelete = async () => {
    if (!token) return
    setDeleting(true)
    try {
      await api(`/tasks/${taskId}`, { method: 'DELETE', token })
      toast.success('Tarefa eliminada')
      onClose()
    } catch {
      toast.error('Erro ao eliminar tarefa')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!open) return null

  const checklistItems = task?.checklistItems || []
  const checkedCount = checklistItems.filter((i) => i.checked).length
  const totalCount = checklistItems.length
  const checklistPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] bg-ink/50 motion-safe:backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
        aria-hidden="true"
      >
        {/* Modal */}
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-4xl bg-surface shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {saving && (
                <Loader2 className="w-4 h-4 animate-spin text-ink-muted shrink-0" />
              )}
              <span className="text-xs text-ink-muted">
                {task?.createdBy
                  ? `Criado por ${task.createdBy.firstName} ${task.createdBy.lastName}`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-raised rounded transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
            </div>
          ) : task ? (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col lg:flex-row">
                {/* Left column (65%) */}
                <div className="flex-1 lg:w-[65%] p-6 space-y-6 border-r border-border">
                  {/* Title */}
                  {editingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={commitTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTitle()
                        if (e.key === 'Escape') {
                          setTitle(task.title)
                          setEditingTitle(false)
                        }
                      }}
                      className="w-full text-xl font-semibold text-ink bg-transparent border-b-2 border-ink/30 outline-none pb-1 font-display"
                    />
                  ) : (
                    <h2
                      className="text-xl font-semibold text-ink cursor-pointer hover:text-ink/80 font-display"
                      onClick={() => setEditingTitle(true)}
                      title="Clique para editar"
                    >
                      {title}
                    </h2>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-ink-muted mb-1.5">
                      Descricao
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value)
                        setDescDirty(true)
                      }}
                      onBlur={commitDescription}
                      placeholder="Adicionar descricao..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-ink/20 resize-none transition-colors"
                    />
                  </div>

                  {/* Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-ink-muted" />
                        <span className="text-sm font-medium text-ink">Checklist</span>
                        {totalCount > 0 && (
                          <span className="text-xs text-ink-muted">
                            {checkedCount}/{totalCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {totalCount > 0 && (
                      <div className="w-full h-1.5 bg-surface-raised rounded-full mb-3 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            checklistPct === 100 ? 'bg-green-500' : 'bg-blue-500',
                          )}
                          style={{ width: `${checklistPct}%` }}
                        />
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-1">
                      {checklistItems
                        .sort((a, b) => a.position - b.position)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 group px-1 py-1 rounded hover:bg-surface-raised"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleCheckItem(item.id, item.checked)}
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                item.checked
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-border hover:border-ink/40',
                              )}
                              aria-label={item.checked ? 'Desmarcar' : 'Marcar'}
                            >
                              {item.checked && (
                                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                                  <path
                                    d="M2 6l3 3 5-5"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                            <span
                              className={cn(
                                'flex-1 text-sm',
                                item.checked
                                  ? 'text-ink-muted line-through'
                                  : 'text-ink',
                              )}
                            >
                              {item.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCheckItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-ink-muted hover:text-red-500 transition-opacity"
                              aria-label="Remover item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Add checklist item */}
                    {addingCheckItem ? (
                      <div className="mt-2 space-y-2">
                        <input
                          ref={checkItemInputRef}
                          type="text"
                          value={newCheckItem}
                          onChange={(e) => setNewCheckItem(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCheckItem()
                            if (e.key === 'Escape') {
                              setNewCheckItem('')
                              setAddingCheckItem(false)
                            }
                          }}
                          placeholder="Novo item..."
                          className="w-full px-3 py-1.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-ink/20"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={handleAddCheckItem}>
                            Adicionar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setNewCheckItem('')
                              setAddingCheckItem(false)
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
                        onClick={() => setAddingCheckItem(true)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar item
                      </button>
                    )}
                  </div>

                  {/* Comments */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-ink-muted" />
                      <span className="text-sm font-medium text-ink">
                        Comentarios
                      </span>
                      {comments.length > 0 && (
                        <span className="text-xs text-ink-muted">
                          ({comments.length})
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 mb-3">
                      {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-surface-raised border border-border flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[9px] font-semibold text-ink-muted">
                              {getInitials(
                                comment.user.firstName,
                                comment.user.lastName,
                              )}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-ink">
                                {comment.user.firstName} {comment.user.lastName}
                              </span>
                              <span className="text-[10px] text-ink-muted">
                                {formatDateTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap break-words">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={commentsEndRef} />
                    </div>

                    {/* New comment input */}
                    <div className="flex gap-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleAddComment()
                          }
                        }}
                        placeholder="Escrever comentario... (Ctrl+Enter para enviar)"
                        rows={2}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-ink/20 resize-none transition-colors"
                      />
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || sendingComment}
                        loading={sendingComment}
                        className="self-end"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right sidebar (35%) */}
                <div className="lg:w-[35%] p-6 space-y-5 bg-surface-raised/30">
                  {/* Priority */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                      <Flag className="w-3.5 h-3.5" />
                      Prioridade
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 transition-colors"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Data Limite
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink/20 transition-colors"
                    />
                  </div>

                  {/* Assignee (read-only for now, shows current) */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                      <User className="w-3.5 h-3.5" />
                      Responsavel
                    </label>
                    {task.assignee ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
                        <div className="w-6 h-6 rounded-full bg-surface-raised border border-border flex items-center justify-center">
                          <span className="text-[9px] font-semibold text-ink-muted">
                            {getInitials(
                              task.assignee.firstName,
                              task.assignee.lastName,
                            )}
                          </span>
                        </div>
                        <span className="text-sm text-ink">
                          {task.assignee.firstName} {task.assignee.lastName}
                        </span>
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink-muted">
                        Sem responsavel
                      </div>
                    )}
                  </div>

                  {/* Processo */}
                  {task.processo && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        Processo
                      </label>
                      <div className="px-3 py-2 rounded-lg border border-border bg-surface">
                        <p className="text-sm text-ink font-mono">
                          {task.processo.processoNumber}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5 truncate">
                          {task.processo.title}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cliente */}
                  {task.cliente && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Cliente
                      </label>
                      <div className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-ink">
                        {task.cliente.name}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-ink-muted mb-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      Etiquetas
                    </label>
                    <TagInput
                      value={labels}
                      onChange={handleLabelsChange}
                      placeholder="Adicionar etiqueta..."
                    />
                  </div>

                  {/* Metadata */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Criado por</span>
                      <span className="text-ink">
                        {task.createdBy.firstName} {task.createdBy.lastName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">Data de criacao</span>
                      <span className="text-ink">
                        {formatDateTime(task.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="pt-3 border-t border-border">
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Eliminar tarefa
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar tarefa"
        description="Tem a certeza que deseja eliminar esta tarefa? Esta accao nao pode ser revertida."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </>
  )
}
