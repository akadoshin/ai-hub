import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, MeshDistortMaterial, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

interface CoreNodeProps {
  agent: AgentData
  selected: boolean
  onClick: () => void
}

/** Brain model — the AI core representation */
function BrainModel({ color, intensity }: { color: string; intensity: number }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/brain.glb')

  useEffect(() => {
    // Apply emissive material to all meshes in the model
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat && mat.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = intensity
          mat.needsUpdate = true
        }
      }
    })
  }, [scene, color, intensity])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.15
    }
  })

  return (
    <group ref={ref} scale={[0.7, 0.7, 0.7]} position={[0, 0, 0]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

export function CoreNode({ agent, selected, onClick }: CoreNodeProps) {
  const shellRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const [hasModel, setHasModel] = useState(false)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isThinking = agent.status === 'thinking'

  const statusColor = {
    active: '#00ff88', thinking: '#60a5fa', idle: '#445544', error: '#f87171',
  }[agent.status] ?? '#00ff88'

  // Check if brain model exists
  useEffect(() => {
    fetch('/models/brain.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (shellRef.current) {
      shellRef.current.rotation.x = t * 0.06
      shellRef.current.rotation.z = t * 0.04
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.12
    }
  })

  const modelShort = agent.model.replace('anthropic/', '').replace('claude-', '')

  return (
    <group position={[0, 0, 0]} onClick={onClick}>
      {/* 3D Model: brain.glb or fallback icosahedron */}
      {hasModel ? (
        <Suspense fallback={
          <Sphere args={[0.45, 24, 24]}>
            <meshBasicMaterial color={statusColor} wireframe transparent opacity={0.2} />
          </Sphere>
        }>
          <BrainModel color={statusColor} intensity={isActive ? 0.4 : 0.1} />
        </Suspense>
      ) : (
        <>
          <Sphere args={[0.25, 24, 24]}>
            <meshBasicMaterial color={statusColor} transparent opacity={isActive ? 0.3 : 0.1} />
          </Sphere>
          <mesh castShadow>
            <icosahedronGeometry args={[0.55, 3]} />
            <MeshDistortMaterial
              color="#111"
              emissive={statusColor}
              emissiveIntensity={isActive ? 0.35 : 0.08}
              distort={isThinking ? 0.15 : 0.04}
              speed={isThinking ? 2.5 : 0.6}
              roughness={0.15} metalness={0.9}
              transparent opacity={0.8}
            />
          </mesh>
        </>
      )}

      {/* Wireframe shell — always present, shows structure around the model */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshBasicMaterial color={statusColor} wireframe transparent opacity={isActive ? 0.1 : 0.03} />
      </mesh>

      {/* Context ring — shows token usage as arc */}
      {agent.contextTokens && agent.contextTokens > 0 && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.012, 8, 64, Math.PI * 2 * Math.min(agent.contextTokens / 200000, 1)]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.5} />
        </mesh>
      )}

      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.88, 0.91, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.25} />
        </mesh>
      )}

      {/* ── Always-visible info panel ── */}
      <Html position={[0, 1.2, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center',
          background: '#0a0a0aee',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${statusColor}30`,
          borderRadius: 10,
          padding: '8px 14px',
          minWidth: 170,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
            {agent.label}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${statusColor}18`, border: `1px solid ${statusColor}30`,
            borderRadius: 10, padding: '1px 8px',
            fontSize: 9, color: statusColor, fontWeight: 700,
            marginBottom: 6,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: statusColor,
              animation: isActive ? 'pulse-dot 1.5s infinite' : 'none',
            }} />
            {agent.status.toUpperCase()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginTop: 4 }}>
            <Metric label="Model" value={modelShort} color={statusColor} />
            <Metric label="Sessions" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
            <Metric label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
            <Metric label="Reasoning" value={agent.reasoningLevel || 'off'} />
          </div>

          {agent.contextTokens && agent.contextTokens > 0 ? (
            <div style={{ marginTop: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#555', marginBottom: 2 }}>
                <span>Context</span>
                <span>{Math.round((agent.contextTokens / 200000) * 100)}%</span>
              </div>
              <div style={{ height: 2, background: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: statusColor,
                  width: `${Math.min((agent.contextTokens / 200000) * 100, 100)}%`,
                  opacity: 0.6,
                }} />
              </div>
            </div>
          ) : null}
        </div>
      </Html>

      {/* Extended detail on select */}
      {selected && (
        <Html position={[1.5, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#0c0c0cf5',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${statusColor}25`,
            borderRadius: 10,
            padding: '12px 16px',
            width: 220,
            boxShadow: '0 8px 30px #00000080',
          }}>
            <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.06em', borderBottom: '1px solid #1a1a1a', paddingBottom: 6, marginBottom: 8 }}>
              CORE AGENT — DETAILED VIEW
            </div>
            <DetailRow label="Full model" value={agent.model} />
            <DetailRow label="Session key" value={agent.sessionKey || '—'} />
            <DetailRow label="Total sessions" value={String(agent.sessionCount || 0)} />
            <DetailRow label="Active sessions" value={String(agent.activeSessions || 0)} />
            <DetailRow label="Last active" value={agent.lastActivity} />
            <DetailRow label="Context tokens" value={agent.contextTokens ? `${(agent.contextTokens / 1000).toFixed(0)}k / 200k` : '—'} />
            <DetailRow label="Reasoning" value={agent.reasoningLevel || 'off'} />
            <DetailRow label="3D Asset" value={hasModel ? 'brain.glb ✓' : 'procedural fallback'} />
          </div>
        </Html>
      )}
    </group>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 8, color: '#444', lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 10, color: color && label === 'Model' ? color : '#ccc', fontWeight: 600, lineHeight: 1.3 }}>{value}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
      <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 9, color: '#ccc', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{value}</span>
    </div>
  )
}
