import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

/**
 * CoreNode — the main agent (Eugenio).
 * Always at center. Larger than satellites. Breathes with activity.
 * Inner glow intensifies when thinking/active.
 */
interface CoreNodeProps {
  agent: AgentData
  selected: boolean
  onClick: () => void
}

export function CoreNode({ agent, selected, onClick }: CoreNodeProps) {
  const coreRef = useRef<THREE.Mesh>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isThinking = agent.status === 'thinking'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    // Core breathes slowly
    if (coreRef.current) {
      const breathe = 1 + Math.sin(t * 0.6) * 0.03
      coreRef.current.scale.setScalar(breathe)
      coreRef.current.rotation.y += isThinking ? 0.008 : 0.002
    }

    // Inner energy pulses faster when active
    if (innerRef.current) {
      const pulse = isActive ? 0.4 + Math.sin(t * 3) * 0.15 : 0.15
      const mat = innerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = pulse
    }

    // Outer shell subtle rotation
    if (shellRef.current) {
      shellRef.current.rotation.x = t * 0.1
      shellRef.current.rotation.z = t * 0.07
    }
  })

  const statusColor = {
    active: '#00ff88',
    thinking: '#60a5fa',
    idle: '#445544',
    error: '#f87171',
  }[agent.status] ?? '#00ff88'

  return (
    <group position={[0, 0, 0]}>
      {/* Inner energy core — visible through translucent shell */}
      <Sphere ref={innerRef} args={[0.3, 32, 32]}>
        <meshBasicMaterial color={statusColor} transparent opacity={0.3} />
      </Sphere>

      {/* Main body — distorted icosahedron */}
      <mesh ref={coreRef} onClick={onClick} castShadow>
        <icosahedronGeometry args={[0.65, 4]} />
        <MeshDistortMaterial
          color="#111"
          emissive={statusColor}
          emissiveIntensity={isActive ? 0.4 : 0.1}
          distort={isThinking ? 0.2 : 0.06}
          speed={isThinking ? 3 : 0.8}
          roughness={0.2}
          metalness={0.9}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Wireframe shell — shows structure */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshBasicMaterial color={statusColor} wireframe transparent opacity={isActive ? 0.15 : 0.05} />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 0.88, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.4} />
        </mesh>
      )}

      {/* Label — always visible, minimal */}
      <Html position={[0, 1, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center',
          background: '#0a0a0acc',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${statusColor}30`,
          borderRadius: 8,
          padding: '4px 10px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#eee', letterSpacing: '-0.01em' }}>
            {agent.label}
          </div>
          <div style={{ fontSize: 9, color: statusColor, fontWeight: 600, marginTop: 1 }}>
            {agent.status.toUpperCase()} · {agent.model.replace('anthropic/', '').replace('claude-', '')}
          </div>
        </div>
      </Html>

      {/* Detail panel when selected */}
      {selected && (
        <Html position={[1.2, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#0c0c0cf0',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${statusColor}30`,
            borderRadius: 10,
            padding: '12px 16px',
            width: 200,
            boxShadow: `0 8px 30px #00000080`,
          }}>
            <div style={{ fontSize: 10, color: '#555', borderBottom: '1px solid #1a1a1a', paddingBottom: 6, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>
              MAIN AGENT
            </div>
            <InfoRow label="Model" value={agent.model.replace('anthropic/', '')} />
            <InfoRow label="Messages" value={String(agent.messageCount)} />
            <InfoRow label="Last active" value={agent.lastActivity} />
            {agent.description && <InfoRow label="Role" value={agent.description} />}
          </div>
        </Html>
      )}
    </group>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
      <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 10, color: '#ccc', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}
