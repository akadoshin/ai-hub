import { useHubStore } from '../store'
import type { Task } from '../store'
import { CheckCircle, XCircle, Loader, Clock, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRef, useState, type MouseEvent } from 'react'

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// ── Spotlight Card — glow follows cursor ──
function SpotlightCard({ children, color, active }: {
  children: React.ReactNode; color: string; active?: boolean
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
      className="relative rounded-lg overflow-hidden transition-all duration-200"
      style={{
        background: '#0a0a10',
        border: `1px solid ${opacity ? color + '30' : '#1a1a22'}`,
      }}
    >
      {/* Spotlight glow */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(250px circle at ${pos.x}px ${pos.y}px, ${color}15, transparent 60%)`,
        }}
      />
      {/* Border spotlight */}
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
      {/* Comet trail for running tasks */}
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

const statusConfig = {
  running:   { icon: <Loader size={12} className="animate-spin" />, color: '#60a5fa', label: 'RUNNING', dot: true },
  completed: { icon: <CheckCircle size={12} />, color: '#00ff88', label: 'DONE', dot: false },
  failed:    { icon: <XCircle size={12} />, color: '#f87171', label: 'FAILED', dot: false },
}

function TaskCard({ task }: { task: Task }) {
  const elapsed = fmtElapsed(
    task.status === 'running' ? Date.now() - task.startTime : task.elapsed * 1000
  )
  const cfg = statusConfig[task.status]
  const isRunning = task.status === 'running'

  return (
    <SpotlightCard color={cfg.color} active={isRunning}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#ddd] truncate font-mono">
              {task.label}
            </div>
            <div className="text-[9px] text-[#555] font-mono mt-0.5">
              {task.model.replace('anthropic/', '').replace('claude-', '')}
            </div>
          </div>
          {/* Status pill */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider shrink-0"
            style={{
              color: cfg.color,
              background: cfg.color + '10',
              boxShadow: isRunning ? `0 0 8px ${cfg.color}20` : 'none',
            }}
          >
            {cfg.dot && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: cfg.color }}
              />
            )}
            {cfg.label}
          </div>
        </div>

        {/* Last message */}
        {task.lastMessage && (
          <div className="text-[10px] text-[#666] truncate font-mono mb-2 px-2 py-1 rounded bg-[#060608]">
            {task.lastMessage}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-[#444] font-mono">
            <Clock size={9} />
            {elapsed}
          </div>
          {task.type && (
            <div className="text-[9px] text-[#333] font-mono uppercase tracking-wider">
              {task.type}
            </div>
          )}
        </div>

        {/* Running progress */}
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

export function TasksPanel({ sidebar: _sidebar }: { sidebar?: boolean }) {
  const tasks = useHubStore(s => s.tasks)
  const running = tasks.filter(t => t.status === 'running')
  const done = tasks.filter(t => t.status !== 'running')

  return (
    <div className="w-[280px] h-full bg-[#060609] border-l border-[#1a1a22] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#1a1a22] flex items-center gap-2">
        <Zap size={12} className="text-[#333]" />
        <span className="text-[10px] font-bold text-[#444] tracking-[0.15em] uppercase font-mono">
          Tasks & Sessions
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {running.length > 0 && (
            <div>
              <div className="text-[9px] text-[#60a5fa] font-bold tracking-[0.15em] uppercase mb-2 font-mono flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#60a5fa] animate-pulse" />
                Active ({running.length})
              </div>
              {running.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="mb-2">
                  <TaskCard task={t} />
                </motion.div>
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <div className="text-[9px] text-[#333] font-bold tracking-[0.15em] uppercase mb-2 mt-2 font-mono">
                Recent
              </div>
              {done.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="mb-2">
                  <TaskCard task={t} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="text-[#333] text-[10px] text-center mt-10 font-mono">
            No tasks yet
          </div>
        )}
      </div>
    </div>
  )
}
