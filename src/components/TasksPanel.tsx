import { useHubStore } from '../store'
import type { Task } from '../store'
import { CheckCircle, XCircle, Loader, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MovingBorder } from '../ui/moving-border'

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const statusConfig = {
  running:   { icon: <Loader size={13} className="animate-spin" />, color: '#60a5fa', label: 'Running' },
  completed: { icon: <CheckCircle size={13} />, color: '#00ff88', label: 'Done' },
  failed:    { icon: <XCircle size={13} />, color: '#f87171', label: 'Failed' },
}

function TaskCard({ task }: { task: Task }) {
  const elapsed = fmtElapsed(
    task.status === 'running' ? Date.now() - task.startTime : task.elapsed * 1000
  )
  const cfg = statusConfig[task.status]

  const card = (
    <div className="bg-[#0a0a10] border border-[#1a1a22] rounded-xl p-3 group hover:border-[#2a2a33] transition-colors"
      style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#eee] truncate max-w-[70%]">
          {task.label}
        </span>
        <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.color }}>
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
      </div>

      <div className="text-[10px] text-[#555] mb-1.5 font-mono">
        {task.model.replace('anthropic/', '')}
      </div>

      {task.lastMessage && (
        <div className="text-[11px] text-[#888] truncate mb-1.5 bg-[#060608] rounded px-1.5 py-0.5 font-mono">
          {task.lastMessage}
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-[#555]">
        <Clock size={10} />
        <span className="font-mono">{elapsed}</span>
      </div>

      {task.status === 'running' && (
        <div className="mt-1.5 h-0.5 bg-[#1a1a22] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: cfg.color }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}
    </div>
  )

  if (task.status === 'running') {
    return <MovingBorder borderColor={cfg.color} duration={4} className="bg-[#0a0a10]">{card}</MovingBorder>
  }
  return card
}

export function TasksPanel({ sidebar: _sidebar }: { sidebar?: boolean }) {
  const tasks = useHubStore(s => s.tasks)
  const running = tasks.filter(t => t.status === 'running')
  const done = tasks.filter(t => t.status !== 'running')

  return (
    <div className="w-[280px] h-full bg-[#080810] border-l border-[#1a1a22] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#1a1a22]">
        <div className="text-[11px] font-bold text-[#555] tracking-widest uppercase">
          Tasks & Sessions
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {running.length > 0 && (
            <div>
              <div className="text-[10px] text-[#444] font-bold tracking-wider uppercase mb-1.5">
                Running ({running.length})
              </div>
              {running.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mb-2"
                >
                  <TaskCard task={t} />
                </motion.div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div className="text-[10px] text-[#444] font-bold tracking-wider uppercase mb-1.5 mt-3">
                Recent
              </div>
              {done.map(t => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mb-2"
                >
                  <TaskCard task={t} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="text-[#444] text-xs text-center mt-10">
            No tasks yet
          </div>
        )}
      </div>
    </div>
  )
}
