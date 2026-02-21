import { Suspense, useEffect, useState, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Local paths (downloaded from Meshy, served by Vite from /public)
const LOCAL_ASSETS = {
  brain: '/models/019c8281-6c62-7ab9-9f4a-4f59241898bc.glb',
  robot: '/models/019c8281-7bdb-72d6-a300-4628b23c7785.glb',
  // server: will be added when ready
}

function RotatingModel({ url, position, scale = 1, label: _label }: {
  url: string; position: [number, number, number]; scale?: number; label?: string
}) {
  const { scene } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.25
      ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5) * 0.08
    }
  })

  return (
    <group ref={ref} position={position} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
      {/* Pedestal glow */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.06} />
      </mesh>
    </group>
  )
}

// Preload
Object.values(LOCAL_ASSETS).forEach(url => {
  try { useGLTF.preload(url) } catch {}
})

export function SceneAssets() {
  const [available, setAvailable] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Check which local files exist
    async function check() {
      for (const [key, url] of Object.entries(LOCAL_ASSETS)) {
        try {
          const res = await fetch(url, { method: 'HEAD' })
          if (res.ok) setAvailable(prev => ({ ...prev, [key]: true }))
        } catch {}
      }
    }
    check()
  }, [])

  return (
    <Suspense fallback={null}>
      {available.brain && (
        <RotatingModel url={LOCAL_ASSETS.brain} position={[-7, -1.5, -5]} scale={1.5} label="AI Core" />
      )}
      {available.robot && (
        <RotatingModel url={LOCAL_ASSETS.robot} position={[0, -1.5, -8]} scale={1.5} label="Agent" />
      )}
    </Suspense>
  )
}
