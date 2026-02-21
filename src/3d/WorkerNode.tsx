import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Task } from '../store'

/**
 * WorkerNode — ephemeral sub-agent tasks (Opus spawns, one-shot runs).
 * Appears when spawned, shows progress, fades when done.
 * Positioned in a ring further out from satellites.
 */
interface WorkerNodeProps {
  task: Task
  index: number
  totalWorkers: number
}

export function WorkerNode({ task, index, totalWorkers }: WorkerNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const cubeRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef<THREE.Mesh>(null)

  const isRunning = task.status === 'running'
  const isDone = task.status === 'completed'
  const isFailed = task.status === 'failed'

  const color = isRunning ? '#60a5fa' : isDone ? '#00ff88' : isFailed ? '#f87171' : '#333'
  const workerRadius = 5.5
  const angle = (index / Math.max(totalWorkers, 1)) * Math.PI * 2

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!groupRef.current) return

    // Fixed position in outer ring (workers don't orbit — they're working)
    const x = Math.cos(angle) * workerRadius
    const z = Math.sin(angle) * workerRadius
    groupRef.current.position.set(x, 0, z)

    // Cube spins when running
    if (cubeRef.current) {
      if (isRunning) {
        cubeRef.current.rotation.x += 0.01
        cubeRef.current.rotation.y += 0.015
      }
      // Pulse when running
      const s = isRunning ? 1 + Math.sin(t * 2) * 0.08 : isDone ? 0.8 : 0.6
      cubeRef.current.scale.setScalar(s)
    }

    // Progress ring
    if (progressRef.current && isRunning) {
      progressRef.current.rotation.z = -t * 0.5
    }
  })

  // Calculate progress for running tasks
  const elapsed = isRunning ? (Date.now() - task.startTime) / 1000 : task.elapsed
  const progressText = isRunning ? `${Math.floor(elapsed)}s` : task.status

  return (
    <>
      {/* Tether to center — dashed, thinner than satellites */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              0, 0, 0,
              Math.cos(angle) * workerRadius, 0, Math.sin(angle) * workerRadius
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.08} />
      </line>

      <group ref={groupRef}>
        {/* Worker body — cube (distinct from spherical agents) */}
        <mesh ref={cubeRef} castShadow>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial
            color="#111"
            emissive={color}
            emissiveIntensity={isRunning ? 0.6 : 0.15}
            roughness={0.1}
            metalness={0.95}
          />
        </mesh>

        {/* Progress ring for running tasks */}
        {isRunning && (
          <mesh ref={progressRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.01, 8, 32, Math.PI * 1.5]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
          </mesh>
        )}

        {/* Completion indicator */}
        {isDone && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.32, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
        )}

        {/* Label */}
        <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#0a0a0acc',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${color}25`,
            borderRadius: 6,
            padding: '2px 8px',
            maxWidth: 120,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#aaa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {task.label}
            </div>
            <div style={{ fontSize: 8, color, marginTop: 1 }}>
              {progressText}
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}
