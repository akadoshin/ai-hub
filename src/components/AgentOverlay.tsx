import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronRight, ChevronDown, Bot, Repeat,
  ArrowUpRight, Activity, FileText, Link2, FolderOpen,
  Loader,
} from 'lucide-react'
import type { AgentData, Connection } from '../store'

interface AgentDetailData {
  files: Record<string, string | null>
  recentMemories: { name: string; date: string; preview: string | null }[]
  sessions: any[]
  crons: any[]
  spawns: any[]
  workspaceFiles: { name: string; type: string }[]
  stats: Record<string, number>
}

interface Props {
  agent: AgentData
  connections: Connection[]
  onClose: () => void
}

export function AgentOverlay({ agent, connections, onClose }: Props) {
  const [detail, setDetail] = useState<AgentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const color = ({ active: '#00ff88', thinking: '#60a5fa', idle: '#555', error: '#f87171' } as any)[agent.status] || '#555'
  const isActive = agent.status === 'active' || agent.status === 'thinking'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agents/${agent.id}/detail`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [agent.id])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute right-4 top-4 bottom-4 w-[380px] z-50 flex flex-col rounded-xl overflow-hidden"
      style={{
        background: '#08080d',
        border: `1px solid ${color}20`,
        boxShadow: `0 0 40px #00000080, 0 0 15px ${color}08`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#1a1a22] shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-bold"
              style={{ background: `${color}10`, border: `1px solid ${color}20`, color }}>
              {agent.id === 'main' ? '⚡' : agent.label[0]}
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#eee]">{agent.label}</div>
              <div className="text-[9px] font-mono text-[#555]">agent:{agent.id}</div>
            </div>
          </div>
          <button onClick={onClose}
            className="text-[#444] hover:text-[#888] transition-colors p-1.5 rounded-lg hover:bg-[#ffffff08] border-none bg-transparent cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Pills */}
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

      {/* Metrics bar */}
      <div className="grid grid-cols-4 gap-1 p-3 border-b border-[#1a1a22] shrink-0">
        <MetricBox label="Sessions" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
        <MetricBox label="Messages" value={`~${agent.messageCount}`} />
        <MetricBox label="Links" value={`${connections.length}`} />
        <MetricBox label="Context" value={agent.contextTokens ? `${(agent.contextTokens / 1000).toFixed(0)}k` : '—'} />
      </div>

      {/* Context bar */}
      {agent.contextTokens && agent.contextTokens > 0 && (
        <div className="px-4 py-2 border-b border-[#1a1a22] shrink-0">
          <div className="h-1.5 bg-[#0f0f14] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min((agent.contextTokens / 200000) * 100, 100)}%`, background: color, opacity: 0.5 }} />
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a22 transparent' }}>
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-[#333]">
            <Loader size={14} className="animate-spin" />
            <span className="text-[10px] font-mono">Loading...</span>
          </div>
        ) : detail ? (
          <>
            {/* Workspace files */}
            <Section title="Files" count={Object.values(detail.files).filter(Boolean).length} icon={<FileText size={11} />} defaultOpen>
              <div className="space-y-1">
                {Object.entries(detail.files).map(([key, content]) => (
                  <FileCard key={key} name={`${key.toUpperCase()}.md`} content={content} color={color} />
                ))}
              </div>
            </Section>

            {/* Recent memories */}
            <Section title="Recent Memory" count={detail.recentMemories.length} icon={<Activity size={11} />}>
              {detail.recentMemories.length === 0 ? (
                <Empty>No memory files</Empty>
              ) : detail.recentMemories.map(m => (
                <FileCard key={m.name} name={m.name} content={m.preview} color="#c084fc" />
              ))}
            </Section>

            {/* Sessions */}
            <Section title="Sessions" count={detail.sessions.length} icon={<Bot size={11} />}>
              {detail.sessions.length === 0 ? (
                <Empty>No sessions</Empty>
              ) : detail.sessions.slice(0, 15).map(s => (
                <SessionRow key={s.key} session={s} />
              ))}
            </Section>

            {/* Connections */}
            <Section title="Connections" count={connections.length} icon={<Link2 size={11} />}>
              {connections.length === 0 ? (
                <Empty>No connections</Empty>
              ) : connections.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0a0a10] mb-1">
                  <div>
                    <div className="text-[10px] font-mono text-[#bbb]">{c.from} → {c.to}</div>
                    <div className="text-[8px] text-[#444] font-mono">{c.type}{c.label ? ` · ${c.label}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.active && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />}
                    <span className="text-[9px] font-mono text-[#555]">{c.taskCount}</span>
                  </div>
                </div>
              ))}
            </Section>

            {/* Workspace directory */}
            <Section title="Workspace" count={detail.workspaceFiles.length} icon={<FolderOpen size={11} />}>
              {detail.workspaceFiles.length === 0 ? (
                <Empty>Empty</Empty>
              ) : (
                <div className="columns-2 gap-1">
                  {detail.workspaceFiles.map(f => (
                    <div key={f.name} className="text-[9px] font-mono text-[#555] flex items-center gap-1 py-0.5 break-inside-avoid">
                      <span className="text-[8px]">{f.type === 'dir' ? '📁' : '📄'}</span>
                      <span className="truncate">{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : (
          <div className="text-[10px] text-[#333] font-mono text-center py-10">Failed to load</div>
        )}

        <div className="h-4" />
      </div>
    </motion.div>
  )
}

// ── File Card — expandable content preview ──
function FileCard({ name, content, color }: { name: string; content: string | null; color: string }) {
  const [open, setOpen] = useState(false)
  if (!content) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0a0a10] text-[10px] font-mono text-[#333]">
      <FileText size={9} /> {name} <span className="text-[#222] ml-auto">empty</span>
    </div>
  )

  return (
    <div className="rounded-lg bg-[#0a0a10] overflow-hidden mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#0c0c12] transition-colors border-none bg-transparent cursor-pointer"
      >
        {open ? <ChevronDown size={10} className="text-[#555]" /> : <ChevronRight size={10} className="text-[#555]" />}
        <FileText size={9} style={{ color }} />
        <span className="text-[10px] font-mono text-[#999] flex-1">{name}</span>
        <span className="text-[8px] font-mono text-[#333]">{content.length > 1000 ? `${(content.length / 1000).toFixed(1)}k` : `${content.length}b`}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <pre className="px-3 pb-3 text-[9px] font-mono text-[#666] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a22 transparent' }}>
              {content}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Session Row ──
function SessionRow({ session }: { session: any }) {
  const isRunning = session.status === 'running'
  const color = isRunning ? '#60a5fa' : session.status === 'completed' ? '#00ff88' : '#f87171'
  const typeIcon = session.type === 'cron' ? <Repeat size={8} /> : session.type === 'main' ? <Bot size={8} /> : <ArrowUpRight size={8} />

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0a0a10] mb-1">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'animate-pulse' : ''}`} style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono text-[#bbb] truncate">{session.label}</div>
        <div className="flex items-center gap-2 text-[8px] font-mono text-[#444]">
          <span className="flex items-center gap-0.5">{typeIcon} {session.type}</span>
          <span>{session.model?.replace('anthropic/', '').replace('claude-', '')}</span>
          <span>{session.lastActivity}</span>
        </div>
      </div>
    </div>
  )
}

// ── Collapsible Section ──
function Section({ title, count, icon, children, defaultOpen = false }: {
  title: string; count: number; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-[#0f0f14]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#0a0a10] transition-colors border-none bg-transparent cursor-pointer"
      >
        <span className="text-[#555]">{icon}</span>
        <span className="text-[10px] font-bold text-[#777] tracking-wider uppercase flex-1">{title}</span>
        <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{count}</span>
        {open ? <ChevronDown size={11} className="text-[#444]" /> : <ChevronRight size={11} className="text-[#444]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Micro components ──
function Pill({ children, color, glow }: { children: React.ReactNode; color: string; glow?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
      style={{ color, background: `${color}10`, boxShadow: glow ? `0 0 8px ${color}15` : 'none' }}>
      {children}
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-1">
      <div className="text-[11px] font-bold text-[#ddd] font-mono">{value}</div>
      <div className="text-[7px] text-[#444] tracking-wider uppercase">{label}</div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] text-[#333] font-mono py-3 text-center">{children}</div>
}
