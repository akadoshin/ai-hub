import { Suspense, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { getTask } from '../services/meshy'

// Meshy task IDs for pre-generated assets
const ASSET_TASKS = {
  brain:  '019c8281-6c62-7ab9-9f4a-4f59241898bc',
  server: '019c8281-7690-7e81-8dac-363707a1f179',
  robot:  '019c8281-7bdb-72d6-a300-4628b23c7785',
}

interface AssetURLs {
  brain?: string
  server?: string
  robot?: string
}

function RotatingModel({ url, position, scale = 1 }: { url: string; position: [number, number, number]; scale?: number }) {
  const { scene } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.3
      ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <group ref={ref} position={position} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

export function SceneAssets() {
  const [urls, setUrls] = useState<AssetURLs>({})

  useEffect(() => {
    // Check task status and get GLB URLs
    async function loadAssets() {
      for (const [key, taskId] of Object.entries(ASSET_TASKS)) {
        try {
          const task = await getTask(taskId)
          if (task.status === 'SUCCEEDED' && task.model_urls?.glb) {
            setUrls(prev => ({ ...prev, [key]: task.model_urls!.glb }))
          }
        } catch {
          // Asset not ready yet, ignore
        }
      }
    }

    loadAssets()
    // Retry every 30s if some are missing
    const interval = setInterval(() => {
      loadAssets()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Suspense fallback={null}>
      {/* Position assets around the scene as decorations */}
      {urls.brain && <RotatingModel url={urls.brain} position={[-7, -1.5, -5]} scale={1.2} />}
      {urls.server && <RotatingModel url={urls.server} position={[7, -1.5, -4]} scale={1} />}
      {urls.robot && <RotatingModel url={urls.robot} position={[0, -1.5, -8]} scale={1.2} />}
    </Suspense>
  )
}
