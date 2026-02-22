import { useRef, useCallback, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useHubStore } from '../store'
import type { AgentData, Task } from '../store'
import { Card3D } from '../ui/3d-card'

// ── Palette ──
const STATUS_COLOR: Record<string, string> = {
  active: '#00ff88',
  thinking: '#60a5fa',
  idle: '#3a3a50',
  error: '#f87171',
}
const STATUS_COLOR2: Record<string, string> = {
  active: '#003318',
  thinking: '#0a0a3a',
  idle: '#151520',
  error: '#3a0a0a',
}

const ORBIT_RADII = [0, 12, 22, 32, 42]

function layoutAgents(agents: AgentData[]): Map<string, { pos: [number, number, number]; orbit: number }> {
  const m = new Map<string, { pos: [number, number, number]; orbit: number }>()
  if (agents.length === 0) return m
  m.set(agents[0].id, { pos: [0, 0, 0], orbit: 0 })
  for (let i = 1; i < agents.length; i++) {
    const r = ORBIT_RADII[i] ?? 12 + i * 10
    const a = ((i - 1) / Math.max(agents.length - 1, 1)) * Math.PI * 2 - Math.PI / 2
    m.set(agents[i].id, { pos: [Math.cos(a) * r, 0, Math.sin(a) * r], orbit: r })
  }
  return m
}

// ════════════════════════════════════════════
// SKETCH GRID
// ════════════════════════════════════════════

const gridDotVert = `
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (100.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`
const gridDotFrag = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float dot = smoothstep(0.5, 0.0, d);
    float glow = exp(-d * d * 3.0) * 0.4;
    float a = (dot + glow) * vAlpha;
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`

function SketchGrid() {
  const { positions, alphas, sizes } = useMemo(() => {
    const pts: number[] = [], als: number[] = [], szs: number[] = []
    const sp = 3, range = 80
    for (let x = -range; x <= range; x += sp) {
      for (let z = -range; z <= range; z += sp) {
        pts.push(x, -0.1, z)
        const dist = Math.sqrt(x * x + z * z)
        const fade = Math.max(0.15, 1 - dist / range)
        const isMajor = Math.abs(x % (sp * 4)) < 0.1 && Math.abs(z % (sp * 4)) < 0.1
        const isMid = Math.abs(x % (sp * 4)) < 0.1 || Math.abs(z % (sp * 4)) < 0.1
        als.push(isMajor ? fade * 1.2 : isMid ? fade * 0.6 : fade * 0.3)
        szs.push(isMajor ? 4.5 : isMid ? 2.8 : 1.8)
      }
    }
    return { positions: new Float32Array(pts), alphas: new Float32Array(als), sizes: new Float32Array(szs) }
  }, [])
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#445566') } }), [])
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aAlpha" args={[alphas, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial vertexShader={gridDotVert} fragmentShader={gridDotFrag} uniforms={uniforms} transparent depthWrite={false} />
    </points>
  )
}

function SketchGridLines() {
  const lines = useMemo(() => {
    const segs: THREE.Vector3[][] = []
    const range = 80, sp = 12
    for (let x = -range; x <= range; x += sp) {
      const pts: THREE.Vector3[] = []
      for (let z = -range; z <= range; z += 2.5) {
        pts.push(new THREE.Vector3(x + Math.sin(x * 3.7 + z * 0.5) * 0.02, -0.1, z))
      }
      segs.push(pts)
    }
    for (let z = -range; z <= range; z += sp) {
      const pts: THREE.Vector3[] = []
      for (let x = -range; x <= range; x += 2.5) {
        pts.push(new THREE.Vector3(x, -0.1, z + Math.sin(z * 2.3 + x * 0.7) * 0.02))
      }
      segs.push(pts)
    }
    return segs
  }, [])
  return <group>{lines.map((pts, i) => <Line key={i} points={pts} color="#334455" lineWidth={0.6} transparent opacity={0.12} />)}</group>
}

// ════════════════════════════════════════════
// ORBIT RINGS
// ════════════════════════════════════════════

function SketchOrbitRing({ radius, color, active }: { radius: number; color: string; active: boolean }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2
      const w = Math.sin(a * 12) * 0.08 + Math.sin(a * 7.3) * 0.05
      pts.push(new THREE.Vector3(Math.cos(a) * (radius + w), 0, Math.sin(a) * (radius + w)))
    }
    return pts
  }, [radius])
  return <Line points={points} color={color} lineWidth={active ? 1.2 : 0.8} transparent opacity={active ? 0.25 : 0.1} dashed dashSize={1.2} gapSize={0.6} />
}

// ════════════════════════════════════════════
// LIQUID CORE SHADER
// ════════════════════════════════════════════

const liquidVert = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;
  varying float vNoise;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    vNormal=normal;
    vPos=position;
    float n1=snoise(position*1.5+uTime*0.6);
    float n2=snoise(position*3.0-uTime*0.3)*0.5;
    float n3=snoise(position*6.0+uTime*1.2)*0.15;
    float n=n1+n2+n3;
    vNoise=n;
    float d=n*uIntensity;
    vDisp=d;
    vec3 np=position+normal*d;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(np,1.0);
  }
`

