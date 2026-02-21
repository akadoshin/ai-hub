import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GridFloor() {
  const glowRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.025 + Math.sin(t * 0.4) * 0.01
    }
    // Radar scan line
    if (scanRef.current) {
      scanRef.current.rotation.y = t * 0.3
      const mat = scanRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.06 + Math.sin(t * 2) * 0.02
    }
  })

  return (
    <group position={[0, -3, 0]}>
      {/* Primary grid */}
      <gridHelper args={[50, 50, '#00ff8822', '#151a15']} />
      {/* Fine grid */}
      <gridHelper args={[50, 150, '#00ff8808', '#0d0f0d']} />

      {/* Center glow */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[8, 64]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.03} />
      </mesh>

      {/* Radar scan plane */}
      <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[25, 0.03]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.08} />
      </mesh>

      {/* Concentric rings */}
      {[3, 6, 10, 15].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[r - 0.01, r, 64]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.04 - i * 0.008} />
        </mesh>
      ))}
    </group>
  )
}
