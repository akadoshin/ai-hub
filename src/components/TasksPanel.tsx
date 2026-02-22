import { useHubStore } from '../store'
import type { Task } from '../store'
import {
  CheckCircle, XCircle, Loader, Clock, Zap, Filter,
  Trash2, StopCircle, RotateCcw, ChevronDown, ChevronRight,
  Bot, Repeat, ArrowUpRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRef, useState, useCallback, type MouseEvent } from 'react'

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function fmtDate(ts: number) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  return isToday ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

// ── Spotlight Card ──
function SpotlightCard({ children, color, active, className = '' }: {
  children: React.ReactNode; color: string; active?: boolean; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMove = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative rounded-lg overflow-hidden transition-all duration-200 ${className}`}
      style={{
        background: '#0a0a10',
        border: `1px solid ${opacity ? color + '30' : '#1a1a22'}`,
      }}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(250px circle at ${pos.x}px ${pos.y}px, ${color}15, transparent 60%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -inset-px rounded-lg transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(200px circle at ${pos.x}px ${pos.y}px, ${color}20, transparent 50%)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />
      {active && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <motion.div
            className="absolute h-px w-20"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, top: 0, left: 0 }}
            animate={{ x: ['-80px', '300px'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute h-px w-12"
            style={{ background: `linear-gradient(90deg, transparent, ${color}80, transparent)`, bottom: 0, right: 0 }}
            animate={{ x: ['300px', '-60px'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 0.5 }}
          />
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ── Status config ──
const statusConfig = {
  running:   { icon: <Loader size={11} className="animate-spin" />, color: '#60a5fa', label: 'RUNNING' },
  completed: { icon: <CheckCircle size={11} />, color: '#00ff88', label: 'DONE' },
  failed:    { icon: <XCircle size={11} />, color: '#f87171', label: 'FAILED' },
}

type FilterType = 'all' | 'running' | 'cron' | 'spawn' | 'completed' | 'failed'

const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Zap size={9} /> },
  { id: 'running', label: 'Active', icon: <Loader size={9} /> },
  { id: 'cron', label: 'Crons', icon: <Repeat size={9} /> },
  { id: 'spawn', label: 'Spawns', icon: <ArrowUpRight size={9} /> },
  { id: 'completed', label: 'Done', icon: <CheckCircle size={9} /> },
  { id: 'failed', label: 'Failed', icon: <XCircle size={9} /> },
]

// ── Task Card ──
function TaskCard({ task, onAction }: { task: Task; onAction: (action: string, task: Task) => void }) {
  const elapsed = fmtElapsed(
    task.status === 'running' ? Date.now() - task.startTime : task.elapsed * 1000
  )
  const cfg = statusConfig[task.status]
  const isRunning = task.status === 'running'
  const [expanded, setExpanded] = useState(false)

  return (
    <SpotlightCard color={cfg.color} active={isRunning}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div
            className="flex-1 min-w-0 cursor-pointer flex items-center gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? <ChevronDown size={10} className="text-[#555] shrink-0" />
              : <ChevronRight size={10} className="text-[#555] shrink-0" />
            }
            <div className="text-[11px] font-semibold text-[#ddd] truncate font-mono">
              {task.label}
            </div>
          </div>
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wider shrink-0"
            style={{
              color: cfg.color,
              background: cfg.color + '10',
              boxShadow: isRunning ? `0 0 8px ${cfg.color}20` : 'none',
            }}
          >
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
            )}
            {cfg.label}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[9px] text-[#555] font-mono mb-1.5 pl-3.5">
          <span className="flex items-center gap-1">
            <Bot size={8} />
            {task.model.replace('anthropic/', '').replace('claude-', '')}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={8} />
            {elapsed}
          </span>
          {task.type && (
            <span className="flex items-center gap-1 uppercase tracking-wider">
              {task.type === 'cron' ? <Repeat size={8} /> : <ArrowUpRight size={8} />}
              {task.type}
            </span>
          )}
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="pl-3.5 pt-1 space-y-1.5 border-t border-[#1a1a22] mt-1.5 pt-2">
                {/* Key */}
                {task.key && (
                  <div className="text-[9px] font-mono">
                    <span className="text-[#444]">KEY </span>
                    <span className="text-[#666] break-all">{task.key}</span>
                  </div>
                )}
                {/* Agent */}
                {task.parentAgent && (
                  <div className="text-[9px] font-mono">
                    <span className="text-[#444]">AGENT </span>
                    <span className="text-[#888]">{task.parentAgent}</span>
                    {task.targetAgent && (
                      <span className="text-[#555]"> → {task.targetAgent}</span>
                    )}
                  </div>
                )}
                {/* Started */}
                {task.startTime > 0 && (
                  <div className="text-[9px] font-mono">
                    <span className="text-[#444]">STARTED </span>
                    <span className="text-[#666]">{fmtDate(task.startTime)}</span>
                  </div>
                )}
                {/* Last message */}
                {task.lastMessage && (
                  <div className="text-[9px] text-[#555] font-mono bg-[#060608] rounded px-2 py-1 truncate">
                    {task.lastMessage}
                  </div>
                )}
                {/* Actions */}
                <div className="flex items-center gap-1 pt-1">
                  {isRunning && (
                    <ActionButton
                      icon={<StopCircle size={10} />}
                      label="Stop"
                      color="#f87171"
                      onClick={() => onAction('stop', task)}
                    />
                  )}
                  {!isRunning && task.type === 'cron' && (
                    <ActionButton
                      icon={<RotateCcw size={10} />}
                      label="Re-run"
                      color="#60a5fa"
                      onClick={() => onAction('rerun', task)}
                    />
                  )}
                  <ActionButton
                    icon={<Trash2 size={10} />}
                    label="Remove"
                    color="#f87171"
                    onClick={() => onAction('remove', task)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Running progress bar */}
        {isRunning && (
          <div className="mt-2 h-px bg-[#1a1a22] rounded-full overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}
      </div>
    </SpotlightCard>
  )
}

function ActionButton({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono tracking-wider transition-all duration-150 hover:brightness-125"
      style={{
        color,
        background: color + '10',
        border: `1px solid ${color}20`,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Stats Bar ──
function StatsBar({ tasks }: { tasks: Task[] }) {
  const running = tasks.filter(t => t.status === 'running').length
  const completed = tasks.filter(t => t.status === 'completed').length
  const failed = tasks.filter(t => t.status === 'failed').length
  const crons = tasks.filter(t => t.type === 'cron').length
  const spawns = tasks.filter(t => t.type === 'spawn').length

  return (
    <div className="grid grid-cols-5 gap-1 px-3 py-2 border-b border-[#1a1a22]">
      <Stat value={running} label="Active" color="#60a5fa" />
      <Stat value={completed} label="Done" color="#00ff88" />
      <Stat value={failed} label="Failed" color="#f87171" />
      <Stat value={crons} label="Crons" color="#c084fc" />
      <Stat value={spawns} label="Spawns" color="#f59e0b" />
    </div>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[12px] font-bold font-mono" style={{ color: value > 0 ? color : '#333' }}>
        {value}
      </div>
      <div className="text-[7px] text-[#444] tracking-wider uppercase">{label}</div>
    </div>
  )
}

// ── Main Panel ──
export function TasksPanel({ sidebar: _sidebar }: { sidebar?: boolean }) {
  const tasks = useHubStore(s => s.tasks)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true
    if (filter === 'running') return t.status === 'running'
    if (filter === 'completed') return t.status === 'completed'
    if (filter === 'failed') return t.status === 'failed'
    if (filter === 'cron') return t.type === 'cron'
    if (filter === 'spawn') return t.type === 'spawn'
    return true
  })

  const running = filtered.filter(t => t.status === 'running')
  const done = filtered.filter(t => t.status !== 'running')

  const handleAction = useCallback((action: string, task: Task) => {
    // TODO: connect to API when endpoints are added
    console.log(`[TasksPanel] ${action}:`, task.id, task.label)
    if (action === 'remove') {
      // Remove from local store for now
      const store = useHubStore.getState()
      store.upsertTask({ ...task, status: 'completed' } as Task)
    }
  }, [])

  const clearCompleted = useCallback(() => {
    console.log('[TasksPanel] clear completed')
    // TODO: API call to clear
  }, [])

  return (
    <div className="h-full bg-[#060609] flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1a1a22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={11} className="text-[#333]" />
          <span className="text-[10px] font-bold text-[#444] tracking-[0.15em] uppercase font-mono">
            Tasks & Sessions
          </span>
          {tasks.length > 0 && (
            <span className="text-[9px] text-[#333] font-mono">{tasks.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 rounded transition-colors ${showFilters ? 'bg-[#1a1a22] text-[#888]' : 'text-[#333] hover:text-[#555]'}`}
          >
            <Filter size={11} />
          </button>
          {done.length > 0 && (
            <button
              onClick={clearCompleted}
              className="p-1 rounded text-[#333] hover:text-[#f87171] transition-colors"
              title="Clear completed"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsBar tasks={tasks} />

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-[#1a1a22]"
          >
            <div className="flex flex-wrap gap-1 px-3 py-2">
              {filters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono tracking-wider transition-all ${
                    filter === f.id
                      ? 'bg-[#1a1a22] text-[#ddd] border border-[#2a2a33]'
                      : 'text-[#555] hover:text-[#888] border border-transparent'
                  }`}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {running.length > 0 && (
            <div>
              <div className="text-[8px] text-[#60a5fa] font-bold tracking-[0.15em] uppercase mb-1.5 px-1 font-mono flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#60a5fa] animate-pulse" />
                Active ({running.length})
              </div>
              {running.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="mb-1.5">
                  <TaskCard task={t} onAction={handleAction} />
                </motion.div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div className="text-[8px] text-[#333] font-bold tracking-[0.15em] uppercase mb-1.5 mt-1 px-1 font-mono">
                History ({done.length})
              </div>
              {done.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mb-1.5">
                  <TaskCard task={t} onAction={handleAction} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-[#333] text-[10px] text-center mt-10 font-mono">
            {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
          </div>
        )}
      </div>
    </div>
  )
}
