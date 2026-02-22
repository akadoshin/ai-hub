import { useState, useRef, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown } from 'lucide-react'
import type { GraphData, CronJob, SubAgent } from '../store'

interface Props {
  agentId: string
  graphData: GraphData
  onClose: () => void
}

export function GraphDetailPanel({ agentId, graphData, onClose }: Props) {
  const agent = graphData.agents.find(a => a.id === agentId)
  if (!agent) return null

  const crons = graphData.cronJobs.filter(c => c.agentId === agentId)
  const subs = graphData.subagents.filter(s => s.agentId === agentId)
  const sessions = graphData.sessions.filter(s => s.parentAgent === agentId)
  const workspace = graphData.workspaces[agentId]
  const connections = graphData.connections.filter(c => c.from === agentId || c.to === agentId)
  const color = ({ active: '#00ff88', thinking: '#60a5fa', idle: '#555', error: '#f87171' } as any)[agent.status] || '#555'
  const isActive = agent.status === 'active' || agent.status === 'thinking'

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 340, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="h-full border-l border-[#1a1a22] bg-[#060609] overflow-hidden flex flex-col shrink-0"
    >
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a22 transparent' }}>
        {/* Header */}
        <div className="p-4 border-b border-[#1a1a22]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                {agentId === 'main' ? '⚡' : agent.label[0]}
              </div>
              <div>
                <div className="text-sm font-bold text-[#eee]">{agent.label}</div>
                <div className="text-[9px] font-mono text-[#555]">agent:{agentId}</div>
              </div>
            </div>
            <button onClick={onClose}
              className="text-[#444] hover:text-[#888] transition-colors p-1 rounded hover:bg-[#ffffff06] border-none bg-transparent cursor-pointer">
              <X size={14} />
            </button>
          </div>

          {/* Status + model */}
          <div className="flex items-center gap-2 flex-wrap">
            <Pill color={color} glow={isActive}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`} style={{ background: color }} />
              {agent.status.toUpperCase()}
            </Pill>
            <Pill color="#888">
              {agent.model.replace('anthropic/', '').replace('claude-', '')}
            </Pill>
            {agent.reasoningLevel && agent.reasoningLevel !== 'off' && (
              <Pill color="#c084fc">🧠 {agent.reasoningLevel}</Pill>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="p-4 border-b border-[#0f0f14]">
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Sessions" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} sub="active / total" />
            <MetricBox label="Messages" value={`~${agent.messageCount}`} />
            <MetricBox label="Links" value={`${connections.length}`} />
          </div>
          {agent.contextTokens && agent.contextTokens > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[8px] font-mono text-[#444] mb-1">
                <span>CONTEXT WINDOW</span>
                <span>{(agent.contextTokens / 1000).toFixed(0)}k / 200k</span>
              </div>
              <div className="h-1.5 bg-[#0f0f14] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((agent.contextTokens / 200000) * 100, 100)}%`, background: color, opacity: 0.5 }} />
              </div>
            </div>
          )}
        </div>

        {/* Sections — Level 2 drill-down */}

        {/* Cron Jobs */}
        <Section title="Cron Jobs" count={crons.length} icon="⏰" defaultOpen={crons.length <= 3}>
          {crons.length === 0 ? (
            <Empty>No cron jobs</Empty>
          ) : (
            crons.map(cron => <CronCard key={cron.id} cron={cron} />)
          )}
        </Section>

        {/* Subagents */}
        <Section title="Subagents" count={subs.length} icon="🚀">
          {subs.length === 0 ? (
            <Empty>No active subagents</Empty>
          ) : (
            subs.map(sub => <SubAgentCard key={sub.id} sub={sub} />)
          )}
        </Section>

        {/* Sessions */}
        <Section title="Sessions" count={sessions.length} icon="📡">
          {sessions.length === 0 ? (
            <Empty>No sessions</Empty>
          ) : (
            sessions.slice(0, 10).map(s => (
              <div key={s.id} className="px-3 py-2 rounded-lg bg-[#0a0a10] mb-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-[#bbb] truncate max-w-[180px]">{s.label}</span>
                  <StatusDot status={s.status} />
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono text-[#444]">
                  <span>{s.type || 'session'}</span>
                  <span>{s.model.replace('anthropic/', '').replace('claude-', '')}</span>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Connections */}
        <Section title="Connections" count={connections.length} icon="🔗">
          {connections.length === 0 ? (
            <Empty>No connections</Empty>
          ) : (
            connections.map(conn => (
              <div key={conn.id} className="px-3 py-2 rounded-lg bg-[#0a0a10] mb-1.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono text-[#bbb]">
                    {conn.from} → {conn.to}
                  </div>
                  <div className="text-[9px] text-[#444]">{conn.type} {conn.label && `· ${conn.label}`}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {conn.active && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />}
                  <span className="text-[9px] font-mono text-[#555]">{conn.taskCount} tasks</span>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* Workspace */}
        <Section title="Workspace" count={workspace ? workspace.files.length + workspace.dirs.length : 0} icon="📂">
          {workspace ? (
            <div className="space-y-0.5">
              <div className="text-[9px] font-mono text-[#444] mb-2 px-1 truncate">{workspace.path}</div>
              {workspace.dirs.map(d => (
                <div key={d} className="text-[10px] font-mono text-[#666] flex items-center gap-1.5 px-1 py-0.5">
                  📁 {d}
                </div>
              ))}
              {workspace.files.map(f => (
                <div key={f} className="text-[10px] font-mono text-[#555] flex items-center gap-1.5 px-1 py-0.5">
                  📄 {f}
                </div>
              ))}
            </div>
          ) : <Empty>No workspace</Empty>}
        </Section>

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </motion.div>
  )
}

// ── Collapsible Section ──
function Section({ title, count, icon, children, defaultOpen = false }: {
  title: string; count: number; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-[#0f0f14]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#0a0a10] transition-colors border-none bg-transparent cursor-pointer"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">{title}</span>
        <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{count}</span>
        {open ? <ChevronDown size={12} className="text-[#444]" /> : <ChevronRight size={12} className="text-[#444]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Cron Card — Level 3 expandable ──
function CronCard({ cron }: { cron: CronJob }) {
  const [expanded, setExpanded] = useState(false)
  const color = cron.enabled ? '#00ff88' : '#444'
  const hasError = cron.state.consecutiveErrors > 0

  return (
    <SpotlightWrap color={color}>
      <div className="px-3 py-2.5 rounded-lg bg-[#0a0a10] mb-1.5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px]">⏰</span>
            <span className="text-[11px] font-semibold text-[#ddd] truncate">{cron.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Pill color={color} small>{cron.enabled ? 'ON' : 'OFF'}</Pill>
            {hasError && <Pill color="#f87171" small>{cron.state.consecutiveErrors} err</Pill>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#555]">
          <span>{cron.schedule}</span>
          <span>·</span>
          <span style={{ color: cron.state.lastStatus === 'ok' ? '#00ff8880' : '#f8717180' }}>{cron.state.lastStatus}</span>
          <span>·</span>
          <span>{cron.state.lastActivity}</span>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-[#1a1a22] space-y-1">
                <Row label="Duration" value={cron.state.lastDuration ? `${(cron.state.lastDuration / 1000).toFixed(1)}s` : '—'} />
                <Row label="Target" value={cron.sessionTarget} />
                <Row label="Delivery" value={cron.delivery} />
                {cron.state.nextRunAt > 0 && (
                  <Row label="Next run" value={new Date(cron.state.nextRunAt).toLocaleTimeString()} />
                )}
                {cron.payload && (
                  <div className="mt-1.5 p-2 rounded bg-[#060608] text-[8px] text-[#555] font-mono leading-relaxed max-h-16 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {cron.payload}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SpotlightWrap>
  )
}

// ── SubAgent Card ──
function SubAgentCard({ sub }: { sub: SubAgent }) {
  const isRunning = sub.status === 'running'
  const color = isRunning ? '#60a5fa' : '#444'

  return (
    <SpotlightWrap color={color}>
      <div className="px-3 py-2.5 rounded-lg bg-[#0a0a10] mb-1.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px]">🚀</span>
            <span className="text-[11px] font-semibold text-[#ddd] truncate">{sub.label || 'Subagent'}</span>
          </div>
          <Pill color={color} small glow={isRunning}>
            {isRunning && <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: color }} />}
            {sub.status.toUpperCase()}
          </Pill>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-[#555]">
          <span>{sub.model.replace('anthropic/', '').replace('claude-', '')}</span>
          <span>·</span>
          <span>{sub.lastActivity}</span>
        </div>
      </div>
    </SpotlightWrap>
  )
}

// ── Micro components ──

function SpotlightWrap({ children, color }: { children: React.ReactNode; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [show, setShow] = useState(false)
  const handleMove = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  return (
    <div ref={ref} onMouseMove={handleMove} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="relative">
      <div className="pointer-events-none absolute -inset-px rounded-lg transition-opacity duration-200"
        style={{ opacity: show ? 1 : 0, background: `radial-gradient(120px circle at ${pos.x}px ${pos.y}px, ${color}08, transparent 50%)` }} />
      {children}
    </div>
  )
}

function Pill({ children, color, small, glow }: {
  children: React.ReactNode; color: string; small?: boolean; glow?: boolean
}) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wider ${small ? 'px-1.5 py-px text-[8px]' : 'px-2 py-0.5 text-[9px]'}`}
      style={{ color, background: `${color}10`, boxShadow: glow ? `0 0 6px ${color}15` : 'none' }}>
      {children}
    </div>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0a0a10] rounded-lg p-2.5 text-center">
      <div className="text-[8px] font-mono text-[#444] tracking-wider mb-1">{label.toUpperCase()}</div>
      <div className="text-sm font-bold text-[#ddd] font-mono">{value}</div>
      {sub && <div className="text-[7px] text-[#333] mt-0.5">{sub}</div>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[9px] font-mono">
      <span className="text-[#444]">{label}</span>
      <span className="text-[#888]">{value}</span>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { running: '#60a5fa', completed: '#00ff88', failed: '#f87171' }
  const c = colors[status] || '#444'
  return (
    <div className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'animate-pulse' : ''}`} style={{ background: c }} />
      <span className="text-[8px] font-mono tracking-wider" style={{ color: c }}>{status.toUpperCase()}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-[#333] font-mono py-2 text-center">{children}</div>
}
