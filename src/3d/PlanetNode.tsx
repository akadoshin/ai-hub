import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData, Task } from '../store'

/**
 * PlanetNode — secondary agent as a planet orbiting the star.
 * Has its own moons (crons) orbiting around it.
 */

function PlanetModel({ modelPath, color, intensity }: { modelPath: string; color: string; intensity: number }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF(modelPath)

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
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.1
  })

  return (
    <group ref={ref} scale={[0.6, 0.6, 0.6]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

interface PlanetNodeProps {
  agent: AgentData
  index: number
  totalPlanets: number
  selected: boolean
  onClick: () => void
  crons: Task[]  // moons
}

export function PlanetNode({ agent, index, totalPlanets, selected, onClick, crons }: PlanetNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hasModel, setHasModel] = useState(false)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  // Each planet gets a different orbit distance
  const orbitRadius = 6 + index * 4
  const baseAngle = (index / Math.max(totalPlanets, 1)) * Math.PI * 2
  const orbitSpeed = 0.08 / (1 + index * 0.3) // outer = slower (Kepler-like)

  const statusColor = {
    active: '#00ff88', thinking: '#60a5fa', idle: '#334455', error: '#f87171',
  }[agent.status] ?? '#334455'

  const modelPath = `/models/planet-${agent.id}.glb`

  useEffect(() => {
    fetch(modelPath, { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [modelPath])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!groupRef.current) return

    const angle = baseAngle + t * orbitSpeed
    const x = Math.cos(angle) * orbitRadius
    const z = Math.sin(angle) * orbitRadius

    groupRef.current.position.set(x, 0, z)
  })

  // Build orbit trail (ring)
  const orbitPoints = Array.from({ length: 129 }, (_, i) => {
    const a = (i / 128) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * orbitRadius, 0, Math.sin(a) * orbitRadius)
  })
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints)

  const modelShort = agent.model.replace('anthropic/', '').replace('claude-', '')

  return (
    <>
      {/* Orbit trail */}
      <line>
        <bufferGeometry attach="geometry" {...orbitGeometry} />
        <lineBasicMaterial color={statusColor} transparent opacity={0.08} />
      </line>

      <group ref={groupRef} onClick={onClick}>
        {/* Planet body */}
        {hasModel ? (
          <Suspense fallback={<FallbackPlanet color={statusColor} />}>
            <PlanetModel modelPath={modelPath} color={statusColor} intensity={isActive ? 0.3 : 0.05} />
          </Suspense>
        ) : (
          <FallbackPlanet color={statusColor} />
        )}

        {/* Thin atmosphere */}
        <Sphere args={[0.55, 24, 24]}>
          <meshBasicMaterial color={statusColor} transparent opacity={isActive ? 0.06 : 0.02} side={THREE.BackSide} />
        </Sphere>

        {/* Planet light — faint, from star reflection */}
        <pointLight intensity={0.3} color={statusColor} distance={4} decay={2} />

        {selected && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.73, 48]} />
            <meshBasicMaterial color={statusColor} transparent opacity={0.3} />
          </mesh>
        )}

        {/* ── Moons (crons) orbiting this planet ── */}
        {crons.map((cron, ci) => (
          <MoonNode key={cron.id} cron={cron} index={ci} totalMoons={crons.length} />
        ))}

        {/* ── Info panel ── */}
        <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#08080cdd',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${statusColor}25`,
            borderRadius: 8,
            padding: '6px 12px',
            minWidth: 140,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
              <span style={{ fontSize: 11 }}>🪐</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#eee' }}>{agent.label}</span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 8, color: statusColor, fontWeight: 600, marginBottom: 4,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: '50%', background: statusColor,
                animation: isActive ? 'pulse-dot 1.5s infinite' : 'none',
              }} />
              {agent.status.toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
              <MiniMetric label="Model" value={modelShort} />
              <MiniMetric label="Sessions" value={`${agent.sessionCount || 0}`} />
              {crons.length > 0 && <MiniMetric label="Moons" value={`${crons.length} crons`} />}
            </div>
          </div>
        </Html>

        {selected && (
          <Html position={[1.2, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              background: '#0a0a0ef5', border: `1px solid ${statusColor}20`,
              borderRadius: 8, padding: '10px 14px', width: 200,
            }}>
              <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>
                PLANET — {agent.label.toUpperCase()}
              </div>
              <DetailRow label="Model" value={agent.model} />
              <DetailRow label="Sessions" value={`${agent.activeSessions || 0} active / ${agent.sessionCount || 0}`} />
              <DetailRow label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
              <DetailRow label="Last active" value={agent.lastActivity} />
              <DetailRow label="Moons" value={`${crons.length} cron tasks`} />
            </div>
          </Html>
        )}
      </group>
    </>
  )
}

/** Moon — cron task orbiting a planet */
function MoonNode({ cron, index, totalMoons }: { cron: Task; index: number; totalMoons: number }) {
  const ref = useRef<THREE.Group>(null)
  const moonOrbitRadius = 1 + index * 0.4
  const moonSpeed = 0.3 / (1 + index * 0.2)
  const baseAngle = (index / Math.max(totalMoons, 1)) * Math.PI * 2

  const isRecent = cron.status === 'running' || (Date.now() - (cron.startTime || 0)) < 3600000
  const moonColor = cron.status === 'running' ? '#60a5fa' : isRecent ? '#445544' : '#222'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!ref.current) return
    const angle = baseAngle + t * moonSpeed
    ref.current.position.set(
      Math.cos(angle) * moonOrbitRadius,
      Math.sin(t * 0.5 + index) * 0.05,
      Math.sin(angle) * moonOrbitRadius
    )
  })

  return (
    <group ref={ref}>
      <Sphere args={[0.08, 12, 12]}>
        <meshStandardMaterial
          color="#222"
          emissive={moonColor}
          emissiveIntensity={cron.status === 'running' ? 0.5 : 0.1}
          roughness={0.8}
          metalness={0.2}
        />
      </Sphere>

      <Html position={[0, 0.18, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#08080cbb', borderRadius: 4, padding: '1px 5px',
          fontSize: 7, color: moonColor, whiteSpace: 'nowrap', fontWeight: 600,
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {cron.label.replace('Cron: ', '🌙 ')}
        </div>
      </Html>
    </group>
  )
}

function FallbackPlanet({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.08
  })
  return (
    <Sphere ref={ref} args={[0.45, 32, 32]} castShadow>
      <meshStandardMaterial color="#1a1a2a" emissive={color} emissiveIntensity={0.1} roughness={0.7} metalness={0.3} />
    </Sphere>
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
      <span style={{ fontSize: 9, color: '#bbb', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{value}</span>
    </div>
  )
}
