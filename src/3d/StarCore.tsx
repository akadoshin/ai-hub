import { useRef, Suspense, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Sphere, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentData } from '../store'

/**
 * StarCore — the central star of the system (Eugenio/main agent).
 * Everything orbits around this. It pulses and flares with activity.
 */

function StarModel({ color, intensity }: { color: string; intensity: number }) {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/star.glb')

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = intensity
          mat.needsUpdate = true
        }
      }
    })
  }, [scene, color, intensity])

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.05
    }
  })

  return (
    <group ref={ref} scale={[1.2, 1.2, 1.2]}>
      <primitive object={scene.clone()} />
    </group>
  )
}

interface StarCoreProps {
  agent: AgentData
  selected: boolean
  onClick: () => void
}

export function StarCore({ agent, selected, onClick }: StarCoreProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const coronaRef = useRef<THREE.Mesh>(null)
  const [hasModel, setHasModel] = useState(false)

  const isActive = agent.status === 'active' || agent.status === 'thinking'

  const statusColor = {
    active: '#00ff88', thinking: '#60a5fa', idle: '#335533', error: '#f87171',
  }[agent.status] ?? '#00ff88'

  useEffect(() => {
    fetch('/models/star.glb', { method: 'HEAD' })
      .then(r => setHasModel(r.ok))
      .catch(() => setHasModel(false))
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Corona pulsing
    if (coronaRef.current) {
      const scale = 1 + Math.sin(t * 0.8) * 0.06 + (isActive ? Math.sin(t * 3) * 0.02 : 0)
      coronaRef.current.scale.setScalar(scale)
      const mat = coronaRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = isActive ? 0.12 + Math.sin(t * 2) * 0.04 : 0.05
    }
    // Outer glow breathing
    if (glowRef.current) {
      const s = 1.3 + Math.sin(t * 0.5) * 0.05
      glowRef.current.scale.setScalar(s)
    }
  })

  const modelShort = agent.model.replace('anthropic/', '').replace('claude-', '')

  return (
    <group position={[0, 0, 0]} onClick={onClick}>
      {/* Star light — illuminates nearby planets */}
      <pointLight position={[0, 0, 0]} intensity={2} color={statusColor} distance={30} decay={2} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#ffffff" distance={15} decay={2} />

      {/* 3D model or procedural fallback */}
      {hasModel ? (
        <Suspense fallback={<FallbackStar color={statusColor} active={isActive} />}>
          <StarModel color={statusColor} intensity={isActive ? 0.8 : 0.3} />
        </Suspense>
      ) : (
        <FallbackStar color={statusColor} active={isActive} />
      )}

      {/* Corona — outer glow shell */}
      <Sphere ref={coronaRef} args={[1.3, 32, 32]}>
        <meshBasicMaterial color={statusColor} transparent opacity={0.08} side={THREE.BackSide} />
      </Sphere>

      {/* Outer atmospheric glow */}
      <Sphere ref={glowRef} args={[1.6, 24, 24]}>
        <meshBasicMaterial color={statusColor} transparent opacity={0.03} side={THREE.BackSide} />
      </Sphere>

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8, 1.85, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.3} />
        </mesh>
      )}

      {/* ── Info panel — always visible ── */}
      <Html position={[0, 2, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          textAlign: 'center',
          background: '#08080cdd',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${statusColor}30`,
          borderRadius: 10,
          padding: '8px 14px',
          minWidth: 180,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>☀</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{agent.label}</span>
          </div>

          <StatusBadge status={agent.status} color={statusColor} active={isActive} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', marginTop: 6 }}>
            <Metric label="Model" value={modelShort} highlight />
            <Metric label="Sessions" value={`${agent.activeSessions || 0} / ${agent.sessionCount || 0}`} />
            <Metric label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
            <Metric label="Reasoning" value={agent.reasoningLevel || 'off'} />
          </div>

          {agent.contextTokens && agent.contextTokens > 0 && (
            <ContextBar tokens={agent.contextTokens} color={statusColor} />
          )}
        </div>
      </Html>

      {/* Extended info on click */}
      {selected && (
        <Html position={[2.2, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <DetailPanel agent={agent} color={statusColor} title="STAR — CORE AGENT" />
        </Html>
      )}
    </group>
  )
}

function FallbackStar({ color, active }: { color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.08
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.2) * 0.05
    }
  })
  return (
    <Sphere ref={ref} args={[0.9, 48, 48]} castShadow>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={active ? 1 : 0.3}
        roughness={0.3}
        metalness={0.2}
      />
    </Sphere>
  )
}

function StatusBadge({ status, color, active }: { status: string; color: string; active: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: 10, padding: '2px 10px',
      fontSize: 9, color, fontWeight: 700,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color,
        animation: active ? 'pulse-dot 1.5s infinite' : 'none',
      }} />
      {status.toUpperCase()}
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 8, color: '#555', lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 10, color: highlight ? '#00ff88' : '#ccc', fontWeight: 600, lineHeight: 1.4 }}>{value}</div>
    </div>
  )
}

function ContextBar({ tokens, color }: { tokens: number; color: string }) {
  const pct = Math.min((tokens / 200000) * 100, 100)
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#555', marginBottom: 2 }}>
        <span>Context window</span>
        <span>{(tokens / 1000).toFixed(0)}k / 200k ({Math.round(pct)}%)</span>
      </div>
      <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, opacity: 0.7 }} />
      </div>
    </div>
  )
}

function DetailPanel({ agent, color, title }: { agent: AgentData; color: string; title: string }) {
  return (
    <div style={{
      background: '#0a0a0ef5',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${color}20`,
      borderRadius: 10,
      padding: '12px 16px',
      width: 230,
      boxShadow: '0 8px 30px #00000080',
    }}>
      <div style={{ fontSize: 9, color: '#444', fontWeight: 700, letterSpacing: '0.06em', borderBottom: '1px solid #1a1a1a', paddingBottom: 6, marginBottom: 8 }}>
        {title}
      </div>
      <Row label="Full model" value={agent.model} />
      <Row label="Session key" value={agent.sessionKey || '—'} />
      <Row label="Total sessions" value={String(agent.sessionCount || 0)} />
      <Row label="Active sessions" value={String(agent.activeSessions || 0)} />
      <Row label="Last active" value={agent.lastActivity} />
      <Row label="Context" value={agent.contextTokens ? `${(agent.contextTokens / 1000).toFixed(0)}k / 200k` : '—'} />
      <Row label="Reasoning" value={agent.reasoningLevel || 'off'} />
      <Row label="Description" value={agent.description || '—'} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
      <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 9, color: '#ccc', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{value}</span>
    </div>
  )
}
