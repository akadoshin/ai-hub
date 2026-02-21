import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

const STATUS_COLORS: Record<string, string> = {
  active:   '#00ff88',
  idle:     '#446644',
  thinking: '#60a5fa',
  error:    '#f87171',
}

const STATUS_EMISSIVE: Record<string, number> = {
  active:   0.4,
  idle:     0.05,
  thinking: 0.5,
  error:    0.3,
}

interface AgentSphereProps {
  agent: AgentData
  position: [number, number, number]
  onClick: () => void
  selected: boolean
}

export function AgentSphere({ agent, position, onClick, selected }: AgentSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const color = STATUS_COLORS[agent.status] ?? '#00ff88'
  const emissiveIntensity = STATUS_EMISSIVE[agent.status] ?? 0.2

  const distort = agent.status === 'thinking' ? 0.4 : agent.status === 'active' ? 0.15 : 0.05
  const speed = agent.status === 'thinking' ? 3 : agent.status === 'active' ? 1.5 : 0.5

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.elapsedTime

    // Float animation
    meshRef.current.position.y = position[1] + Math.sin(t * 0.8 + position[0]) * 0.15

    // Rotate slowly
    meshRef.current.rotation.y += 0.003
    meshRef.current.rotation.z = Math.sin(t * 0.3) * 0.05

    // Orbit ring
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.5
      ringRef.current.rotation.z = t * 0.3
      ringRef.current.scale.setScalar(
        selected
          ? 1.2 + Math.sin(t * 2) * 0.05
          : 1.0 + Math.sin(t * 1.5) * 0.03
      )
    }
  })

  const particlePositions = useMemo(() => {
    const positions = new Float32Array(60 * 3)
    for (let i = 0; i < 60; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 0.8 + Math.random() * 0.4
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    return positions
  }, [])

  return (
    <group position={position}>
      {/* Particle halo */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color={color}
          transparent
          opacity={agent.status === 'idle' ? 0.2 : 0.6}
          sizeAttenuation
        />
      </points>

      {/* Orbit ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.7, 0.008, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.8 : 0.3} />
      </mesh>

      {/* Main sphere */}
      <Sphere
        ref={meshRef}
        args={[0.45, 64, 64]}
        onClick={onClick}
        castShadow
      >
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          distort={distort}
          speed={speed}
          roughness={0.1}
          metalness={0.8}
          transparent
          opacity={0.9}
        />
      </Sphere>

      {/* Selection glow */}
      {selected && (
        <Sphere args={[0.55, 32, 32]}>
          <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.BackSide} />
        </Sphere>
      )}

      {/* HTML label */}
      <Html
        position={[0, 0.75, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: '#0f0f0fcc',
          border: `1px solid ${color}44`,
          borderRadius: 6,
          padding: '3px 8px',
          fontSize: 10,
          fontWeight: 700,
          color: color,
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(4px)',
          letterSpacing: '0.04em',
        }}>
          {agent.label}
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: 9,
          color: '#555',
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}>
          {agent.model.replace('anthropic/', '').replace('claude-', '')}
        </div>
      </Html>
    </group>
  )
}
