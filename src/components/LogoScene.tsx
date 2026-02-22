/**
 * LogoScene — tiny R3F canvas that renders the Meshy-generated hub logo.
 * Replaces the flat Bot-icon square in the TopBar.
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment } from '@react-three/drei'
import type { Group } from 'three'

function Model() {
  const { scene } = useGLTF('/models/hub-logo.glb')
  const ref = useRef<Group>(null)

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.6
    }
  })

  return (
    <group ref={ref} scale={1.5} position={[0, -0.1, 0]}>
      <primitive object={scene} />
    </group>
  )
}

export function LogoScene() {
  return (
    <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,255,136,0.25)]">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-2, -2, 2]} intensity={0.8} color="#00ff88" />
        <pointLight position={[2, 2, -2]} intensity={0.4} color="#60a5fa" />
        <Suspense fallback={null}>
          <Model />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  )
}

// Preload
useGLTF.preload('/models/hub-logo.glb')
