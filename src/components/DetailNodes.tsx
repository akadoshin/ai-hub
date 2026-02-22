import { memo, useState, useRef, useEffect, type MouseEvent } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ChevronDown, ChevronRight, Bot, Repeat,
  ArrowUpRight, Link2, FolderOpen, Activity, Clock,
} from 'lucide-react'

// ── Notify parent to re-layout when a node changes height ──
const RELAYOUT_EVENT = 'detail-node-relayout'
function emitRelayout() {
  window.dispatchEvent(new CustomEvent(RELAYOUT_EVENT))
}
export function useOnRelayout(cb: () => void) {
  useEffect(() => {
    window.addEventListener(RELAYOUT_EVENT, cb)
    return () => window.removeEventListener(RELAYOUT_EVENT, cb)
  }, [cb])
}

// ── Spotlight wrapper for all detail nodes ──
function SpotlightNode({ children, color, className = '' }: {
  children: React.ReactNode; color: string; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const handleMove = (e: MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }
  return (
    <div ref={ref} onMouseMove={handleMove} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={`relative rounded-xl overflow-hidden transition-all duration-200 ${className}`}
      style={{ background: '#0a0a10', border: `1px solid ${hovered ? color + '30' : '#1a1a22'}` }}>
      <div className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0, background: `radial-gradient(200px circle at ${pos.x}px ${pos.y}px, ${color}12, transparent 60%)` }} />
      <Handle type="target" position={Position.Left} style={{ background: color + '40', border: 'none', width: 5, height: 5 }} />
      <Handle type="source" position={Position.Right} style={{ background: color + '40', border: 'none', width: 5, height: 5 }} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

// ── File Node ──
function FileNodeComponent({ data, id }: NodeProps) {
  const { name, content, color } = data as any
  const [open, setOpen] = useState(false)
  const hasContent = !!content
  const reactFlow = useReactFlow()

  const toggle = () => {
    if (!hasContent) return
    const willOpen = !open
    setOpen(willOpen)
    // After render, measure and push siblings down
    requestAnimationFrame(() => {
      emitRelayout()
    })
  }

  return (
    <SpotlightNode color={color || '#888'}>
      <div className="cursor-pointer" onClick={toggle} style={{ minWidth: 200, maxWidth: 320 }}>
        <div className="flex items-center gap-2 px-3 py-2">
          <FileText size={10} style={{ color: color || '#888' }} className="shrink-0" />
          <span className="text-[10px] font-mono text-[#bbb] flex-1 truncate">{name}</span>
          {hasContent && (
            <>
              <span className="text-[8px] font-mono text-[#333]">
                {content.length > 1000 ? `${(content.length / 1000).toFixed(1)}k` : `${content.length}b`}
              </span>
              {open ? <ChevronDown size={9} className="text-[#555]" /> : <ChevronRight size={9} className="text-[#555]" />}
            </>
          )}
          {!hasContent && <span className="text-[8px] text-[#333] font-mono">empty</span>}
        </div>
        {open && (
          <pre className="px-3 pb-2 text-[8px] font-mono text-[#666] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto border-t border-[#1a1a22]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1a22 transparent' }}>
            {content}
          </pre>
        )}
      </div>
    </SpotlightNode>
  )
}

// ── Sessions Node ──
function SessionsNodeComponent({ data }: NodeProps) {
  const { sessions, color } = data as any
  const list = (sessions || []) as any[]
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? list : list.slice(0, 4)

  return (
    <SpotlightNode color={color || '#60a5fa'}>
      <div style={{ minWidth: 220, maxWidth: 320 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a22]">
          <Bot size={10} className="text-[#60a5fa]" />
          <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">Sessions</span>
          <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{list.length}</span>
        </div>
        <div className="p-2 space-y-1">
          {list.length === 0 && <div className="text-[9px] text-[#333] font-mono text-center py-2">No sessions</div>}
          {visible.map((s: any) => {
            const isRunning = s.status === 'running'
            const c = isRunning ? '#60a5fa' : s.status === 'completed' ? '#00ff8880' : '#f8717180'
            const icon = s.type === 'cron' ? <Repeat size={8} /> : s.type === 'main' ? <Bot size={8} /> : <ArrowUpRight size={8} />
            return (
              <div key={s.key} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#08080d]">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'animate-pulse' : ''}`} style={{ background: c }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono text-[#bbb] truncate">{s.label}</div>
                  <div className="flex items-center gap-2 text-[7px] font-mono text-[#444]">
                    <span className="flex items-center gap-0.5">{icon} {s.type}</span>
                    <span>{s.lastActivity}</span>
                  </div>
                </div>
              </div>
            )
          })}
          {list.length > 4 && (
            <button onClick={() => { setExpanded(!expanded); requestAnimationFrame(emitRelayout) }}
              className="w-full text-[8px] text-[#555] font-mono py-1 hover:text-[#888] transition-colors border-none bg-transparent cursor-pointer">
              {expanded ? 'Show less' : `+${list.length - 4} more`}
            </button>
          )}
        </div>
      </div>
    </SpotlightNode>
  )
}

// ── Connections Node ──
function ConnectionsNodeComponent({ data }: NodeProps) {
  const { connections, color } = data as any
  const list = (connections || []) as any[]

  return (
    <SpotlightNode color={color || '#00ff88'}>
      <div style={{ minWidth: 200, maxWidth: 280 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a22]">
          <Link2 size={10} className="text-[#00ff88]" />
          <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">Connections</span>
          <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{list.length}</span>
        </div>
        <div className="p-2 space-y-1">
          {list.length === 0 && <div className="text-[9px] text-[#333] font-mono text-center py-2">No connections</div>}
          {list.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-[#08080d]">
              <div>
                <div className="text-[9px] font-mono text-[#bbb]">{c.from} → {c.to}</div>
                <div className="text-[7px] text-[#444] font-mono">{c.type}{c.label ? ` · ${c.label}` : ''}</div>
              </div>
              <div className="flex items-center gap-1">
                {c.active && <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />}
                <span className="text-[8px] font-mono text-[#555]">{c.taskCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SpotlightNode>
  )
}

// ── Stats/Overview Node ──
function StatsNodeComponent({ data }: NodeProps) {
  const { agent, color } = data as any

  return (
    <SpotlightNode color={color || '#888'}>
      <div style={{ minWidth: 180 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a22]">
          <Activity size={10} style={{ color }} />
          <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">Overview</span>
        </div>
        <div className="p-3 space-y-2">
          <StatRow label="Status" value={agent.status.toUpperCase()} color={color} />
          <StatRow label="Model" value={agent.model?.replace('anthropic/', '').replace('claude-', '')} />
          <StatRow label="Sessions" value={`${agent.activeSessions || 0} active / ${agent.sessionCount || 0} total`} />
          <StatRow label="Messages" value={`~${agent.messageCount}`} />
          <StatRow label="Reasoning" value={agent.reasoningLevel || 'off'} />
          <StatRow label="Last active" value={agent.lastActivity} />
          {agent.contextTokens > 0 && (
            <div className="pt-1">
              <div className="flex justify-between text-[7px] font-mono text-[#444] mb-1">
                <span>CONTEXT</span>
                <span>{(agent.contextTokens / 1000).toFixed(0)}k / 200k</span>
              </div>
              <div className="h-1 bg-[#1a1a22] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min((agent.contextTokens / 200000) * 100, 100)}%`, background: color, opacity: 0.5 }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </SpotlightNode>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-[9px] font-mono">
      <span className="text-[#444]">{label}</span>
      <span className="text-[#999]" style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}

// ── Workspace Node ──
function WorkspaceNodeComponent({ data }: NodeProps) {
  const { files, color } = data as any
  const list = (files || []) as { name: string; type: string }[]

  return (
    <SpotlightNode color={color || '#f59e0b'}>
      <div style={{ minWidth: 160, maxWidth: 220 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a22]">
          <FolderOpen size={10} className="text-[#f59e0b]" />
          <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">Workspace</span>
          <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{list.length}</span>
        </div>
        <div className="p-2 space-y-0.5">
          {list.map(f => (
            <div key={f.name} className="text-[9px] font-mono text-[#555] flex items-center gap-1.5 px-1 py-0.5">
              <span className="text-[7px]">{f.type === 'dir' ? '📁' : '📄'}</span>
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    </SpotlightNode>
  )
}

// ── Memory Node ──
function MemoryNodeComponent({ data }: NodeProps) {
  const { memories, color } = data as any
  const list = (memories || []) as any[]
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <SpotlightNode color={color || '#c084fc'}>
      <div style={{ minWidth: 200, maxWidth: 300 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a22]">
          <Clock size={10} className="text-[#c084fc]" />
          <span className="text-[10px] font-bold text-[#888] tracking-wider uppercase flex-1">Recent Memory</span>
          <span className="text-[9px] font-mono text-[#444] bg-[#0f0f14] px-1.5 py-0.5 rounded">{list.length}</span>
        </div>
        <div className="p-2 space-y-1">
          {list.length === 0 && <div className="text-[9px] text-[#333] font-mono text-center py-2">No memory files</div>}
          {list.map((m: any, i: number) => (
            <div key={m.name} className="rounded bg-[#08080d] overflow-hidden">
              <button onClick={() => { setOpenIdx(openIdx === i ? null : i); requestAnimationFrame(emitRelayout) }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left border-none bg-transparent cursor-pointer hover:bg-[#0c0c14] transition-colors">
                {openIdx === i ? <ChevronDown size={8} className="text-[#555]" /> : <ChevronRight size={8} className="text-[#555]" />}
                <span className="text-[9px] font-mono text-[#999]">{m.name}</span>
              </button>
              {openIdx === i && m.preview && (
                <pre className="px-2 pb-2 text-[7px] font-mono text-[#555] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto"
                  style={{ scrollbarWidth: 'thin' }}>
                  {m.preview}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </SpotlightNode>
  )
}

export const detailNodeTypes = {
  fileNode: memo(FileNodeComponent),
  sessionsNode: memo(SessionsNodeComponent),
  connectionsNode: memo(ConnectionsNodeComponent),
  statsNode: memo(StatsNodeComponent),
  workspaceNode: memo(WorkspaceNodeComponent),
  memoryNode: memo(MemoryNodeComponent),
}
