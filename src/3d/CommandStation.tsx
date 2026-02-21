import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * CommandStation — the terminal.glb model placed at the base of the scene.
 * Represents the physical infrastructure (the Raspberry Pi / server).
 * Sits below the core agent, grounding the scene.
 */
function TerminalModel() {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/terminal.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color('#00ff88')
          mat.emissiveIntensity = 0.05
          mat.needsUpdate = true
        }
      }
    })
  }, [scene])

  useFrame(({ clock }) => {
    if (ref.current) {
      // Very slow rotation
      ref.current.rotation.y = clock.elapsedTime * 0.03
    }
  })

  return (
    <group ref={ref} scale={[0.6, 0.6, 0.6]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

export function CommandStation() {
  const [hasModel, setHasModel] = useState(false)

  useEffect(() => {
    fetch('/models/terminal.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  if (!hasModel) return null

  return (
    <group position={[0, -2.2, 0]}>
      <Suspense fallback={null}>
        <TerminalModel />
      </Suspense>
    </group>
  )
}
