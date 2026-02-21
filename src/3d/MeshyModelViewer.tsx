import { Suspense, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.4
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.6) * 0.1
    }
  })

  return (
    <group ref={groupRef} scale={[1.5, 1.5, 1.5]}>
      <primitive object={scene} />
    </group>
  )
}

interface MeshyModelViewerProps {
  url: string
  position?: [number, number, number]
}

export function MeshyModelViewer({ url, position = [0, 0, 0] }: MeshyModelViewerProps) {
  return (
    <group position={position}>
      <Suspense fallback={
        <mesh>
          <octahedronGeometry args={[0.5]} />
          <meshBasicMaterial color="#00ff88" wireframe />
        </mesh>
      }>
        <Model url={url} />
      </Suspense>
      {/* Pedestal glow */}
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 32]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.1} />
      </mesh>
    </group>
  )
}
