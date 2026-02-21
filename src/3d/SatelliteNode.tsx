import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

interface SatelliteNodeProps {
  agent: AgentData
  index: number
  totalSatellites: number
  selected: boolean
  onClick: () => void
}

/** Drone model — surveillance/monitoring companion */
function DroneModel({ color, intensity }: { color: string; intensity: number }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/drone.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = intensity
          mat.needsUpdate = true
        }
      }
    })
  }, [scene, color, intensity])

  useFrame(({ clock }) => {
    if (ref.current) {
      // Subtle hover wobble
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.1
      ref.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.02
    }
  })

  return (
    <group ref={ref} scale={[0.35, 0.35, 0.35]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

export function SatelliteNode({ agent, index, totalSatellites, selected, onClick }: SatelliteNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const lineRef = useRef<THREE.Line>(null)
  const [hasModel, setHasModel] = useState(false)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const orbitRadius = 3.5
  const baseAngle = (index / Math.max(totalSatellites, 1)) * Math.PI * 2

  const statusColor = {
    active: '#00ff88', thinking: '#60a5fa', idle: '#445544', error: '#f87171',
  }[agent.status] ?? '#445544'

  const modelShort = agent.model.replace('anthropic/', '').replace('claude-', '')

  useEffect(() => {
    fetch('/models/drone.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!groupRef.current) return

    const speed = isActive ? 0.12 : 0.04
    const angle = baseAngle + t * speed
    const x = Math.cos(angle) * orbitRadius
    const z = Math.sin(angle) * orbitRadius
    const y = Math.sin(t * 0.3 + index) * 0.1

    groupRef.current.position.set(x, y, z)

    if (bodyRef.current) {
      bodyRef.current.scale.setScalar(1 + Math.sin(t * 1.2 + index) * 0.03)
    }

    if (lineRef.current) {
      const pos = lineRef.current.geometry.attributes.position.array as Float32Array
      pos[0] = 0; pos[1] = 0; pos[2] = 0
      pos[3] = x; pos[4] = y; pos[5] = z
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <>
      {/* Tether line */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(6), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={statusColor} transparent opacity={isActive ? 0.15 : 0.05} />
      </line>

      <group ref={groupRef} onClick={onClick}>
        {/* 3D Model or fallback */}
        {hasModel ? (
          <Suspense fallback={
            <Sphere args={[0.15, 12, 12]}>
              <meshBasicMaterial color={statusColor} wireframe transparent opacity={0.2} />
            </Sphere>
          }>
            <DroneModel color={statusColor} intensity={isActive ? 0.3 : 0.05} />
          </Suspense>
        ) : (
          <>
            <Sphere ref={bodyRef} args={[0.18, 20, 20]} castShadow>
              <meshStandardMaterial
                color="#151515"
                emissive={statusColor}
                emissiveIntensity={isActive ? 0.4 : 0.08}
                roughness={0.25} metalness={0.9}
              />
            </Sphere>
            <mesh>
              <octahedronGeometry args={[0.24, 0]} />
              <meshBasicMaterial color={statusColor} wireframe transparent opacity={isActive ? 0.12 : 0.03} />
            </mesh>
          </>
        )}

        {selected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.37, 32]} />
            <meshBasicMaterial color={statusColor} transparent opacity={0.35} />
          </mesh>
        )}

        {/* ── Always-visible info ── */}
        <Html position={[0, 0.6, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#0a0a0aee',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${statusColor}25`,
            borderRadius: 8,
            padding: '5px 10px',
            minWidth: 120,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#ddd', marginBottom: 2 }}>
              {agent.label}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 8, color: statusColor, fontWeight: 600,
              marginBottom: 4,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%', background: statusColor,
                animation: isActive ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              {agent.status.toUpperCase()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
              <MiniMetric label="Model" value={modelShort} />
              <MiniMetric label="Sessions" value={`${agent.sessionCount || 0}`} />
            </div>
          </div>
        </Html>

        {/* Extended detail on select */}
        {selected && (
          <Html position={[0.8, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              background: '#0c0c0cf5',
              border: `1px solid ${statusColor}25`,
              borderRadius: 8,
              padding: '10px 14px',
              width: 190,
            }}>
              <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>
                SATELLITE AGENT
              </div>
              <DetailRow label="Model" value={agent.model} />
              <DetailRow label="Sessions" value={`${agent.activeSessions || 0} active / ${agent.sessionCount || 0} total`} />
              <DetailRow label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
              <DetailRow label="Last active" value={agent.lastActivity} />
              <DetailRow label="3D Asset" value={hasModel ? 'drone.glb ✓' : 'procedural'} />
            </div>
          </Html>
        )}
      </group>
    </>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 7, color: '#444' }}>{label}</div>
      <div style={{ fontSize: 9, color: '#bbb', fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}>
      <span style={{ fontSize: 9, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 9, color: '#bbb', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{value}</span>
    </div>
  )
}
