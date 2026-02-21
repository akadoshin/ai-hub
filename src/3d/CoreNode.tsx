import { useRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, MeshDistortMaterial, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

interface CoreNodeProps {
  agent: AgentData
  selected: boolean
  onClick: () => void
}

/** Try to load the Meshy-generated core model */
function CoreModel() {
  try {
    const { scene } = useGLTF('/models/core.glb')
    return <primitive object={scene.clone()} scale={[0.8, 0.8, 0.8]} />
  } catch {
    return null
  }
}

export function CoreNode({ agent, selected, onClick }: CoreNodeProps) {
  const coreRef = useRef<THREE.Mesh>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isThinking = agent.status === 'thinking'

  const statusColor = {
    active: '#00ff88', thinking: '#60a5fa', idle: '#445544', error: '#f87171',
  }[agent.status] ?? '#00ff88'

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 0.6) * 0.02)
      coreRef.current.rotation.y += isThinking ? 0.006 : 0.001
    }
    if (shellRef.current) {
      shellRef.current.rotation.x = t * 0.08
      shellRef.current.rotation.z = t * 0.05
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.15
    }
  })

  const modelShort = agent.model.replace('anthropic/', '').replace('claude-', '')

  return (
    <group position={[0, 0, 0]}>
      {/* Inner glow */}
      <Sphere args={[0.25, 24, 24]}>
        <meshBasicMaterial color={statusColor} transparent opacity={isActive ? 0.3 : 0.1} />
      </Sphere>

      {/* Try Meshy model, fallback to icosahedron */}
      <Suspense fallback={null}>
        <CoreModel />
      </Suspense>

      {/* Core body */}
      <mesh ref={coreRef} onClick={onClick} castShadow>
        <icosahedronGeometry args={[0.55, 3]} />
        <MeshDistortMaterial
          color="#111"
          emissive={statusColor}
          emissiveIntensity={isActive ? 0.35 : 0.08}
          distort={isThinking ? 0.15 : 0.04}
          speed={isThinking ? 2.5 : 0.6}
          roughness={0.15}
          metalness={0.9}
          transparent opacity={0.8}
        />
      </mesh>

      {/* Wireframe structure */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color={statusColor} wireframe transparent opacity={isActive ? 0.12 : 0.04} />
      </mesh>

      {/* Data ring — represents context window usage */}
      {agent.contextTokens && agent.contextTokens > 0 && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.012, 8, 64, Math.PI * 2 * Math.min((agent.contextTokens || 0) / 200000, 1)]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.5} />
        </mesh>
      )}

      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.82, 0.85, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.3} />
        </mesh>
      )}

      {/* ── Always-visible info panel ── */}
      <Html position={[0, 1.1, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center',
          background: '#0a0a0aee',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${statusColor}30`,
          borderRadius: 10,
          padding: '8px 14px',
          minWidth: 160,
        }}>
          {/* Name + status */}
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

          {/* Key metrics — always visible */}
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
            <DetailRow label="Description" value={agent.description || '—'} />
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
