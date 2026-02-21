import { useHubStore } from '../store'

/** Transparent overlay with scene info hints — sits on top of the 3D canvas */
export function SceneOverlay() {
  const { agents, connected } = useHubStore()
  const active = agents.filter(a => a.status === 'active' || a.status === 'thinking').length

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
    }}>
      {/* Bottom-left: controls hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        display: 'flex', gap: 12, alignItems: 'center',
      }}>
        <Chip>🖱 Orbit</Chip>
        <Chip>⇧ Scroll to zoom</Chip>
        <Chip>Click agent for details</Chip>
      </div>

      {/* Top-right: live indicator */}
      <div style={{
        position: 'absolute', top: 12, right: 300,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {connected && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#00ff8810', border: '1px solid #00ff8830',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, color: '#00ff88', fontWeight: 600,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88' }} className="pulse" />
            LIVE
          </div>
        )}
        <div style={{
          background: '#0a0a0acc', border: '1px solid #222',
          borderRadius: 20, padding: '3px 10px',
          fontSize: 10, color: '#888',
        }}>
          {active}/{agents.length} agents active
        </div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: '#0a0a0a99', border: '1px solid #222',
      borderRadius: 12, padding: '2px 8px',
      fontSize: 9, color: '#555', fontWeight: 500,
    }}>
      {children}
    </span>
  )
}
