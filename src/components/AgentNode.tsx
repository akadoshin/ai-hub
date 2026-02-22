import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { AgentData, AgentStatus } from '../store'
import { Brain, Zap, Clock, AlertCircle } from 'lucide-react'

const statusConfig: Record<AgentStatus, { color: string; icon: React.ReactNode; label: string }> = {
  active:   { color: '#00ff88', icon: <Zap size={12} />,        label: 'Active' },
  idle:     { color: '#888',    icon: <Clock size={12} />,       label: 'Idle' },
  thinking: { color: '#60a5fa', icon: <Brain size={12} />,       label: 'Thinking' },
  error:    { color: '#f87171', icon: <AlertCircle size={12} />, label: 'Error' },
}

function AgentNode({ data, selected }: NodeProps) {
  const agent = data as unknown as AgentData
  const cfg = statusConfig[agent.status]
  const isThinking = agent.status === 'thinking'

  return (
    <div
      className="rounded-xl p-3 px-4 min-w-[160px] transition-all duration-200 cursor-pointer bg-[#0a0a10] border border-[#1a1a22] hover:border-[#2a2a33]"
      style={{
        borderColor: selected ? cfg.color : undefined,
        boxShadow: selected
          ? `0 0 20px ${cfg.color}20, 0 4px 20px #00000060`
          : '0 4px 20px #00000060',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#333', border: 'none', width: 8, height: 8 }} />

      <div className="flex items-center gap-2 mb-2">
        <div
          className={isThinking ? 'animate-pulse' : ''}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 8px ${cfg.color}`,
          }}
        />
        <span className="text-[10px] font-semibold tracking-wider" style={{ color: cfg.color }}>
          {cfg.label.toUpperCase()}
        </span>
      </div>

      <div className="text-[13px] font-bold text-[#eee] mb-1 whitespace-nowrap">{agent.label}</div>
      <div className="text-[10px] text-[#555] mb-2 font-mono">{agent.model.replace('anthropic/', '')}</div>

      <div className="flex gap-3 text-[10px] text-[#888] font-mono">
        <span>{agent.messageCount} msgs</span>
        <span>{agent.lastActivity}</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#333', border: 'none', width: 8, height: 8 }} />
    </div>
  )
}

export default memo(AgentNode)
