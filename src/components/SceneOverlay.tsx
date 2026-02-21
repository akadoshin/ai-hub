import { useHubStore } from '../store'

/** Minimal overlay — only essential info that helps the user */
export function SceneOverlay() {
  const { agents, tasks, connected } = useHubStore()
  const active = agents.filter(a => a.status === 'active' || a.status === 'thinking').length
  const running = tasks.filter(t => t.status === 'running').length

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Bottom-left: legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <Legend color="#00ff88" shape="circle" label="Core agent" />
        <Legend color="#00ff88" shape="circle-small" label="Satellite (persistent)" />
        <Legend color="#60a5fa" shape="square" label="Worker (ephemeral)" />
      </div>

      {/* Top-right: status */}
      <div style={{
        position: 'absolute', top: 10, right: 292,
        display: 'flex', gap: 6,
      }}>
        <StatusPill
          color={connected ? '#00ff88' : '#f87171'}
          label={connected ? 'LIVE' : 'OFFLINE'}
          pulse={connected}
        />
        {active > 0 && (
          <StatusPill color="#00ff88" label={`${active} active`} />
        )}
        {running > 0 && (
          <StatusPill color="#60a5fa" label={`${running} tasks`} />
        )}
      </div>
    </div>
  )
}

function Legend({ color, shape, label }: { color: string; shape: string; label: string }) {
  const size = shape === 'circle' ? 8 : shape === 'circle-small' ? 6 : 6
  const borderRadius = shape === 'square' ? 1 : '50%'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: size, height: size, borderRadius,
        background: color, opacity: 0.6,
      }} />
      <span style={{ fontSize: 9, color: '#555' }}>{label}</span>
    </div>
  )
}

function StatusPill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${color}10`, border: `1px solid ${color}30`,
      borderRadius: 16, padding: '2px 8px',
      fontSize: 9, color, fontWeight: 600,
    }}>
      {pulse && <div className="pulse" style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />}
      {label}
    </div>
  )
}
