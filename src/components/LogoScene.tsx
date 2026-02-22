/**
 * LogoScene — R3F canvas: Meshy AI-core gem (left) + extruded "AI HUB" text (right)
 * Style: dark gunmetal + neon green — matches the app palette
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Text3D, Center } from '@react-three/drei'
import type { Group } from 'three'
import * as THREE from 'three'

// ── Gem model — slow Y rotation + gentle float ──────────────────────────
function GemModel() {
  const { scene } = useGLTF('/models/hub-logo.glb')
  const ref = useRef<Group>(null)
  const t = useRef(0)

  useFrame((_, delta) => {
    t.current += delta
    if (ref.current) {
      ref.current.rotation.y += delta * 0.5
      ref.current.position.y = Math.sin(t.current * 0.9) * 0.06
    }
  })

  return (
    <group ref={ref} position={[-1.6, 0, 0]} scale={1.05}>
      <primitive object={scene} />
    </group>
  )
}

// ── Pulsing green point light behind the gem ─────────────────────────────
function PulseLight() {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.intensity = 1.0 + Math.sin(clock.elapsedTime * 2.2) * 0.5
    }
  })
  return <pointLight ref={ref} position={[-1.6, 0, 1.5]} color="#00ff88" intensity={1.2} distance={6} />
}

// ── "AI HUB" — extruded, neon-green metallic ─────────────────────────────
function HubText() {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.7 + 1) * 0.04
    }
  })

  return (
    <group ref={ref} position={[0.55, 0, 0]}>
      <Center>
        <Text3D
          font="/fonts/helvetiker_bold.json"
          size={0.50}
          depth={0.13}
          curveSegments={10}
          bevelEnabled
          bevelThickness={0.025}
          bevelSize={0.02}
          bevelSegments={4}
        >
          AI HUB
          <meshStandardMaterial
            color="#00ff88"
            metalness={0.8}
            roughness={0.15}
            emissive="#00dd66"
            emissiveIntensity={0.4}
          />
        </Text3D>
      </Center>
    </group>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────
export function LogoScene() {
  return (
    <div
      style={{ width: 215, height: 48 }}
      className="shrink-0 overflow-hidden"
    >
      <Canvas
        // Slight high-angle to show gem facets
        camera={{ position: [0, 0.6, 5.2], fov: 37 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-3, -2, 2]} intensity={0.4} color="#60a5fa" />

        <Suspense fallback={null}>
          <GemModel />
          <PulseLight />
          <HubText />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/hub-logo.glb')
