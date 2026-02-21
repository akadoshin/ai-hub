import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Task } from '../store'

interface WorkerNodeProps {
  task: Task
  index: number
  totalWorkers: number
}

/** Robot model for worker tasks */
function RobotModel({ color, spinning }: { color: string; spinning: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/robot.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = spinning ? 0.4 : 0.1
          mat.needsUpdate = true
        }
      }
    })
  }, [scene, color, spinning])

  useFrame(({ clock }) => {
    if (ref.current) {
      if (spinning) {
        ref.current.rotation.y += 0.02
      } else {
        ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.2
      }
    }
  })

  return (
    <group ref={ref} scale={[0.3, 0.3, 0.3]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

export function WorkerNode({ task, index, totalWorkers }: WorkerNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const cubeRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef<THREE.Mesh>(null)
  const [hasModel, setHasModel] = useState(false)

  const isRunning = task.status === 'running'
  const isDone = task.status === 'completed'
  const isFailed = task.status === 'failed'

  const color = isRunning ? '#60a5fa' : isDone ? '#00ff88' : isFailed ? '#f87171' : '#333'
  const workerRadius = 5.5
  const angle = (index / Math.max(totalWorkers, 1)) * Math.PI * 2

  useEffect(() => {
    fetch('/models/robot.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!groupRef.current) return

    const x = Math.cos(angle) * workerRadius
    const z = Math.sin(angle) * workerRadius
    groupRef.current.position.set(x, 0, z)

    if (cubeRef.current) {
      if (isRunning) {
        cubeRef.current.rotation.x += 0.01
        cubeRef.current.rotation.y += 0.015
      }
      const s = isRunning ? 1 + Math.sin(t * 2) * 0.08 : isDone ? 0.8 : 0.6
      cubeRef.current.scale.setScalar(s)
    }

    if (progressRef.current && isRunning) {
      progressRef.current.rotation.z = -t * 0.5
    }
  })

  const elapsed = isRunning ? (Date.now() - task.startTime) / 1000 : task.elapsed
  const elapsedStr = elapsed < 60 ? `${Math.floor(elapsed)}s` : `${Math.floor(elapsed / 60)}m`

  return (
    <>
      {/* Tether */}
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
        <lineBasicMaterial color={color} transparent opacity={0.06} />
      </line>

      <group ref={groupRef}>
        {/* 3D model or fallback cube */}
        {hasModel ? (
          <Suspense fallback={
            <mesh>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
            </mesh>
          }>
            <RobotModel color={color} spinning={isRunning} />
          </Suspense>
        ) : (
          <mesh ref={cubeRef} castShadow>
            <boxGeometry args={[0.25, 0.25, 0.25]} />
            <meshStandardMaterial
              color="#111"
              emissive={color}
              emissiveIntensity={isRunning ? 0.6 : 0.15}
              roughness={0.1} metalness={0.95}
            />
          </mesh>
        )}

        {/* Progress ring */}
        {isRunning && (
          <mesh ref={progressRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.01, 8, 32, Math.PI * 1.5]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} />
          </mesh>
        )}

        {isDone && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.32, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.25} />
          </mesh>
        )}

        {/* Info label */}
        <Html position={[0, 0.55, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#0a0a0aee',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${color}25`,
            borderRadius: 6,
            padding: '3px 8px',
            maxWidth: 130,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#aaa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {task.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 8, color }}>{task.status.toUpperCase()}</span>
              <span style={{ fontSize: 8, color: '#555' }}>{elapsedStr}</span>
            </div>
            <div style={{ fontSize: 7, color: '#444', marginTop: 1 }}>
              {task.model.replace('anthropic/', '').replace('claude-', '')}
            </div>
          </div>
        </Html>
      </group>
    </>
  )
}
