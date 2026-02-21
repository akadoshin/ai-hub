import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { AgentData, AgentStatus } from '../store'
import { Brain, Zap, Clock, AlertCircle } from 'lucide-react'

const statusConfig: Record<AgentStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  active:   { color: '#00ff88', bg: '#00ff8820', icon: <Zap size={12} />,        label: 'Active' },
  idle:     { color: '#888',    bg: '#88888820', icon: <Clock size={12} />,       label: 'Idle' },
  thinking: { color: '#60a5fa', bg: '#60a5fa20', icon: <Brain size={12} />,       label: 'Thinking' },
  error:    { color: '#f87171', bg: '#f8717120', icon: <AlertCircle size={12} />, label: 'Error' },
}

function AgentNode({ data, selected }: NodeProps) {
  const agent = data as unknown as AgentData
  const cfg = statusConfig[agent.status]
  const isThinking = agent.status === 'thinking'

  return (
    <div
      style={{
        background: '#1a1a1a',
        border: `1px solid ${selected ? cfg.color : '#2a2a2a'}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 160,
        boxShadow: selected ? `0 0 20px ${cfg.color}30` : '0 4px 20px #00000060',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#333', border: 'none', width: 8, height: 8 }} />
      
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div
          className={isThinking ? 'pulse' : ''}
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 8px ${cfg.color}`,
          }}
        />
        <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600, letterSpacing: '0.05em' }}>
          {cfg.label.toUpperCase()}
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 4, whiteSpace: 'nowrap' }}>
        {agent.label}
      </div>

      {/* Model */}
      <div style={{ fontSize: 10, color: '#666', marginBottom: 8 }}>
        {agent.model.replace('anthropic/', '')}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#888' }}>
        <span>{agent.messageCount} msgs</span>
        <span>{agent.lastActivity}</span>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#333', border: 'none', width: 8, height: 8 }} />
    </div>
  )
}

export default memo(AgentNode)
