import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Task } from '../store'

/**
 * CometNode — ephemeral worker tasks that fly through the system.
 * They have elliptical orbits and leave a trail.
 */

function CometModel({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/comet.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = 0.4
          mat.needsUpdate = true
        }
      }
    })
  }, [scene, color])

  return (
    <group ref={ref} scale={[0.2, 0.2, 0.2]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

interface CometNodeProps {
  task: Task
  index: number
  totalComets: number
}

export function CometNode({ task, index, totalComets: _totalComets }: CometNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const trailRef = useRef<THREE.Points>(null)
  const [hasModel, setHasModel] = useState(false)

  const isRunning = task.status === 'running'
  const isDone = task.status === 'completed'
  const color = isRunning ? '#60a5fa' : isDone ? '#00ff88' : '#f87171'

  // Elliptical orbit parameters — each comet gets a unique path
  const semiMajor = 8 + index * 2.5
  const eccentricity = 0.5 + index * 0.1
  const inclination = (index * 0.3) - 0.3
  const speed = isRunning ? 0.15 : 0.02
  const phaseOffset = index * 1.5

  useEffect(() => {
    fetch('/models/comet.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  // Trail particles
  const trailPositions = useRef(new Float32Array(30 * 3))
  const trailIndex = useRef(0)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phaseOffset
    if (!groupRef.current) return

    // Elliptical orbit
    const r = semiMajor * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(t))
    const x = r * Math.cos(t)
    const z = r * Math.sin(t)
    const y = Math.sin(t) * inclination * r * 0.1

    groupRef.current.position.set(x, y, z)

    // Point comet in direction of travel
    groupRef.current.rotation.y = -t + Math.PI / 2

    // Update trail
    if (trailRef.current && isRunning) {
      const pos = trailPositions.current
      const idx = (trailIndex.current % 30) * 3
      pos[idx] = x
      pos[idx + 1] = y
      pos[idx + 2] = z
      trailIndex.current++
      trailRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  const elapsed = isRunning ? (Date.now() - task.startTime) / 1000 : task.elapsed
  const elapsedStr = elapsed < 60 ? `${Math.floor(elapsed)}s` : `${Math.floor(elapsed / 60)}m`

  return (
    <group ref={groupRef}>
      {/* Comet body */}
      {hasModel ? (
        <Suspense fallback={<FallbackComet color={color} />}>
          <CometModel color={color} />
        </Suspense>
      ) : (
        <FallbackComet color={color} />
      )}

      {/* Comet tail trail */}
      {isRunning && (
        <points ref={trailRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[trailPositions.current, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.04} color={color} transparent opacity={0.4} sizeAttenuation />
        </points>
      )}

      {/* Small glow */}
      <Sphere args={[0.15, 8, 8]}>
        <meshBasicMaterial color={color} transparent opacity={isRunning ? 0.15 : 0.05} />
      </Sphere>

      {/* Label */}
      <Html position={[0, 0.35, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center',
          background: '#08080ccc',
          borderRadius: 5,
          padding: '2px 7px',
          border: `1px solid ${color}20`,
          maxWidth: 120,
        }}>
          <div style={{
            fontSize: 8, fontWeight: 600, color: '#aaa',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            ☄ {task.label}
          </div>
          <div style={{ fontSize: 7, color, marginTop: 1 }}>
            {task.status.toUpperCase()} · {elapsedStr}
          </div>
        </div>
      </Html>
    </group>
  )
}

function FallbackComet({ color }: { color: string }) {
  return (
    <mesh>
      <dodecahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial
        color="#222"
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.8}
      />
    </mesh>
  )
}
