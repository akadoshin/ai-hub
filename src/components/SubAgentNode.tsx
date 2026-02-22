import { memo, useRef, useState, type MouseEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { SubAgent } from '../store'

function SubAgentNode({ data }: NodeProps) {
  const sub = data as unknown as SubAgent
  const isRunning = sub.status === 'running'
  const color = isRunning ? '#60a5fa' : '#444'
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
      className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        background: '#0a0a10',
        border: `1px solid ${hovered ? '#2a2a33' : '#1a1a22'}`,
        minWidth: 180,
      }}
    >
      {/* Spotlight */}
      <div className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0, background: `radial-gradient(150px circle at ${spotPos.x}px ${spotPos.y}px, ${color}10, transparent 60%)` }} />

      {/* Comet trail for running */}
      {isRunning && (
        <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
          <div className="absolute h-px w-16 animate-[slideRight_2s_linear_infinite]"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, top: 0 }} />
        </div>
      )}

      <Handle type="target" position={Position.Bottom} style={{ background: '#2a2a33', border: 'none', width: 5, height: 5 }} />

      <div className="relative z-10 p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">🚀</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#ddd] truncate">{sub.label || 'Subagent'}</div>
            <div className="text-[9px] font-mono text-[#555] truncate">{sub.key.split(':').slice(-1)[0]?.slice(0, 8)}</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
            style={{ color, background: `${color}10` }}>
            {isRunning && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
            {sub.status.toUpperCase()}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1 text-[9px] font-mono">
          <div className="flex justify-between">
            <span className="text-[#444]">Model</span>
            <span className="text-[#888]">{sub.model.replace('anthropic/', '').replace('claude-', '')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Parent</span>
            <span className="text-[#888]">{sub.agentId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Last active</span>
            <span className="text-[#888]">{sub.lastActivity}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SubAgentNodeComponent = memo(SubAgentNode)
