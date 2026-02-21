import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import { useMeshyStore } from '../services/meshyStore'
import { AgentSphere } from './AgentSphere'
import { ConnectionBeam } from './ConnectionBeam'
import { GridFloor } from './GridFloor'
import { FloatingParticles } from './FloatingParticles'
import { MeshyModelViewer } from './MeshyModelViewer'

// Layout: arrange agents in a circle + hub in center
function computeAgentPositions(agents: AgentData[]): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>()
  const r = Math.max(2.5, agents.length * 0.8)
  agents.forEach((agent, i) => {
    if (i === 0) {
      positions.set(agent.id, [0, 0, 0])
    } else {
      const angle = ((i - 1) / (agents.length - 1)) * Math.PI * 2
      positions.set(agent.id, [
        r * Math.cos(angle),
        0,
        r * Math.sin(angle),
      ])
    }
  })
  return positions
}

function SceneContent() {
  const { agents, selectedAgent, setSelectedAgent } = useHubStore()
  const { selectedModel } = useMeshyStore()
  const { } = useThree()
  const controlsRef = useRef<any>(null)

  const positions = useMemo(() => computeAgentPositions(agents), [agents])

  const handleAgentClick = useCallback((agent: AgentData, pos: [number, number, number]) => {
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
    // Smoothly move camera toward clicked agent
    const target = new THREE.Vector3(...pos)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(target, 0.5)
    }
  }, [selectedAgent, setSelectedAgent])

  // Build edges: main agent connects to all others
  const edges = useMemo(() => {
    if (agents.length < 2) return []
    const main = agents[0]
    return agents.slice(1).map(agent => ({ from: main.id, to: agent.id }))
  }, [agents])

  return (
    <>
      {/* Environment and lighting */}
      <color attach="background" args={['#0a0a0a']} />
      <fog attach="fog" args={['#0a0a0a', 20, 50]} />
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={1} color="#00ff88" distance={20} />
      <pointLight position={[-10, 3, -10]} intensity={0.3} color="#60a5fa" distance={30} />
      <pointLight position={[10, 3, 10]} intensity={0.3} color="#a855f7" distance={30} />

      {/* Stars background */}
      <Stars radius={80} depth={40} count={3000} factor={2} fade speed={0.5} />

      {/* Grid floor */}
      <GridFloor />

      {/* Floating ambient particles */}
      <FloatingParticles count={200} />

      {/* Connection beams between agents */}
      {edges.map(edge => {
        const fromPos = positions.get(edge.from)
        const toPos = positions.get(edge.to)
        if (!fromPos || !toPos) return null
        const fromAgent = agents.find(a => a.id === edge.from)
        return (
          <ConnectionBeam
            key={`${edge.from}-${edge.to}`}
            start={fromPos}
            end={toPos}
            active={fromAgent?.status === 'active' || fromAgent?.status === 'thinking'}
            color="#00ff88"
          />
        )
      })}

      {/* Agent spheres */}
      {agents.map(agent => {
        const pos = positions.get(agent.id) ?? [0, 0, 0]
        return (
          <AgentSphere
            key={agent.id}
            agent={agent}
            position={pos}
            selected={selectedAgent?.id === agent.id}
            onClick={() => handleAgentClick(agent, pos)}
          />
        )
      })}

      {/* Meshy model display (if any selected) */}
      {selectedModel?.model_urls?.glb && (
        <MeshyModelViewer
          url={selectedModel.model_urls.glb}
          position={[0, -1, -6]}
        />
      )}

      {/* Camera controls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={3}
        maxDistance={25}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate={agents.length > 0}
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

export function HubScene() {
  return (
    <Canvas
      camera={{ position: [0, 4, 10], fov: 60, near: 0.1, far: 100 }}
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0a0a0a' }}
    >
      <PerformanceMonitor
        onDecline={() => {
          // Could reduce quality here if needed
        }}
      />
      <SceneContent />
    </Canvas>
  )
}
