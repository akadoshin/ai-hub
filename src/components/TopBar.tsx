import { useHubStore } from '../store'
import { Bot, Activity, MessageSquare, Wifi, WifiOff } from 'lucide-react'

export function TopBar() {
  const { connected, stats } = useHubStore()

  return (
    <div style={{
      height: 56,
      background: '#111',
      borderBottom: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 24,
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bot size={18} color="#0f0f0f" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
          AI Hub
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: '#2a2a2a' }} />

      {/* Stats */}
      <Stat icon={<Bot size={14} />} label="Agents" value={stats.totalAgents} />
      <Stat icon={<Activity size={14} />} label="Active" value={stats.activeSessions} accent />
      <Stat icon={<MessageSquare size={14} />} label="Messages" value={stats.messagesTotal} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 20,
        background: connected ? '#00ff8815' : '#ff444415',
        border: `1px solid ${connected ? '#00ff8840' : '#ff444440'}`,
        fontSize: 12, color: connected ? '#00ff88' : '#ff6666',
        fontWeight: 600,
      }}>
        {connected
          ? <><Wifi size={12} /><span>Connected</span><div className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88' }} /></>
          : <><WifiOff size={12} /><span>Disconnected</span></>
        }
      </div>
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: accent ? '#00ff88' : '#555' }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: accent ? '#00ff88' : '#e0e0e0' }}>{value}</span>
    </div>
  )
}
