import { memo, useRef, useState, type MouseEvent } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { CronJob } from '../store'

function CronNode({ data }: NodeProps) {
  const cron = data as unknown as CronJob
  const enabled = cron.enabled
  const color = enabled ? '#00ff88' : '#444'
  const hasError = cron.state.consecutiveErrors > 0
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
        minWidth: 190,
        opacity: enabled ? 1 : 0.6,
      }}
    >
      {/* Spotlight */}
      <div className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0, background: `radial-gradient(150px circle at ${spotPos.x}px ${spotPos.y}px, ${color}10, transparent 60%)` }} />

      <Handle type="target" position={Position.Top} style={{ background: '#2a2a33', border: 'none', width: 5, height: 5 }} />

      <div className="relative z-10 p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">⏰</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#ddd] truncate">{cron.name}</div>
            <div className="text-[9px] font-mono text-[#555]">{cron.schedule}</div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
            style={{ color, background: `${color}10` }}>
            {enabled ? '● ENABLED' : '○ DISABLED'}
          </div>
          {hasError && (
            <div className="px-1.5 py-0.5 rounded text-[8px] font-bold text-[#f87171] bg-[#f8717110]">
              {cron.state.consecutiveErrors} errors
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-1 text-[9px] font-mono">
          <div className="flex justify-between">
            <span className="text-[#444]">Last run</span>
            <span className="text-[#888]">{cron.state.lastActivity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Duration</span>
            <span className="text-[#888]">{cron.state.lastDuration ? `${(cron.state.lastDuration / 1000).toFixed(1)}s` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Status</span>
            <span style={{ color: cron.state.lastStatus === 'ok' ? '#00ff88' : '#f87171' }}>
              {cron.state.lastStatus}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Target</span>
            <span className="text-[#888]">{cron.sessionTarget}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#444]">Delivery</span>
            <span className="text-[#888]">{cron.delivery}</span>
          </div>
        </div>

        {/* Payload preview */}
        {cron.payload && (
          <div className="mt-2 p-1.5 rounded bg-[#060608] text-[8px] text-[#555] font-mono truncate max-h-8 overflow-hidden">
            {cron.payload.slice(0, 80)}...
          </div>
        )}
      </div>
    </div>
  )
}

export const CronNodeComponent = memo(CronNode)
