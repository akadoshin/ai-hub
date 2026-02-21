import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FloatingParticles({ count = 300 }) {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 30
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20
      velocities[i * 3]     = (Math.random() - 0.5) * 0.002
      velocities[i * 3 + 1] = Math.random() * 0.003 + 0.001  // always drift upward
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002
    }
    return { positions, velocities }
  }, [count])

  useFrame(() => {
    if (!pointsRef.current) return
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += velocities[i * 3]
      pos[i * 3 + 1] += velocities[i * 3 + 1]
      pos[i * 3 + 2] += velocities[i * 3 + 2]
      // Reset particles that drift too high
      if (pos[i * 3 + 1] > 8) {
        pos[i * 3 + 1] = -7
        pos[i * 3]     = (Math.random() - 0.5) * 30
        pos[i * 3 + 2] = (Math.random() - 0.5) * 20
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#00ff88"
        transparent
        opacity={0.25}
        sizeAttenuation
      />
    </points>
  )
}
