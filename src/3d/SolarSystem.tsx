import { useRef, useCallback, useMemo, Suspense, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Sphere, Line, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useHubStore } from '../store'
import type { AgentData, Task } from '../store'

// ── Colors ──
const STATUS_COLOR: Record<string, string> = {
  active: '#00ff88',
  thinking: '#60a5fa',
  idle: '#334',
  error: '#f87171',
}

// ── Layout ──
function layoutAgents(agents: AgentData[]): Map<string, [number, number, number]> {
  const m = new Map<string, [number, number, number]>()
  if (agents.length === 0) return m
  m.set(agents[0].id, [0, 0, 0])
  const r = 14
  for (let i = 1; i < agents.length; i++) {
    const a = ((i - 1) / (agents.length - 1)) * Math.PI * 2 - Math.PI / 2
    m.set(agents[i].id, [Math.cos(a) * r, 0, Math.sin(a) * r])
  }
  return m
}

// ── Dot grid background ──
function DotGrid() {
  const points = useMemo(() => {
    const pts: number[] = []
    const spacing = 3
    const range = 60
    for (let x = -range; x <= range; x += spacing) {
      for (let z = -range; z <= range; z += spacing) {
        pts.push(x, -4, z)
      }
    }
    return new Float32Array(pts)
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#1a1a2a" sizeAttenuation transparent opacity={0.6} />
    </points>
  )
}

// ── GLB model loader ──
function MeshyModel({ path, scale = 1, color }: { path: string; scale?: number; color: string }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF(path)

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.2,
          roughness: 0.5,
          metalness: 0.3,
        })
      }
    })
  }, [scene, color])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.08
  })

  return (
    <group ref={ref} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

// ── Planet ──
function Planet({ agent, position, selected, onClick, crons }: {
  agent: AgentData
  position: [number, number, number]
  selected: boolean
  onClick: () => void
  crons: Task[]
}) {
  const ref = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const c = STATUS_COLOR[agent.status] ?? '#334'
  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isMain = agent.id === 'main'
  const size = isMain ? 1.8 : 1.1
  const model = agent.model.replace('anthropic/', '').replace('claude-', '')

  // Check for Meshy model
  const modelPath = isMain ? '/models/star.glb' : `/models/planet-${agent.id}.glb`
  const [hasModel, setHasModel] = useState(false)
  useEffect(() => {
    fetch(modelPath, { method: 'HEAD' }).then(r => setHasModel(r.ok)).catch(() => {})
  }, [modelPath])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ref.current) {
      ref.current.rotation.y += 0.002
      ref.current.position.y = position[1] + Math.sin(t * 0.4 + position[0]) * 0.12
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.08
    }
  })

  // Orbit ring
  const orbitR = Math.sqrt(position[0] ** 2 + position[2] ** 2)

  return (
    <group>
      {/* Orbit trail */}
      {!isMain && orbitR > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[orbitR, 0.008, 8, 128]} />
          <meshBasicMaterial color={c} transparent opacity={0.05} />
        </mesh>
      )}

      <group position={position} onClick={onClick}>
        {/* Planet body — Meshy model or fallback sphere */}
        {hasModel ? (
          <Suspense fallback={<FallbackSphere size={size} color={c} active={isActive} />}>
            <MeshyModel path={modelPath} scale={size * 0.8} color={c} />
          </Suspense>
        ) : (
          <FallbackSphere ref={ref} size={size} color={c} active={isActive} />
        )}

        {/* Atmosphere glow */}
        <Sphere args={[size * 1.12, 24, 24]}>
          <meshBasicMaterial color={c} transparent opacity={isActive ? 0.07 : 0.02} side={THREE.BackSide} />
        </Sphere>

        {/* Selection ring */}
        {selected && (
          <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[size * 1.35, 0.025, 8, 64]} />
            <meshBasicMaterial color={c} transparent opacity={0.5} />
          </mesh>
        )}

        {/* Light for main */}
        {isMain && <pointLight intensity={2} color={c} distance={30} decay={2} />}

        {/* Moons */}
        {crons.map((cron, i) => (
          <Moon key={cron.id} cron={cron} index={i} total={crons.length} planetSize={size} />
        ))}

        {/* Info panel */}
        <Html position={[0, size + 1, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center',
            background: '#08080cdd',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${c}25`,
            borderRadius: 8,
            padding: '6px 12px',
            minWidth: isMain ? 190 : 140,
          }}>
            <div style={{ fontSize: isMain ? 14 : 12, fontWeight: 700, color: '#eee', marginBottom: 3 }}>
              {agent.label}
            </div>
            <Badge status={agent.status} color={c} active={isActive} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginTop: 5 }}>
              <M label="Model" value={model} />
              <M label="Sessions" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
              {isMain && <M label="Reasoning" value={agent.reasoningLevel || 'off'} />}
              {crons.length > 0 && <M label="Crons" value={`${crons.length}`} />}
            </div>
            {agent.contextTokens && agent.contextTokens > 0 && <CtxBar tokens={agent.contextTokens} color={c} />}
          </div>
        </Html>

        {/* Detail on select */}
        {selected && (
          <Html position={[size + 2, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              background: '#0a0a0ef5', border: `1px solid ${c}20`,
              borderRadius: 8, padding: '10px 14px', width: 220,
              boxShadow: '0 4px 20px #00000080',
            }}>
              <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.06em', borderBottom: '1px solid #1a1a1a', paddingBottom: 5, marginBottom: 6 }}>
                {isMain ? 'CORE AGENT' : agent.label.toUpperCase()}
              </div>
              <R label="Model" value={agent.model} />
              <R label="Session key" value={agent.sessionKey || '—'} />
              <R label="Sessions" value={`${agent.activeSessions || 0} active / ${agent.sessionCount || 0} total`} />
              <R label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
              <R label="Last active" value={agent.lastActivity} />
              {agent.contextTokens ? <R label="Context" value={`${(agent.contextTokens / 1000).toFixed(0)}k / 200k`} /> : null}
              <R label="Reasoning" value={agent.reasoningLevel || 'off'} />
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// ── Fallback sphere (when no Meshy model) ──
const FallbackSphere = ({ size, color, active, ref }: { size: number; color: string; active: boolean; ref?: any }) => (
  <Sphere ref={ref} args={[size, 32, 32]}>
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={active ? 0.4 : 0.08}
      roughness={0.5}
      metalness={0.3}
    />
  </Sphere>
)

// ── Moon ──
function Moon({ cron, index, total, planetSize }: { cron: Task; index: number; total: number; planetSize: number }) {
  const ref = useRef<THREE.Group>(null)
  const moonR = planetSize + 1 + index * 0.7
  const speed = 0.3 / (1 + index * 0.2)
  const base = (index / Math.max(total, 1)) * Math.PI * 2
  const isRecent = cron.status === 'running' || (Date.now() - (cron.startTime || 0)) < 3600000
  const mc = cron.status === 'running' ? '#60a5fa' : isRecent ? '#335533' : '#222'

  useFrame(({ clock }) => {
    if (!ref.current) return
    const a = base + clock.elapsedTime * speed
    ref.current.position.set(Math.cos(a) * moonR, 0, Math.sin(a) * moonR)
  })

  return (
    <group ref={ref}>
      <Sphere args={[0.18, 12, 12]}>
        <meshStandardMaterial color={mc} emissive={mc} emissiveIntensity={0.2} roughness={0.7} />
      </Sphere>
      <Html position={[0, 0.32, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#06060acc', borderRadius: 3, padding: '1px 5px',
          fontSize: 8, color: '#666', whiteSpace: 'nowrap',
          maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {cron.label.replace('Cron: ', '')}
        </div>
      </Html>
    </group>
  )
}

// ── Edge ──
function Edge({ from, to, color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
  return <Line points={[from, to]} color={color} lineWidth={1} transparent opacity={0.12} dashed dashSize={0.4} gapSize={0.25} />
}

// ── Scene ──
function Scene() {
  const { agents, tasks, selectedAgent, setSelectedAgent } = useHubStore()
  const positions = useMemo(() => layoutAgents(agents), [agents])

  const handleClick = useCallback((agent: AgentData) => {
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
  }, [selectedAgent, setSelectedAgent])

  const star = agents[0]
  const planets = agents.slice(1)
  const cronTasks = tasks.filter(t => t.type === 'cron')

  return (
    <>
      <color attach="background" args={['#050508']} />
      <fog attach="fog" args={['#050508', 40, 80]} />
      <ambientLight intensity={0.06} />

      {/* Dot grid background */}
      <DotGrid />

      {/* Edges */}
      {star && planets.map(p => {
        const from = positions.get(star.id)
        const to = positions.get(p.id)
        if (!from || !to) return null
        return <Edge key={`e-${p.id}`} from={from} to={to} color={STATUS_COLOR[p.status] ?? '#334'} />
      })}

      {/* Star */}
      {star && (
        <Planet
          agent={star}
          position={positions.get(star.id) ?? [0, 0, 0]}
          selected={selectedAgent?.id === star.id}
          onClick={() => handleClick(star)}
          crons={cronTasks.filter(t => t.parentAgent === 'main' && !planets.some(p => t.label?.toLowerCase().includes(p.id)))}
        />
      )}

      {/* Planets */}
      {planets.map(p => {
        const moons = cronTasks.filter(t => t.parentAgent === p.id)
        const mainMoons = cronTasks.filter(t => t.parentAgent === 'main' && t.label?.toLowerCase().includes(p.id))
        return (
          <Planet
            key={p.id}
            agent={p}
            position={positions.get(p.id) ?? [0, 0, 0]}
            selected={selectedAgent?.id === p.id}
            onClick={() => handleClick(p)}
            crons={[...moons, ...mainMoons]}
          />
        )
      })}

      <OrbitControls
        makeDefault
        minDistance={5}
        maxDistance={50}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
        autoRotate={!selectedAgent}
        autoRotateSpeed={0.12}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

export function HubScene() {
  return (
    <Canvas
      camera={{ position: [0, 10, 22], fov: 55, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
      style={{ background: '#050508' }}
    >
      <Scene />
    </Canvas>
  )
}

// ── Tiny UI ──
function Badge({ status, color, active }: { status: string; color: string; active: boolean }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}15`, border: `1px solid ${color}25`, borderRadius: 10, padding: '1px 8px', fontSize: 9, color, fontWeight: 700 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: color, animation: active ? 'pulse-dot 1.5s infinite' : 'none' }} />{status.toUpperCase()}</div>
}
function M({ label, value }: { label: string; value: string }) {
  return <div style={{ textAlign: 'left' }}><div style={{ fontSize: 8, color: '#555' }}>{label}</div><div style={{ fontSize: 10, color: '#ccc', fontWeight: 600 }}>{value}</div></div>
}
function R({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 6 }}><span style={{ fontSize: 9, color: '#555' }}>{label}</span><span style={{ fontSize: 9, color: '#ccc', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{value}</span></div>
}
function CtxBar({ tokens, color }: { tokens: number; color: string }) {
  const pct = Math.min((tokens / 200000) * 100, 100)
  return <div style={{ marginTop: 5 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#555', marginBottom: 2 }}><span>Context</span><span>{Math.round(pct)}%</span></div><div style={{ height: 2, background: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}><div style={{ height: '100%', background: color, width: `${pct}%`, opacity: 0.6, borderRadius: 1 }} /></div></div>
}
