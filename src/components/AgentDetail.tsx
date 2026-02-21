import { useHubStore } from '../store'
import { X, Bot, Cpu, MessageSquare, Clock, Activity } from 'lucide-react'

export function AgentDetail() {
  const { selectedAgent, setSelectedAgent, tasks } = useHubStore()

  if (!selectedAgent) return null

  const agentTasks = tasks.filter(t => t.agentId === selectedAgent.id)
  const statusColors = {
    active: '#00ff88', idle: '#888', thinking: '#60a5fa', error: '#f87171',
  }
  const color = statusColors[selectedAgent.status]

  return (
    <div style={{
      position: 'absolute',
      top: 16, left: 16, zIndex: 20,
      width: 300,
      background: '#161616',
      border: `1px solid ${color}40`,
      borderRadius: 14,
      boxShadow: `0 8px 40px #00000080, 0 0 30px ${color}15`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}20`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: color, flexShrink: 0,
        }}>
          <Bot size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedAgent.label}
          </div>
          <div style={{ fontSize: 10, color: color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {selectedAgent.status}
          </div>
        </div>
        <button
          onClick={() => setSelectedAgent(null)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, borderRadius: 6 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Details */}
      <div style={{ padding: '12px 16px' }}>
        <Row icon={<Cpu size={13} />} label="Model" value={selectedAgent.model.replace('anthropic/', '')} />
        <Row icon={<MessageSquare size={13} />} label="Messages" value={selectedAgent.messageCount.toString()} />
        <Row icon={<Clock size={13} />} label="Last active" value={selectedAgent.lastActivity} />
        {selectedAgent.description && (
          <Row icon={<Activity size={13} />} label="Description" value={selectedAgent.description} />
        )}
      </div>

      {/* Recent tasks */}
      {agentTasks.length > 0 && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Recent Tasks
          </div>
          {agentTasks.slice(0, 3).map(t => (
            <div key={t.id} style={{
              padding: '6px 8px', borderRadius: 6, background: '#111',
              border: '1px solid #222', marginBottom: 4, fontSize: 11,
            }}>
              <div style={{ color: '#e0e0e0', fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
              <div style={{ color: '#555' }}>{t.lastMessage}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
      <span style={{ color: '#555', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 11, color: '#555', flexShrink: 0, minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 11, color: '#ccc', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
