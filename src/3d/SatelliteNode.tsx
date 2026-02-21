import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

/**
 * SatelliteNode — secondary persistent agents (Psych, monitors, etc).
 * Orbits the core at a fixed radius. Smaller. Tethered by a visible line.
 */
interface SatelliteNodeProps {
  agent: AgentData
  index: number          // position in orbit (0-based among satellites)
  totalSatellites: number
  selected: boolean
  onClick: () => void
}

export function SatelliteNode({ agent, index, totalSatellites, selected, onClick }: SatelliteNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const sphereRef = useRef<THREE.Mesh>(null)
  const lineRef = useRef<THREE.Line>(null)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const orbitRadius = 3
  const baseAngle = (index / Math.max(totalSatellites, 1)) * Math.PI * 2

  const statusColor = {
    active: '#00ff88',
    thinking: '#60a5fa',
    idle: '#445544',
    error: '#f87171',
  }[agent.status] ?? '#445544'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!groupRef.current) return

    // Orbit around center — speed based on activity
    const speed = isActive ? 0.15 : 0.05
    const angle = baseAngle + t * speed
    const x = Math.cos(angle) * orbitRadius
    const z = Math.sin(angle) * orbitRadius
    const y = Math.sin(t * 0.3 + index) * 0.15 // subtle bob

    groupRef.current.position.set(x, y, z)

    // Sphere breathes
    if (sphereRef.current) {
      const s = 1 + Math.sin(t * 1.2 + index) * 0.04
      sphereRef.current.scale.setScalar(s)
    }

    // Update tether line from center to this position
    if (lineRef.current) {
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array
      positions[0] = 0; positions[1] = 0; positions[2] = 0
      positions[3] = x; positions[4] = y; positions[5] = z
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <>
      {/* Tether line from core to satellite */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, orbitRadius, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={statusColor} transparent opacity={isActive ? 0.2 : 0.06} />
      </line>

      <group ref={groupRef}>
        {/* Satellite body */}
        <Sphere ref={sphereRef} args={[0.22, 24, 24]} onClick={onClick} castShadow>
          <meshStandardMaterial
            color="#151515"
            emissive={statusColor}
            emissiveIntensity={isActive ? 0.5 : 0.1}
            roughness={0.3}
            metalness={0.9}
          />
        </Sphere>

        {/* Wireframe indicator */}
        <mesh>
          <octahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial color={statusColor} wireframe transparent opacity={isActive ? 0.15 : 0.04} />
        </mesh>

        {/* Selection ring */}
        {selected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.37, 32]} />
            <meshBasicMaterial color={statusColor} transparent opacity={0.4} />
          </mesh>
        )}

        {/* Label */}
        <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#0a0a0acc',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${statusColor}25`,
            borderRadius: 6,
            padding: '3px 8px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#ccc', whiteSpace: 'nowrap' }}>
              {agent.label}
            </div>
            <div style={{ fontSize: 8, color: statusColor, marginTop: 1 }}>
              {agent.status.toUpperCase()}
            </div>
          </div>
        </Html>

        {/* Detail panel */}
        {selected && (
          <Html position={[0.6, 0.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              background: '#0c0c0cf0',
              border: `1px solid ${statusColor}30`,
              borderRadius: 8,
              padding: '10px 14px',
              width: 180,
            }}>
              <div style={{ fontSize: 9, color: '#444', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>
                SATELLITE AGENT
              </div>
              <InfoRow label="Model" value={agent.model.replace('anthropic/', '')} />
              <InfoRow label="Messages" value={String(agent.messageCount)} />
              <InfoRow label="Status" value={agent.status} />
              {agent.description && <InfoRow label="Role" value={agent.description} />}
            </div>
          </Html>
        )}
      </group>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
      <span style={{ fontSize: 9, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 9, color: '#bbb' }}>{value}</span>
    </div>
  )
}
