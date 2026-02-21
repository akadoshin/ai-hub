import { useRef, useMemo, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerformanceMonitor, Html, ContactShadows } from '@react-three/drei'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import { useMeshyStore } from '../services/meshyStore'
import { AgentSphere } from './AgentSphere'
import { ConnectionBeam } from './ConnectionBeam'
import { GridFloor } from './GridFloor'
import { FloatingParticles } from './FloatingParticles'
import { MeshyModelViewer } from './MeshyModelViewer'
import { ProceduralDecor } from './ProceduralDecor'
import { SceneAssets } from './SceneAssets'

function computeAgentPositions(agents: AgentData[]): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>()
  if (agents.length === 0) return positions
  if (agents.length === 1) {
    positions.set(agents[0].id, [0, 0, 0])
    return positions
  }
  // Main agent at center, rest in circle
  const r = Math.max(3, agents.length * 0.9)
  agents.forEach((agent, i) => {
    if (i === 0) {
      positions.set(agent.id, [0, 0, 0])
    } else {
      const angle = ((i - 1) / (agents.length - 1)) * Math.PI * 2 - Math.PI / 2
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
  const controlsRef = useRef<any>(null)

  const positions = useMemo(() => computeAgentPositions(agents), [agents])

  const handleAgentClick = useCallback((agent: AgentData) => {
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
  }, [selectedAgent, setSelectedAgent])

  const edges = useMemo(() => {
    if (agents.length < 2) return []
    const main = agents[0]
    return agents.slice(1).map(agent => ({
      from: main.id,
      to: agent.id,
      active: agent.status === 'active' || agent.status === 'thinking',
    }))
  }, [agents])

  return (
    <>
      {/* Background & atmosphere */}
      <color attach="background" args={['#070709']} />
      <fog attach="fog" args={['#070709', 18, 45]} />

      {/* Lighting — warm key, cool fill, accent rim */}
      <ambientLight intensity={0.08} />
      <directionalLight position={[5, 8, 5]} intensity={0.4} color="#ffffff" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 6, 0]} intensity={0.8} color="#00ff88" distance={25} decay={2} />
      <pointLight position={[-8, 4, -8]} intensity={0.3} color="#3b82f6" distance={25} decay={2} />
      <pointLight position={[8, 4, 8]} intensity={0.2} color="#a855f7" distance={25} decay={2} />

      {/* Star field — subtle, not overwhelming */}
      <Stars radius={60} depth={30} count={1500} factor={2.5} fade speed={0.3} />

      {/* Grid + contact shadows */}
      <GridFloor />
      <ContactShadows position={[0, -2.99, 0]} opacity={0.3} scale={30} blur={2} far={10} color="#00ff88" />

      {/* Ambient particles */}
      <FloatingParticles count={150} />

      {/* Procedural decorations */}
      <ProceduralDecor />

      {/* Connections */}
      {edges.map(edge => {
        const fromPos = positions.get(edge.from)
        const toPos = positions.get(edge.to)
        if (!fromPos || !toPos) return null
        return (
          <ConnectionBeam
            key={`${edge.from}-${edge.to}`}
            start={fromPos}
            end={toPos}
            active={edge.active}
          />
        )
      })}

      {/* Agents */}
      {agents.map(agent => {
        const pos = positions.get(agent.id) ?? [0, 0, 0]
        return (
          <AgentSphere
            key={agent.id}
            agent={agent}
            position={pos}
            selected={selectedAgent?.id === agent.id}
            onClick={() => handleAgentClick(agent)}
          />
        )
      })}

      {/* Pre-generated 3D assets */}
      <SceneAssets />

      {/* Meshy generated model showcase */}
      {selectedModel?.model_urls?.glb && (
        <Suspense fallback={null}>
          <MeshyModelViewer url={selectedModel.model_urls.glb} position={[0, -1, -6]} />
        </Suspense>
      )}

      {/* Empty state */}
      {agents.length === 0 && (
        <Html center position={[0, 0, 0]}>
          <div style={{
            textAlign: 'center', color: '#333',
            pointerEvents: 'none', userSelect: 'none',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#444' }}>Waiting for agents...</div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>Connect to OpenClaw to see live data</div>
          </div>
        </Html>
      )}

      {/* Camera */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        minDistance={4}
        maxDistance={20}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate={!selectedAgent}
        autoRotateSpeed={0.3}
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
      camera={{ position: [0, 5, 9], fov: 55, near: 0.1, far: 100 }}
      shadows
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ background: '#070709' }}
    >
      <PerformanceMonitor />
      <SceneContent />
    </Canvas>
  )
}