const liquidFrag = `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;
  varying float vNoise;

  void main(){
    vec3 viewDir=normalize(cameraPosition-vPos);
    float fresnel=pow(1.0-max(dot(viewDir,vNormal),0.0),3.0);

    // Multi-color blend based on noise + displacement
    float t=vNoise*0.5+0.5;
    vec3 base=mix(uColor2,uColor,clamp(t,0.0,1.0));

    // Add bright veins where noise is high
    float vein=smoothstep(0.4,0.7,t)*0.6;
    base+=uColor*vein;

    // Fresnel rim glow
    base+=fresnel*uColor*1.2;

    // Pulse
    float pulse=sin(uTime*2.0)*0.08+0.92;
    base*=pulse;

    // Brighter when more intense (active)
    base*=(0.7+uIntensity*2.0);

    float alpha=0.9+fresnel*0.1;
    gl_FragColor=vec4(base,alpha);
  }
`

// ════════════════════════════════════════════
// PLANET COMPONENTS
// ════════════════════════════════════════════

function LiquidCore({ size, color, color2, active }: {
  size: number; color: string; color2: string; active: boolean
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uIntensity: { value: 0 },
    uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(color2) },
  }), [])
  useMemo(() => { uniforms.uColor.value.set(color); uniforms.uColor2.value.set(color2) }, [color, color2])
  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.elapsedTime
    const target = active ? 0.35 : 0.03
    matRef.current.uniforms.uIntensity.value += (target - matRef.current.uniforms.uIntensity.value) * 0.04
  })
  return (
    <mesh>
      <icosahedronGeometry args={[size * 0.62, 5]} />
      <shaderMaterial ref={matRef} vertexShader={liquidVert} fragmentShader={liquidFrag} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  )
}

