import { useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerformanceMonitor } from '@react-three/drei'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import { StarCore } from './StarCore'
import { PlanetNode } from './PlanetNode'
import { CometNode } from './CometNode'

/**
 * SolarSystem — the entire 3D simulation.
 *
 * Hierarchy (like a real solar system):
 * ☀ Star (center) = main agent (Eugenio)
 *   🪐 Planets (orbiting) = persistent secondary agents (Psych, etc.)
 *     🌙 Moons (orbiting planets) = cron tasks belonging to that agent
 * ☄ Comets (elliptical paths) = ephemeral worker/spawn tasks
 */

function SystemContent() {
  const { agents, tasks, selectedAgent, setSelectedAgent } = useHubStore()

  const handleClick = useCallback((agent: AgentData) => {
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
  }, [selectedAgent, setSelectedAgent])

  // Star = first agent (main)
  const star = agents[0]
  const planets = agents.slice(1)

  // Separate tasks: crons = moons, spawns = comets
  const cronTasks = tasks.filter(t => t.type === 'cron')
  const spawnTasks = tasks.filter(t => t.type !== 'cron')

  return (
    <>
      {/* Deep space */}
      <color attach="background" args={['#030308']} />
      <fog attach="fog" args={['#030308', 30, 80]} />

      {/* Minimal ambient — space is dark */}
      <ambientLight intensity={0.02} />

      {/* Far stars */}
      <Stars radius={100} depth={60} count={2000} factor={3} fade speed={0.15} />

      {/* Star (central agent) */}
      {star && (
        <StarCore
          agent={star}
          selected={selectedAgent?.id === star.id}
          onClick={() => handleClick(star)}
        />
      )}

      {/* Planets (secondary agents) with their moons */}
      {planets.map((planet, i) => {
        // Find crons that belong to this agent
        const moons = cronTasks.filter(t => t.parentAgent === planet.id)
        // Also include crons from main agent that relate to this planet
        const mainCronsForPlanet = cronTasks.filter(
          t => t.parentAgent === 'main' && t.label?.toLowerCase().includes(planet.id)
        )

        return (
          <PlanetNode
            key={planet.id}
            agent={planet}
            index={i}
            totalPlanets={planets.length}
            selected={selectedAgent?.id === planet.id}
            onClick={() => handleClick(planet)}
            crons={[...moons, ...mainCronsForPlanet]}
          />
        )
      })}

      {/* If main has crons that don't belong to any planet, show as moons of the star area */}
      {star && (() => {
        const starCrons = cronTasks.filter(
          t => t.parentAgent === 'main' && !planets.some(p => t.label?.toLowerCase().includes(p.id))
        )
        // Render as small moons near the star
        return starCrons.map((cron, i) => (
          <StarMoon key={cron.id} cron={cron} index={i} total={starCrons.length} />
        ))
      })()}

      {/* Comets (worker/spawn tasks) */}
      {spawnTasks.slice(0, 6).map((task, i) => (
        <CometNode
          key={task.id}
          task={task}
          index={i}
          totalComets={Math.min(spawnTasks.length, 6)}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={40}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.1}
        autoRotate={!selectedAgent}
        autoRotateSpeed={0.1}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0, 0]}
      />
    </>
  )
}

/** Small cron moons that orbit near the star */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere } from '@react-three/drei'
import type { Task } from '../store'

function StarMoon({ cron, index, total }: { cron: Task; index: number; total: number }) {
  const ref = useRef<THREE.Group>(null)
  const radius = 2.5 + index * 0.3
  const speed = 0.2 / (1 + index * 0.15)
  const base = (index / Math.max(total, 1)) * Math.PI * 2

  const isRecent = (Date.now() - (cron.startTime || 0)) < 3600000
  const color = cron.status === 'running' ? '#60a5fa' : isRecent ? '#335533' : '#1a1a1a'

  useFrame(({ clock }) => {
    if (!ref.current) return
    const a = base + clock.elapsedTime * speed
    ref.current.position.set(Math.cos(a) * radius, Math.sin(clock.elapsedTime * 0.3) * 0.1, Math.sin(a) * radius)
  })

  return (
    <group ref={ref}>
      <Sphere args={[0.06, 8, 8]}>
        <meshStandardMaterial color="#1a1a1a" emissive={color} emissiveIntensity={0.3} roughness={0.9} />
      </Sphere>
      <Html position={[0, 0.14, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#050508cc', borderRadius: 3, padding: '1px 4px',
          fontSize: 6, color: '#555', whiteSpace: 'nowrap',
          maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          🌙 {cron.label.replace('Cron: ', '')}
        </div>
      </Html>
    </group>
  )
}

import * as THREE from 'three'

export function HubScene() {
  return (
    <Canvas
      camera={{ position: [0, 8, 15], fov: 55, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ background: '#030308' }}
    >
      <PerformanceMonitor />
      <Suspense fallback={null}>
        <SystemContent />
      </Suspense>
    </Canvas>
  )
}
