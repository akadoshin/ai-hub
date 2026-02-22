import { memo, useRef, useState, type MouseEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { AgentData, AgentStatus } from '../store'

const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
  active:   { color: '#00ff88', label: 'ACTIVE' },
  idle:     { color: '#555',    label: 'IDLE' },
  thinking: { color: '#60a5fa', label: 'THINKING' },
  error:    { color: '#f87171', label: 'ERROR' },
}

function AgentNode({ data, selected }: NodeProps) {
  const agent = data as unknown as AgentData
  const cfg = statusConfig[agent.status]
  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const ref = useRef<HTMLDivElement>(null)
  const [spotPos, setSpotPos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  const handleMove = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setSpotPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background: '#0a0a10',
        border: `1px solid ${selected ? cfg.color + '60' : hovered ? '#2a2a33' : '#1a1a22'}`,
        boxShadow: selected ? `0 0 20px ${cfg.color}15` : hovered ? '0 4px 20px #00000060' : 'none',
        minWidth: 220,
      }}
    >
      {/* Spotlight */}
      <div className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0, background: `radial-gradient(200px circle at ${spotPos.x}px ${spotPos.y}px, ${cfg.color}10, transparent 60%)` }} />

      <Handle type="target" position={Position.Top} style={{ background: '#2a2a33', border: 'none', width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#2a2a33', border: 'none', width: 6, height: 6 }} />

      <div className="relative z-10 p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ background: `${cfg.color}10`, color: cfg.color, border: `1px solid ${cfg.color}20` }}>
            {agent.id === 'main' ? '⚡' : agent.label[0]}
          </div>
          <div>
            <div className="text-sm font-bold text-[#eee]">{agent.label}</div>
            <div className="text-[9px] font-mono text-[#555]">{agent.id}</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider"
            style={{ color: cfg.color, background: `${cfg.color}10` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`} style={{ background: cfg.color }} />
            {cfg.label}
          </div>
          {agent.reasoningLevel && agent.reasoningLevel !== 'off' && (
            <div className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider text-[#c084fc] bg-[#c084fc10]">
              🧠 {agent.reasoningLevel}
            </div>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono">
          <Metric label="MODEL" value={agent.model.replace('anthropic/', '').replace('claude-', '')} />
          <Metric label="SESSIONS" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
          <Metric label="MESSAGES" value={`~${agent.messageCount}`} />
          <Metric label="LAST ACTIVE" value={agent.lastActivity} />
        </div>

        {/* Context bar */}
        {agent.contextTokens && agent.contextTokens > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[8px] font-mono text-[#444] mb-1">
              <span>CONTEXT</span>
              <span>{Math.round((agent.contextTokens / 200000) * 100)}%</span>
            </div>
            <div className="h-1 bg-[#1a1a22] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min((agent.contextTokens / 200000) * 100, 100)}%`, background: cfg.color, opacity: 0.6 }} />
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#2a2a33', border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#2a2a33', border: 'none', width: 6, height: 6 }} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] text-[#444] tracking-wider">{label}</div>
      <div className="text-[11px] text-[#bbb]">{value}</div>
    </div>
  )
}

export default memo(AgentNode)
