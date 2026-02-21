import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ConnectionBeamProps {
  start: [number, number, number]
  end: [number, number, number]
  active?: boolean
  color?: string
}

export function ConnectionBeam({ start, end, active = true, color = '#00ff88' }: ConnectionBeamProps) {
  // beam ref removed
  const particleRef = useRef<THREE.Points>(null)

  // Build a tube from start to end
  const { length } = useMemo(() => {
    const s = new THREE.Vector3(...start)
    const e = new THREE.Vector3(...end)
    const mid = new THREE.Vector3().lerpVectors(s, e, 0.5)
    mid.y += 0.5 // slight arc upward
    const curve = new THREE.QuadraticBezierCurve3(s, mid, e)
    return { points: curve.getPoints(32), length: s.distanceTo(e) }
  }, [start, end])

  const tubeGeometry = useMemo(() => {
    const s = new THREE.Vector3(...start)
    const e = new THREE.Vector3(...end)
    const mid = new THREE.Vector3().lerpVectors(s, e, 0.5)
    mid.y += 0.5
    const curve = new THREE.QuadraticBezierCurve3(s, mid, e)
    return new THREE.TubeGeometry(curve, 32, 0.008, 6, false)
  }, [start, end])

  // Traveling particles along the beam
  const particleData = useMemo(() => {
    const count = Math.ceil(length * 2)
    const positions = new Float32Array(count * 3)
    const offsets = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      offsets[i] = Math.random()
    }
    return { positions, offsets, count }
  }, [length])

  useFrame(({ clock }) => {
    if (!particleRef.current || !active) return
    const t = clock.elapsedTime
    const positions = particleRef.current.geometry.attributes.position.array as Float32Array
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2 + 0.5,
        (start[2] + end[2]) / 2
      ),
      new THREE.Vector3(...end)
    )

    for (let i = 0; i < particleData.count; i++) {
      const tNorm = ((t * 0.3 + particleData.offsets[i]) % 1 + 1) % 1
      const pt = curve.getPoint(tNorm)
      positions[i * 3] = pt.x
      positions[i * 3 + 1] = pt.y
      positions[i * 3 + 2] = pt.z
    }
    particleRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <group>
      {/* Static beam tube */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.25 : 0.06}
        />
      </mesh>

      {/* Traveling particles */}
      {active && (
        <points ref={particleRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particleData.positions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.06}
            color={color}
            transparent
            opacity={0.9}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  )
}
