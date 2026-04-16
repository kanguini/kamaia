'use client'

import { TaskBoard } from './task-board'

export default function TarefasPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Tarefas</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            Gerir tarefas e acompanhar progresso da equipa
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <TaskBoard />
      </div>
    </div>
  )
}
