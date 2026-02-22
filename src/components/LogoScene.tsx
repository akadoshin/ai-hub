/**
 * LogoScene — R3F canvas with the Meshy claw model + "AI HUB" Text3D.
 * Replaces both the icon square and the HTML "AI Hub" label in TopBar.
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Text3D, Center } from '@react-three/drei'
import type { Group } from 'three'

// ---------- Claw model (left side, slow rotation) ----------
function ClawModel() {
  const { scene } = useGLTF('/models/hub-logo.glb')
  const ref = useRef<Group>(null)

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.55
  })

  return (
    <group ref={ref} position={[-1.8, 0, 0]} scale={1.0}>
      <primitive object={scene} />
    </group>
  )
}

// ---------- "AI HUB" extruded text (right side, subtle bob) ----------
function HubText() {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04
    }
  })

  return (
    <group ref={ref} position={[0.5, 0, 0]}>
      <Center>
        <Text3D
          font="/fonts/helvetiker_bold.json"
          size={0.52}
          depth={0.14}
          curveSegments={12}
          bevelEnabled
          bevelThickness={0.03}
          bevelSize={0.025}
          bevelSegments={4}
        >
          AI HUB
          <meshStandardMaterial
            color="#00ff88"
            metalness={0.75}
            roughness={0.18}
            emissive="#00cc66"
            emissiveIntensity={0.35}
          />
        </Text3D>
      </Center>
    </group>
  )
}

// ---------- Full scene ----------
export function LogoScene() {
  return (
    // width covers model + text; height matches TopBar h-14 = 56px minus padding
    <div
      style={{ width: 210, height: 46 }}
      className="shrink-0 overflow-hidden"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[4, 5, 4]} intensity={1.8} color="#ffffff" />
        <pointLight position={[-3, 1, 3]} intensity={1.2} color="#00ff88" />
        <pointLight position={[3, -1, 2]} intensity={0.5} color="#60a5fa" />

        <Suspense fallback={null}>
          <ClawModel />
          <HubText />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/hub-logo.glb')