// Multi-layer wireframe shell
function WireframeShell({ size, color, active }: { size: number; color: string; active: boolean }) {
  const outerRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (outerRef.current) {
      outerRef.current.rotation.y = t * 0.03
      outerRef.current.rotation.x = Math.sin(t * 0.02) * 0.12
      outerRef.current.rotation.z = Math.cos(t * 0.015) * 0.06
    }
    if (innerRef.current) {
      // Counter-rotate for visual depth
      innerRef.current.rotation.y = -t * 0.02
      innerRef.current.rotation.z = Math.sin(t * 0.03) * 0.1
    }
  })

  const outerOpacity = hovered ? 0.55 : active ? 0.35 : 0.14
  const midOpacity = hovered ? 0.25 : active ? 0.1 : 0.04
  const innerOpacity = active ? 0.06 : 0.02

  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Outer — low poly icosahedron, bold lines */}
      <group ref={outerRef}>
        <mesh>
          <icosahedronGeometry args={[size, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={outerOpacity} />
        </mesh>
      </group>
      {/* Mid — counter-rotating, medium detail */}
      <group ref={innerRef}>
        <mesh>
          <icosahedronGeometry args={[size * 0.88, 2]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={midOpacity} />
        </mesh>
      </group>
      {/* Inner — high detail, very subtle */}
      <mesh>
        <icosahedronGeometry args={[size * 0.76, 3]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={innerOpacity} />
      </mesh>
    </group>
  )
}

// Orbital ring around planet (equatorial)
function PlanetRing({ size, color, active }: { size: number; color: string; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.05
  })
  return (
    <mesh ref={ref} rotation={[Math.PI * 0.45, 0, 0]}>
      <torusGeometry args={[size * 1.3, 0.02, 8, 80]} />
      <meshBasicMaterial color={color} transparent opacity={active ? 0.2 : 0.06} />
    </mesh>
  )
}

// ── Planet ──
function Planet({ agent, position, orbit, selected, onClick, onDoubleClick, crons, connections }: {
  agent: AgentData; position: [number, number, number]; orbit: number
  selected: boolean; onClick: () => void; onDoubleClick?: () => void; crons: Task[]; connections?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const selRingRef = useRef<THREE.Mesh>(null)
  const c = STATUS_COLOR[agent.status] ?? '#334'
  const c2 = STATUS_COLOR2[agent.status] ?? '#151520'
  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isMain = agent.id === 'main'
  const size = isMain ? 2.8 : 1.5
  const model = agent.model.replace('anthropic/', '').replace('claude-', '')

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 0.35 + position[0]) * 0.2
      // Gentle planet rotation
      groupRef.current.rotation.y = t * 0.008
    }
    if (selRingRef.current) selRingRef.current.rotation.z = t * 0.12
  })

  return (
    <group>
      <group ref={groupRef} position={position} onClick={onClick} onDoubleClick={onDoubleClick}>
        {/* Wireframe shell — multi-layer */}
        <WireframeShell size={size} color={c} active={isActive} />

        {/* Liquid blob core */}
        <LiquidCore size={size} color={c} color2={c2} active={isActive} />

        {/* Hot center glow */}
        <Sphere args={[size * 0.15, 12, 12]}>
          <meshBasicMaterial color={c} transparent opacity={isActive ? 0.7 : 0.2} />
        </Sphere>
        {/* Center point light */}
        <Sphere args={[size * 0.08, 8, 8]}>
          <meshBasicMaterial color="#fff" transparent opacity={isActive ? 0.5 : 0.1} />
        </Sphere>

        {/* Atmosphere layers */}
        <Sphere args={[size * 1.15, 32, 32]}>
          <meshBasicMaterial color={c} transparent opacity={isActive ? 0.05 : 0.012} side={THREE.BackSide} />
        </Sphere>
        <Sphere args={[size * 1.35, 24, 24]}>
          <meshBasicMaterial color={c} transparent opacity={isActive ? 0.02 : 0.005} side={THREE.BackSide} />
        </Sphere>

        {/* Equatorial ring */}
        <PlanetRing size={size} color={c} active={isActive} />

        {/* Selection ring */}
        {selected && (
          <group>
            <mesh ref={selRingRef} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 1.5, 0.04, 8, 80]} />
              <meshBasicMaterial color={c} transparent opacity={0.6} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 1.55, 0.015, 8, 80]} />
              <meshBasicMaterial color={c} transparent opacity={0.25} />
            </mesh>
          </group>
        )}

        {/* Lighting */}
        <pointLight intensity={isMain ? 2.5 : 0.5} color={c} distance={isMain ? 50 : 15} decay={2} />

        {/* Moons */}
        {crons.map((cron, i) => (
          <Moon key={cron.id} cron={cron} index={i} total={crons.length} planetSize={size} />
        ))}

        {/* Info label */}
        <Html position={[0, size + 1.6, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            textAlign: 'center', background: '#060609e8', backdropFilter: 'blur(12px)',
            border: `1px solid ${c}30`, borderRadius: 6, padding: '6px 14px',
            minWidth: isMain ? 200 : 150, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>
            <div style={{ fontSize: isMain ? 13 : 11, fontWeight: 700, color: '#eee', marginBottom: 4, letterSpacing: '0.04em' }}>
              {agent.label}
            </div>
            <StatusBadge status={agent.status} color={c} active={isActive} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px', marginTop: 6 }}>
              <Stat label="MODEL" value={model} />
              <Stat label="SESSIONS" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
              {isMain && <Stat label="REASONING" value={agent.reasoningLevel || 'off'} />}
              {crons.length > 0 && <Stat label="CRONS" value={`${crons.length}`} />}
              {(connections ?? 0) > 0 && <Stat label="LINKS" value={`${connections}`} />}
            </div>
            {agent.contextTokens && agent.contextTokens > 0 && <CtxBar tokens={agent.contextTokens} color={c} />}
          </div>
        </Html>

        {/* Detail panel */}
        {selected && (
          <Html position={[size + 3.5, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              background: '#08080cf0', border: `1px solid ${c}22`, borderRadius: 6,
              padding: '10px 14px', width: 230, boxShadow: `0 0 30px ${c}10`,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              <div style={{ fontSize: 9, color: c, fontWeight: 700, letterSpacing: '0.1em', borderBottom: `1px solid ${c}15`, paddingBottom: 5, marginBottom: 6 }}>
                {isMain ? '● CORE AGENT' : `● ${agent.label.toUpperCase()}`}
              </div>
              <Detail label="Model" value={agent.model} />
              <Detail label="Session" value={agent.sessionKey || '—'} />
              <Detail label="Sessions" value={`${agent.activeSessions || 0} active / ${agent.sessionCount || 0} total`} />
              <Detail label="Messages" value={agent.messageCount > 0 ? `~${agent.messageCount}` : '—'} />
              <Detail label="Last active" value={agent.lastActivity} />
              {agent.contextTokens ? <Detail label="Context" value={`${(agent.contextTokens / 1000).toFixed(0)}k / 200k`} /> : null}
              <Detail label="Reasoning" value={agent.reasoningLevel || 'off'} />
              <Detail label="Orbit" value={`${orbit} units`} />
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// ── Moon ──
function Moon({ cron, index, total, planetSize }: {
  cron: Task; index: number; total: number; planetSize: number
}) {
  const ref = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const moonR = planetSize + 2.0 + index * 1.0
  const speed = 0.3 / (1 + index * 0.15)
  const base = (index / Math.max(total, 1)) * Math.PI * 2
  const isRunning = cron.status === 'running'
  const mc = isRunning ? '#60a5fa' : '#2a3a2a'
  const tilt = 0.15 + index * 0.1

  useFrame(({ clock }) => {
    if (!ref.current) return
    const a = base + clock.elapsedTime * speed
    ref.current.position.set(
      Math.cos(a) * moonR,
      Math.sin(a * 0.5) * tilt,
      Math.sin(a) * moonR
    )
    if (shellRef.current) shellRef.current.rotation.y = clock.elapsedTime * 0.1
  })

  // Moon orbit ring (relative to parent planet)
  const orbitPts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * moonR, Math.sin(a * 0.5) * tilt, Math.sin(a) * moonR))
    }
    return pts
  }, [moonR, tilt])

  return (
    <group>
      {/* Moon orbit path */}
      <Line points={orbitPts} color={mc} lineWidth={0.5} transparent opacity={isRunning ? 0.15 : 0.05} dashed dashSize={0.3} gapSize={0.2} />

      <group ref={ref}>
        {/* Wireframe shell */}
        <mesh ref={shellRef}>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshBasicMaterial color={mc} wireframe transparent opacity={isRunning ? 0.55 : 0.2} />
        </mesh>
        {/* Inner glow */}
        <Sphere args={[0.14, 8, 8]}>
          <meshBasicMaterial color={mc} transparent opacity={isRunning ? 0.7 : 0.15} />
        </Sphere>
        {/* Tiny atmosphere */}
        {isRunning && (
          <Sphere args={[0.38, 8, 8]}>
            <meshBasicMaterial color={mc} transparent opacity={0.04} side={THREE.BackSide} />
          </Sphere>
        )}
        {/* Label */}
        <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#06060ae0', borderRadius: 3, padding: '1px 5px',
            fontSize: 7, color: isRunning ? '#88bbff' : '#555', whiteSpace: 'nowrap',
            fontFamily: "'JetBrains Mono', monospace",
            maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {cron.label.replace('Cron: ', '')}
          </div>
        </Html>
      </group>
    </group>
  )
}

// ── Comet (worker/spawn) ──
function Comet({ task, index }: { task: Task; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const groupRef = useRef<THREE.Group>(null)
  const isRunning = task.status === 'running'
  const c = isRunning ? '#60a5fa' : task.status === 'failed' ? '#f87171' : '#3a3a55'

  const traj = useMemo(() => ({
    radius: 25 + index * 5,
    speed: 0.1 + Math.random() * 0.06,
    phase: index * 2.5,
    yOff: (Math.random() - 0.5) * 3,
    ecc: 0.4 + Math.random() * 0.3,
    tilt: (Math.random() - 0.5) * 0.4,
  }), [index])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime * traj.speed + traj.phase
    groupRef.current.position.set(
      Math.cos(t) * traj.radius,
      traj.yOff + Math.sin(t * 0.5) * 1.5 + Math.sin(t * 0.3) * traj.tilt,
      Math.sin(t) * traj.radius * traj.ecc
    )
    // Point comet along trajectory
    const dx = -Math.sin(t) * traj.radius * traj.speed
    const dz = Math.cos(t) * traj.radius * traj.ecc * traj.speed
    groupRef.current.rotation.y = Math.atan2(dx, dz)
  })

  return (
    <group ref={groupRef}>
      {/* Comet head */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshBasicMaterial color={c} wireframe transparent opacity={isRunning ? 0.7 : 0.25} />
      </mesh>
      <Sphere args={[0.1, 6, 6]}>
        <meshBasicMaterial color={c} transparent opacity={isRunning ? 0.9 : 0.3} />
      </Sphere>
      {/* Tail (stretched glow behind) */}
      {isRunning && (
        <>
          <mesh position={[0, 0, 0.4]}>
            <coneGeometry args={[0.12, 1.2, 6]} />
            <meshBasicMaterial color={c} transparent opacity={0.08} />
          </mesh>
          <mesh position={[0, 0, 0.8]}>
            <coneGeometry args={[0.08, 1.5, 6]} />
            <meshBasicMaterial color={c} transparent opacity={0.04} />
          </mesh>
          <Sphere args={[0.35, 8, 8]}>
            <meshBasicMaterial color={c} transparent opacity={0.06} />
          </Sphere>
        </>
      )}
      {/* Label */}
      <Html position={[0, 0.45, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#06060ae0', borderRadius: 3, padding: '1px 6px',
          fontSize: 8, color: isRunning ? '#88bbff' : '#444',
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.label}
        </div>
      </Html>
    </group>
  )
}

// ── Connection ──
function SketchConnection({ from, to, color, active, label }: {
  from: [number, number, number]; to: [number, number, number]
  color: string; active?: boolean; label?: string
}) {
  const pulseRef = useRef<THREE.Group>(null)
  const pulse2Ref = useRef<THREE.Group>(null)
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2 + Math.sin(from[0] * 1.3) * 0.4,
    (from[1] + to[1]) / 2 + 0.3,
    (from[2] + to[2]) / 2 + Math.cos(to[2] * 0.7) * 0.4,
  ]

  useFrame(({ clock }) => {
    if (!active) return
    const t1 = (clock.elapsedTime * 0.4) % 1
    if (pulseRef.current) {
      pulseRef.current.position.set(
        from[0] + (to[0] - from[0]) * t1,
        from[1] + (to[1] - from[1]) * t1 + Math.sin(t1 * Math.PI) * 0.5,
        from[2] + (to[2] - from[2]) * t1,
      )
    }
    // Second pulse offset
    const t2 = (clock.elapsedTime * 0.4 + 0.5) % 1
    if (pulse2Ref.current) {
      pulse2Ref.current.position.set(
        from[0] + (to[0] - from[0]) * t2,
        from[1] + (to[1] - from[1]) * t2 + Math.sin(t2 * Math.PI) * 0.5,
        from[2] + (to[2] - from[2]) * t2,
      )
    }
  })

  return (
    <group>
      <Line
        points={[from, mid, to]}
        color={active ? color : '#3a3a4a'}
        lineWidth={active ? 1.2 : 0.7}
        transparent opacity={active ? 0.35 : 0.12}
        dashed dashSize={active ? 0.5 : 1.0} gapSize={active ? 0.3 : 0.8}
      />
      {active && (
        <>
          <group ref={pulseRef}>
            <Sphere args={[0.14, 6, 6]}>
              <meshBasicMaterial color={color} transparent opacity={0.9} />
            </Sphere>
            <Sphere args={[0.3, 8, 8]}>
              <meshBasicMaterial color={color} transparent opacity={0.1} />
            </Sphere>
          </group>
          <group ref={pulse2Ref}>
            <Sphere args={[0.08, 6, 6]}>
              <meshBasicMaterial color={color} transparent opacity={0.6} />
            </Sphere>
          </group>
        </>
      )}
      {active && label && (
        <Html position={mid} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#060609dd', borderRadius: 3, padding: '1px 6px',
            fontSize: 7, color: `${color}aa`, fontFamily: "'JetBrains Mono', monospace",
            whiteSpace: 'nowrap', border: `1px solid ${color}15`,
          }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ── Ambient particles (subtle floating dust) ──
function AmbientDust() {
  const ref = useRef<THREE.Points>(null)
  const { positions } = useMemo(() => {
    const pts: number[] = [], als: number[] = []
    for (let i = 0; i < 300; i++) {
      pts.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 100)
      als.push(Math.random() * 0.3 + 0.05)
    }
    return { positions: new Float32Array(pts), alphas: new Float32Array(als) }
  }, [])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.002
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#556677" sizeAttenuation transparent opacity={0.3} />
    </points>
  )
}

// ════════════════════════════════════════════
// SCENE
// ════════════════════════════════════════════

// ── Camera Controller — smooth lerp to target ──
function CameraController({ target, distance, enabled }: {
  target: [number, number, number] | null; distance: number; enabled: boolean
}) {
  const controlsRef = useRef<any>(null)
  const targetVec = useRef(new THREE.Vector3(0, 0, 0))
  const posVec = useRef(new THREE.Vector3(0, 16, 30))

  useFrame(({ camera }) => {
    if (!target || !controlsRef.current) return

    // Lerp target
    targetVec.current.lerp(new THREE.Vector3(...target), 0.04)
    controlsRef.current.target.copy(targetVec.current)

    // Lerp camera position to orbit around target
    const desired = new THREE.Vector3(
      target[0] + distance * 0.3,
      target[1] + distance * 0.6,
      target[2] + distance * 0.8,
    )
    posVec.current.lerp(desired, 0.04)
    camera.position.copy(posVec.current)

    controlsRef.current.update()
  })

  return (
    <OrbitControls ref={controlsRef} makeDefault
      minDistance={enabled ? 3 : 6} maxDistance={enabled ? 12 : 70}
      minPolarAngle={0.15} maxPolarAngle={Math.PI - 0.15}
      autoRotate={!enabled} autoRotateSpeed={enabled ? 0.2 : 0.08}
      enableDamping dampingFactor={0.04} />
  )
}

// ── Detail Panels — orbiting info cards around focused planet ──
function DetailPanels({ detail, size, color }: {
  detail: any; size: number; color: string
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.02
  })

  if (!detail) return null

  const panels: { title: string; icon: string; content: string; angle: number }[] = []
  const r = size + 4

  if (detail.files.soul) panels.push({ title: 'SOUL', icon: '🧬', content: detail.files.soul, angle: 0 })
  if (detail.files.memory) panels.push({ title: 'MEMORY', icon: '🧠', content: detail.files.memory, angle: 1 })
  if (detail.files.identity) panels.push({ title: 'IDENTITY', icon: '🪪', content: detail.files.identity, angle: 2 })
  if (detail.files.tools) panels.push({ title: 'TOOLS', icon: '🔧', content: detail.files.tools, angle: 3 })
  if (detail.files.agents) panels.push({ title: 'AGENTS.MD', icon: '📋', content: detail.files.agents, angle: 4 })
  if (detail.files.user) panels.push({ title: 'USER', icon: '👤', content: detail.files.user, angle: 5 })
  if (detail.files.heartbeat) panels.push({ title: 'HEARTBEAT', icon: '💓', content: detail.files.heartbeat, angle: 6 })

  // Add sessions panel
  if (detail.sessions?.length > 0) {
    const sessText = detail.sessions.slice(0, 8).map((s: any) =>
      `${s.type === 'main' ? '●' : s.type === 'cron' ? '◐' : '◌'} ${s.label} [${s.model.replace('claude-','')}] — ${s.lastActivity}`
    ).join('\n')
    panels.push({ title: 'SESSIONS', icon: '📡', content: sessText, angle: panels.length })
  }

  // Add recent memories
  if (detail.recentMemories?.length > 0) {
    const memText = detail.recentMemories.map((m: any) =>
      `── ${m.date} ──\n${m.preview?.slice(0, 300) || '(empty)'}`
    ).join('\n\n')
    panels.push({ title: 'RECENT LOGS', icon: '📝', content: memText, angle: panels.length })
  }

  // Stats panel
  const statsText = [
    `Sessions: ${detail.stats.totalSessions} (${detail.stats.activeSessions} active)`,
    `Crons: ${detail.stats.cronCount}`,
    `Spawns: ${detail.stats.spawnCount}`,
    `Workspace files: ${detail.stats.fileCount}`,
    `\nFiles:\n${detail.workspaceFiles?.slice(0, 15).map((f: any) => `  ${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n') || '(none)'}`,
  ].join('\n')
  panels.push({ title: 'OVERVIEW', icon: '📊', content: statsText, angle: panels.length })

  const totalPanels = panels.length
  const angleStep = (Math.PI * 2) / totalPanels

  return (
    <group ref={groupRef}>
      {panels.map((panel, i) => {
        const a = i * angleStep
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        return (
          <group key={panel.title} position={[x, 0, z]}>
            {/* Wireframe card frame */}
            <mesh rotation={[0, -a + Math.PI / 2, 0]}>
              <planeGeometry args={[0.1, 0.1]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            <Html center style={{ pointerEvents: 'auto', userSelect: 'text' }}
              rotation={[0, -a + Math.PI / 2, 0]}
              position={[0, 1, 0]}>
              <Card3D glowColor={color} className="group">
                <div style={{
                  width: 260, maxHeight: 320, overflow: 'auto',
                  background: '#080810f0', border: `1px solid ${color}25`,
                  borderRadius: 12, padding: '10px 14px',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: `0 0 20px ${color}08`,
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${color}30 transparent`,
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}>
                  <div style={{
                    fontSize: 10, color, fontWeight: 700, letterSpacing: '0.1em',
                    borderBottom: `1px solid ${color}20`, paddingBottom: 4, marginBottom: 6,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{panel.icon}</span>
                    {panel.title}
                  </div>
                  <pre style={{
                    fontSize: 8, color: '#aaa', margin: 0, whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word', lineHeight: 1.5,
                  }}>
                    {panel.content.slice(0, 1500)}
                  </pre>
                </div>
              </Card3D>
            </Html>
            {/* Connecting line to planet center */}
            <Line points={[[0, 0, 0], [-x, 0, -z]]} color={color} lineWidth={0.4} transparent opacity={0.08} dashed dashSize={0.3} gapSize={0.2} />
          </group>
        )
      })}
    </group>
  )
}

// ════════════════════════════════════════════
// SCENE
// ════════════════════════════════════════════

function Scene() {
  const { agents, tasks, connections, selectedAgent, setSelectedAgent,
    focusedAgent, focusAgent, agentDetail, setAgentDetail, loadingDetail, setLoadingDetail } = useHubStore()
  const layout = useMemo(() => layoutAgents(agents), [agents])

  const handleClick = useCallback((agent: AgentData) => {
    if (focusedAgent) return // ignore clicks while focused
    setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)
  }, [selectedAgent, focusedAgent, setSelectedAgent])

  const handleDoubleClick = useCallback(async (agent: AgentData) => {
    if (focusedAgent?.id === agent.id) return
    focusAgent(agent)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/detail`)
      if (res.ok) setAgentDetail(await res.json())
    } catch {}
    setLoadingDetail(false)
  }, [focusedAgent, focusAgent, setAgentDetail, setLoadingDetail])

  const star = agents[0]
  const planets = agents.slice(1)
  const cronTasks = tasks.filter(t => t.type === 'cron')
  const spawnTasks = tasks.filter(t => t.type === 'spawn' || !t.type)

  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    agents.forEach(a => counts.set(a.id, 0))
    connections.forEach(c => {
      counts.set(c.from, (counts.get(c.from) || 0) + 1)
      counts.set(c.to, (counts.get(c.to) || 0) + 1)
    })
    return counts
  }, [agents, connections])

  // Camera target
  const focusPos = focusedAgent ? layout.get(focusedAgent.id)?.pos ?? null : null
  const isMain = focusedAgent?.id === 'main'
  const focusSize = isMain ? 2.8 : 1.5

  return (
    <>
      <color attach="background" args={['#040407']} />
      <fog attach="fog" args={['#040407', 70, 140]} />
      <ambientLight intensity={0.03} />

      <SketchGrid />
      <SketchGridLines />
      <AmbientDust />

      {/* Orbit rings */}
      {planets.map(p => {
        const info = layout.get(p.id)
        if (!info || info.orbit === 0) return null
        const c = STATUS_COLOR[p.status] ?? '#334'
        return <SketchOrbitRing key={`orbit-${p.id}`} radius={info.orbit} color={c} active={p.status === 'active' || p.status === 'thinking'} />
      })}

      {/* Connections */}
      {connections.map(conn => {
        const fromPos = layout.get(conn.from)?.pos
        const toPos = layout.get(conn.to)?.pos
        if (!fromPos || !toPos) return null
        const targetAgent = agents.find(a => a.id === conn.to)
        const color = conn.active ? (STATUS_COLOR[targetAgent?.status ?? 'idle'] ?? '#00ff88') : '#3a3a4a'
        return <SketchConnection key={conn.id} from={fromPos} to={toPos} color={color} active={conn.active} label={conn.label} />
      })}

      {/* Star (main) */}
      {star && (() => {
        const info = layout.get(star.id)!
        return (
          <Planet agent={star} position={info.pos} orbit={info.orbit}
            selected={selectedAgent?.id === star.id}
            onClick={() => handleClick(star)}
            onDoubleClick={() => handleDoubleClick(star)}
            crons={cronTasks.filter(t => t.parentAgent === 'main' && !planets.some(p => t.label?.toLowerCase().includes(p.id)))}
            connections={connectionCounts.get(star.id) || 0} />
        )
      })()}

      {/* Planets */}
      {planets.map(p => {
        const info = layout.get(p.id)
        if (!info) return null
        const moons = cronTasks.filter(t => t.parentAgent === p.id)
        const mainMoons = cronTasks.filter(t => t.parentAgent === 'main' && t.label?.toLowerCase().includes(p.id))
        return (
          <Planet key={p.id} agent={p} position={info.pos} orbit={info.orbit}
            selected={selectedAgent?.id === p.id}
            onClick={() => handleClick(p)}
            onDoubleClick={() => handleDoubleClick(p)}
            crons={[...moons, ...mainMoons]} connections={connectionCounts.get(p.id) || 0} />
        )
      })}

      {/* Detail panels when focused */}
      {focusedAgent && focusPos && (
        <group position={focusPos}>
          <DetailPanels
            detail={agentDetail}
            size={focusSize}
            color={STATUS_COLOR[focusedAgent.status] ?? '#00ff88'}
          />
          {/* Loading indicator */}
          {loadingDetail && (
            <Html center position={[0, -focusSize - 1, 0]}>
              <div style={{
                fontSize: 10, color: '#555', fontFamily: "'JetBrains Mono', monospace",
                animation: 'pulse-dot 1s infinite',
              }}>
                Loading agent data...
              </div>
            </Html>
          )}
        </group>
      )}

      {/* Comets */}
      {spawnTasks.map((t, i) => <Comet key={t.id} task={t} index={i} />)}

      <CameraController
        target={focusPos || [0, 0, 0]}
        distance={focusedAgent ? focusSize + 5 : 30}
        enabled={!!focusedAgent}
      />
    </>
  )
}

export function HubScene() {
  const { focusedAgent, focusAgent } = useHubStore()

  // ESC to exit focus
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && focusedAgent) focusAgent(null)
  }, [focusedAgent, focusAgent])

  useMemo(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 16, 30], fov: 48, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false }} dpr={[1, 1.5]} style={{ background: '#040407' }}>
        <Scene />
      </Canvas>
      {/* Back button when focused */}
      {focusedAgent && (
        <button
          onClick={() => focusAgent(null)}
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: 20,
            background: '#0a0a10e0', border: '1px solid #00ff8830',
            borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
            color: '#00ff88', fontSize: 11, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#00ff8815')}
          onMouseOut={e => (e.currentTarget.style.background = '#0a0a10e0')}
        >
          ← ESC — Back to System
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════

function StatusBadge({ status, color, active }: { status: string; color: string; active: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 3, padding: '2px 8px', fontSize: 9, color,
      fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color,
        boxShadow: active ? `0 0 8px ${color}` : 'none',
        animation: active ? 'pulse-dot 1.5s infinite' : 'none',
      }} />
      {status.toUpperCase()}
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ fontSize: 7, color: '#555', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#ccc', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, gap: 8 }}>
      <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 9, color: '#bbb', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{value}</span>
    </div>
  )
}
function CtxBar({ tokens, color }: { tokens: number; color: string }) {
  const pct = Math.min((tokens / 200000) * 100, 100)
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#555', marginBottom: 2, letterSpacing: '0.08em' }}>
        <span>CONTEXT</span><span>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 2, background: '#1a1a20', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, width: `${pct}%`, opacity: 0.7, borderRadius: 1 }} />
      </div>
    </div>
  )
}
