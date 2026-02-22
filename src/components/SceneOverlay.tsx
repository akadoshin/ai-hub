import { useHubStore } from '../store'

export function SceneOverlay() {
  const { agents, tasks, connected } = useHubStore()
  const active = agents.filter(a => a.status === 'active' || a.status === 'thinking').length
  const crons = tasks.filter(t => t.type === 'cron').length
  const running = tasks.filter(t => t.status === 'running').length

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Bottom-left: solar system legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        display: 'flex', flexDirection: 'column', gap: 3,
        background: '#050508cc', borderRadius: 8, padding: '8px 10px',
        border: '1px solid #1a1a1a',
      }}>
        <div style={{ fontSize: 8, color: '#444', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 2 }}>SYSTEM MAP</div>
        <Legend emoji="☀" label="Star — core agent" />
        <Legend emoji="🪐" label="Planet — persistent agent" />
        <Legend emoji="🌙" label="Moon — cron task" />
        <Legend emoji="☄" label="Comet — worker/spawn" />
      </div>

      {/* Top-right: status */}
      <div style={{
        position: 'absolute', top: 10, right: 292,
        display: 'flex', gap: 6,
      }}>
        <Pill color={connected ? '#00ff88' : '#f87171'} label={connected ? 'LIVE' : 'OFFLINE'} pulse={connected} />
        {active > 0 && <Pill color="#00ff88" label={`${active} active`} />}
        <Pill color="#555" label={`${crons} moons`} />
        {running > 0 && <Pill color="#60a5fa" label={`${running} in flight`} />}
      </div>
    </div>
  )
}

function Legend({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#555' }}>
      <span style={{ fontSize: 10 }}>{emoji}</span>
      {label}
    </div>
  )
}

function Pill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${color}10`, border: `1px solid ${color}25`,
      borderRadius: 14, padding: '2px 8px',
      fontSize: 9, color, fontWeight: 600,
    }}>
      {pulse && <div className="pulse" style={{ width: 4, height: 4, borderRadius: '50%', background: color }} />}
      {label}
    </div>
  )
}
