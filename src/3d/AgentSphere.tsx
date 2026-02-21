import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

const STATUS = {
  active:   { color: '#00ff88', emissive: 0.5,  distort: 0.15, speed: 1.5, glow: 0.12, label: '● ACTIVE' },
  idle:     { color: '#556655', emissive: 0.05, distort: 0.03, speed: 0.3, glow: 0.03, label: '○ IDLE' },
  thinking: { color: '#60a5fa', emissive: 0.6,  distort: 0.4,  speed: 4,   glow: 0.15, label: '◉ THINKING' },
  error:    { color: '#f87171', emissive: 0.4,  distort: 0.25, speed: 2,   glow: 0.1,  label: '✕ ERROR' },
}

interface Props {
  agent: AgentData
  position: [number, number, number]
  onClick: () => void
  selected: boolean
}

export function AgentSphere({ agent, position, onClick, selected }: Props) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const cfg = STATUS[agent.status] ?? STATUS.idle

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(t * 0.7 + position[0] * 0.5) * 0.12
      meshRef.current.rotation.y += 0.002
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.1
      ringRef.current.rotation.z = t * 0.3
      const s = selected ? 1.15 + Math.sin(t * 2) * 0.03 : 1
      ringRef.current.scale.setScalar(s)
    }
  })

  // Particle halo
  const particlePositions = useMemo(() => {
    const count = agent.status === 'idle' ? 20 : 40
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 0.65 + Math.random() * 0.35
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [agent.status])

  return (
    <group position={position}>
      {/* Subtle particle halo */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.025} color={cfg.color} transparent opacity={0.4} sizeAttenuation />
      </points>

      {/* Orbit ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.006, 8, 64]} />
        <meshBasicMaterial color={cfg.color} transparent opacity={selected ? 0.7 : 0.2} />
      </mesh>

      {/* Core sphere */}
      <Sphere ref={meshRef} args={[0.38, 48, 48]} onClick={onClick} castShadow>
        <MeshDistortMaterial
          color={cfg.color}
          emissive={cfg.color}
          emissiveIntensity={cfg.emissive}
          distort={cfg.distort}
          speed={cfg.speed}
          roughness={0.15}
          metalness={0.85}
          transparent
          opacity={0.92}
        />
      </Sphere>

      {/* Glow shell */}
      <Sphere args={[0.48, 24, 24]}>
        <meshBasicMaterial color={cfg.color} transparent opacity={cfg.glow} side={THREE.BackSide} />
      </Sphere>

      {/* Selection highlight */}
      {selected && (
        <Sphere args={[0.58, 16, 16]}>
          <meshBasicMaterial color={cfg.color} transparent opacity={0.06} side={THREE.BackSide} />
        </Sphere>
      )}

      {/* Label */}
      <Html position={[0, 0.72, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#0a0a0acc',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${cfg.color}33`,
          borderRadius: 8,
          padding: '5px 10px',
          textAlign: 'center',
          minWidth: 80,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#e8e8e8',
            whiteSpace: 'nowrap', letterSpacing: '-0.01em',
            marginBottom: 2,
          }}>
            {agent.label}
          </div>
          <div style={{
            fontSize: 9, color: cfg.color, fontWeight: 600,
            letterSpacing: '0.06em',
          }}>
            {cfg.label}
          </div>
          <div style={{
            fontSize: 8, color: '#555', marginTop: 2,
            whiteSpace: 'nowrap',
          }}>
            {agent.model.replace('anthropic/', '').replace('claude-', '')} · {agent.messageCount} msgs
          </div>
        </div>
      </Html>

      {/* Info panel on select */}
      {selected && (
        <Html position={[0.8, 0.3, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#0f0f0fee',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${cfg.color}40`,
            borderRadius: 10,
            padding: '10px 14px',
            width: 180,
            boxShadow: `0 4px 30px #00000080, 0 0 15px ${cfg.color}15`,
          }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6, borderBottom: '1px solid #222', paddingBottom: 6 }}>
              Agent Details
            </div>
            <Row label="Model" value={agent.model.replace('anthropic/', '')} />
            <Row label="Messages" value={String(agent.messageCount)} />
            <Row label="Last active" value={agent.lastActivity} />
            {agent.description && <Row label="Desc" value={agent.description} />}
          </div>
        </Html>
      )}
    </group>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 9, color: '#666' }}>{label}</span>
      <span style={{ fontSize: 9, color: '#ccc', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</span>
    </div>
  )
}
