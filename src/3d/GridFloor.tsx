import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function GridFloor() {
  const gridRef = useRef<THREE.GridHelper>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.03 + Math.sin(clock.elapsedTime * 0.5) * 0.015
    }
  })

  return (
    <group position={[0, -3, 0]}>
      {/* Main grid */}
      <gridHelper
        ref={gridRef}
        args={[60, 60, '#00ff8833', '#1a2a1a']}
        rotation={[0, 0, 0]}
      />

      {/* Secondary finer grid */}
      <gridHelper
        args={[60, 120, '#00ff8811', '#111']}
      />

      {/* Glow plane beneath grid */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.03} />
      </mesh>

      {/* Horizon fog plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#0f0f0f" transparent opacity={0} />
      </mesh>
    </group>
  )
}
