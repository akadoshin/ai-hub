import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Procedural scene decoration: holographic rings, data pillars, floating glyphs */
export function ProceduralDecor() {
  return (
    <group>
      <HoloRings />
      <DataPillars />
      <FloatingHexagons />
    </group>
  )
}

/** Slowly rotating holographic rings around the scene */
function HoloRings() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.05
  })

  return (
    <group ref={ref} position={[0, 1, 0]}>
      {[5, 7, 9].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2 + i * 0.15, 0, 0]}>
          <torusGeometry args={[r, 0.005, 6, 128]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.06 - i * 0.015} />
        </mesh>
      ))}
    </group>
  )
}

/** Small vertical data pillars at random positions */
function DataPillars() {
  const pillars = useMemo(() => {
    const arr: { x: number; z: number; h: number; delay: number }[] = []
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3
      const r = 8 + Math.random() * 6
      arr.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        h: 0.5 + Math.random() * 2,
        delay: Math.random() * Math.PI * 2,
      })
    }
    return arr
  }, [])

  return (
    <group>
      {pillars.map((p, i) => (
        <Pillar key={i} {...p} />
      ))}
    </group>
  )
}

function Pillar({ x, z, h, delay }: { x: number; z: number; h: number; delay: number }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.elapsedTime + delay
      const scale = 0.5 + Math.sin(t * 0.8) * 0.5
      meshRef.current.scale.y = scale
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.04 + Math.sin(t * 1.2) * 0.03
    }
  })

  return (
    <mesh ref={meshRef} position={[x, -3 + h / 2, z]}>
      <boxGeometry args={[0.06, h, 0.06]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.05} />
    </mesh>
  )
}

/** Floating hexagons that drift slowly */
function FloatingHexagons() {
  const groupRef = useRef<THREE.Group>(null)

  const hexagons = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: number; size: number; speed: number }[] = []
    for (let i = 0; i < 8; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * 20,
          -1 + Math.random() * 6,
          (Math.random() - 0.5) * 16,
        ] as [number, number, number],
        rot: Math.random() * Math.PI,
        size: 0.15 + Math.random() * 0.25,
        speed: 0.1 + Math.random() * 0.3,
      })
    }
    return arr
  }, [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      const hex = hexagons[i]
      if (!hex) return
      child.rotation.z = clock.elapsedTime * hex.speed + hex.rot
      child.position.y = hex.pos[1] + Math.sin(clock.elapsedTime * 0.3 + i) * 0.3
    })
  })

  return (
    <group ref={groupRef}>
      {hexagons.map((hex, i) => (
        <mesh key={i} position={hex.pos} rotation={[Math.PI / 2, 0, hex.rot]}>
          <circleGeometry args={[hex.size, 6]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.04} wireframe />
        </mesh>
      ))}
    </group>
  )
}
