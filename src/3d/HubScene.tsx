import { useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerformanceMonitor, ContactShadows } from '@react-three/drei'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import { CoreNode } from './CoreNode'
import { SatelliteNode } from './SatelliteNode'
import { WorkerNode } from './WorkerNode'
import { Ground } from './Ground'
import { CommandStation } from './CommandStation'

/**
 * HubScene — the 3D simulation.
 *
 * Layout has meaning:
 * - Center: main agent (CoreNode) — everything flows through it
 * - Inner orbit: persistent satellite agents (Psych, monitors)
 * - Outer ring: ephemeral workers (Opus spawns, tasks)
 *
 * Every visual element represents something real.
 */

function SceneContent() {
  const { agents, tasks, selectedAgent, setSelectedAgent } = useHubStore()

  const handleClick = useCallback((agent: AgentData) => {
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
  }, [selectedAgent, setSelectedAgent])

  // First agent = core, rest = satellites
  const coreAgent = agents[0]
  const satellites = agents.slice(1)

  // Running tasks that aren't tied to a persistent agent = workers
  const workerTasks = tasks.filter(t => t.status === 'running' || t.status === 'completed' || t.status === 'failed')

  return (
    <>
      {/* Environment — dark, clean */}
      <color attach="background" args={['#060608']} />
      <fog attach="fog" args={['#060608', 15, 40]} />

      {/* Lighting — functional, not flashy */}
      <ambientLight intensity={0.06} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={0.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Accent from below — subtle uplighting */}
      <pointLight position={[0, -2, 0]} intensity={0.2} color="#00ff88" distance={10} decay={2} />

      {/* Stars — minimal, far away, just depth cue */}
      <Stars radius={80} depth={50} count={800} factor={2} fade speed={0.2} />

      {/* Ground plane */}
      <Ground />

      {/* Command station — terminal model at base (represents the Pi) */}
      <CommandStation />
      <ContactShadows position={[0, -2.49, 0]} opacity={0.2} scale={20} blur={2} far={8} />

      {/* Core agent — center of everything */}
      {coreAgent && (
        <CoreNode
          agent={coreAgent}
          selected={selectedAgent?.id === coreAgent.id}
          onClick={() => handleClick(coreAgent)}
        />
      )}

      {/* Satellite agents — orbit the core */}
      {satellites.map((agent, i) => (
        <SatelliteNode
          key={agent.id}
          agent={agent}
          index={i}
          totalSatellites={satellites.length}
          selected={selectedAgent?.id === agent.id}
          onClick={() => handleClick(agent)}
        />
      ))}

      {/* Worker tasks — outer ring */}
      {workerTasks.slice(0, 8).map((task, i) => (
        <WorkerNode
          key={task.id}
          task={task}
          index={i}
          totalWorkers={Math.min(workerTasks.length, 8)}
        />
      ))}

      {/* Camera */}
      <OrbitControls
        makeDefault
        minDistance={3}
        maxDistance={18}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate={!selectedAgent}
        autoRotateSpeed={0.2}
        enableDamping
        dampingFactor={0.05}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function HubScene() {
  return (
    <Canvas
      camera={{ position: [0, 4, 8], fov: 55, near: 0.1, far: 100 }}
      shadows
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ background: '#060608' }}
    >
      <PerformanceMonitor />
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  )
}
