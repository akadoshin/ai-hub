import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'
import { AnimatePresence, motion } from 'framer-motion'
import { useHubStore } from '../store'
import type { AgentData, AgentDetail, Task } from '../store'
import { Card3D } from '../ui/3d-card'
import type { MainView } from '../types/flows'
import { MAIN_VIEW_META } from '../types/flows'

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
const SCENE_HTML_Z: [number, number] = [0, -10]
const DETAIL_HTML_Z: [number, number] = [2, -8]
const ORBIT_GRAY = '#7e8791'
const ORBIT_GRAY_ACTIVE = '#848d97'
const ORBIT_ACCENT = '#727b85'
const ORBIT_DASH = '#676f79'
const ORBIT_PLANE_Y = -0.18
const ENABLE_FOCUS_ORBIT_PANELS = false

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
    const sp = 3, range = 90
    for (let x = -range; x <= range; x += sp) {
      for (let z = -range; z <= range; z += sp) {
        pts.push(x, -0.1, z)
        const dist = Math.sqrt(x * x + z * z)
        const fade = Math.max(0.2, 1 - dist / range)
        const isMajor = Math.abs(x % (sp * 4)) < 0.1 && Math.abs(z % (sp * 4)) < 0.1
        const isMid = Math.abs(x % (sp * 4)) < 0.1 || Math.abs(z % (sp * 4)) < 0.1
        als.push(isMajor ? fade * 0.42 : isMid ? fade * 0.22 : fade * 0.08)
        szs.push(isMajor ? 2.8 : isMid ? 1.8 : 1.1)
      }
    }
    return { positions: new Float32Array(pts), alphas: new Float32Array(als), sizes: new Float32Array(szs) }
  }, [])
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#31485c') } }), [])
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
    const range = 90, sp = 10
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
  return <group>{lines.map((pts, i) => <Line key={i} points={pts} color="#243746" lineWidth={0.35} transparent opacity={0.055} />)}</group>
}

function GroundReference() {
  return (
    <group>
      <gridHelper args={[180, 72, '#172a38', '#0c1a24']} position={[0, -0.16, 0]} />
      <Line points={[[-92, -0.11, 0], [92, -0.11, 0]]} color="#294355" lineWidth={0.7} transparent opacity={0.1} />
      <Line points={[[0, -0.11, -92], [0, -0.11, 92]]} color="#294355" lineWidth={0.7} transparent opacity={0.1} />
      <Line points={[[-64, -0.11, -64], [64, -0.11, 64]]} color="#1b2d3a" lineWidth={0.45} transparent opacity={0.045} />
      <Line points={[[-64, -0.11, 64], [64, -0.11, -64]]} color="#1b2d3a" lineWidth={0.45} transparent opacity={0.045} />
    </group>
  )
}

// ════════════════════════════════════════════
// ORBIT RINGS
// ════════════════════════════════════════════

function SketchOrbitRing({ radius, color: _color, active }: { radius: number; color: string; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2
      const w = Math.sin(a * 12) * 0.08 + Math.sin(a * 7.3) * 0.05
      pts.push(new THREE.Vector3(Math.cos(a) * (radius + w), ORBIT_PLANE_Y, Math.sin(a) * (radius + w)))
    }
    return pts
  }, [radius])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const speed = 0.012 + 0.18 / Math.max(radius, 1)
    groupRef.current.rotation.y = clock.elapsedTime * speed
  })

  const ringColor = active ? ORBIT_GRAY_ACTIVE : ORBIT_GRAY
  const accent = active ? ORBIT_ACCENT : ORBIT_DASH

  return (
    <group ref={groupRef}>
      {/* Base solid ring — always visible */}
      <Line
        points={points}
        color={ringColor}
        lineWidth={active ? 1.75 : 1.45}
        transparent
        opacity={active ? 0.62 : 0.5}
      />
      {/* Dashed overlay for detail */}
      <Line
        points={points}
        color={accent}
        lineWidth={active ? 0.82 : 0.64}
        transparent
        opacity={active ? 0.3 : 0.22}
        dashed
        dashSize={1.2}
        gapSize={0.6}
      />
    </group>
  )
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
    float speedA = 0.45 + uIntensity * 2.1;
    float speedB = 0.24 + uIntensity * 1.5;
    float speedC = 1.0 + uIntensity * 3.0;
    float n1=snoise(position*1.5+uTime*speedA);
    float n2=snoise(position*3.0-uTime*speedB)*0.55;
    float n3=snoise(position*6.0+uTime*speedC)*0.18;
    float flow = sin((position.x + position.z) * 6.0 + uTime * (1.0 + uIntensity * 6.0)) * (0.08 * uIntensity);
    float n=n1+n2+n3+flow;
    vNoise=n;
    float d=n*(0.04 + uIntensity*0.55);
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
    float pulse=sin(uTime*(1.6 + uIntensity*8.0))*0.12+0.9;
    base*=pulse;

    // Brighter when more intense (active)
    base*=(0.72+uIntensity*2.35);

    float alpha=0.82+fresnel*0.12+uIntensity*0.1;
    gl_FragColor=vec4(base,alpha);
  }
`

// ════════════════════════════════════════════
// PLANET COMPONENTS
// ════════════════════════════════════════════

function LiquidCore({ size, color, color2, active }: {
  size: number; color: string; color2: string; active: boolean
}) {
  const coreRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uIntensity: { value: 0 },
    uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(color2) },
  }), [])
  useMemo(() => { uniforms.uColor.value.set(color); uniforms.uColor2.value.set(color2) }, [color, color2])
  useFrame(({ clock }) => {
    if (!matRef.current) return
    const t = clock.elapsedTime
    matRef.current.uniforms.uTime.value = t
    const target = active ? 0.72 : 0.02
    matRef.current.uniforms.uIntensity.value += (target - matRef.current.uniforms.uIntensity.value) * 0.08
    if (coreRef.current) {
      const wobble = active ? 0.08 : 0.015
      coreRef.current.scale.set(
        1 + Math.sin(t * (active ? 5.4 : 1.5)) * wobble,
        1 + Math.cos(t * (active ? 4.3 : 1.3)) * wobble,
        1 + Math.sin(t * (active ? 6.2 : 1.1)) * wobble,
      )
    }
  })
  return (
    <mesh ref={coreRef}>
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
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.elapsedTime * 0.05
      ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.06) * 0.35
    }
  })
  return (
    <group ref={ref} rotation={[Math.PI * 0.45, 0, 0]}>
      <mesh>
        <torusGeometry args={[size * 1.3, 0.02, 8, 80]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.44 : 0.2} />
      </mesh>
      <mesh>
        <torusGeometry args={[size * 1.36, 0.008, 8, 120]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.66 : 0.28} />
      </mesh>
    </group>
  )
}

function PlanetSurface({ size, color, color2, active, isMain }: {
  size: number
  color: string
  color2: string
  active: boolean
  isMain: boolean
}) {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[size * 0.9, 6]} />
        <meshStandardMaterial
          color={color2}
          emissive={color}
          emissiveIntensity={active ? (isMain ? 0.42 : 0.3) : 0.14}
          roughness={0.28}
          metalness={0.52}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[size * 0.93, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={active ? 0.26 : 0.11} />
      </mesh>
    </group>
  )
}

function MoonSurface({ radius, color, active }: {
  radius: number
  color: string
  active: boolean
}) {
  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[radius, 4]} />
        <meshStandardMaterial
          color={active ? '#d4dee8' : '#9aa8b6'}
          emissive={color}
          emissiveIntensity={active ? 0.52 : 0.18}
          roughness={0.4}
          metalness={0.32}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[radius * 1.07, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={active ? 0.5 : 0.2} />
      </mesh>
    </group>
  )
}

// ── Planet ──
function Planet({ agent, position, orbit, selected, onClick, onDoubleClick, crons, connections, runningLoad, focusMode, isFocused }: {
  agent: AgentData; position: [number, number, number]; orbit: number
  selected: boolean; onClick: () => void; onDoubleClick?: () => void; crons: Task[]; connections?: number; runningLoad?: number
  focusMode: boolean; isFocused: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const selRingRef = useRef<THREE.Mesh>(null)
  const auraRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const c = STATUS_COLOR[agent.status] ?? '#334'
  const c2 = STATUS_COLOR2[agent.status] ?? '#151520'
  const isActive = agent.status === 'active' || agent.status === 'thinking'
  const isExecuting = isActive || (runningLoad ?? 0) > 0
  const isMain = agent.id === 'main'
  const size = isMain ? 2.8 : 1.5
  const model = agent.model.replace('anthropic/', '').replace('claude-', '')
  const showDetail = !focusMode && (selected || hovered)
  const showName = !focusMode || isFocused
  const highlight = selected || hovered

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.position.x = orbit > 0 ? position[0] + Math.cos(t * 0.12 + orbit) * 0.22 : position[0]
      groupRef.current.position.y = position[1] + Math.sin(t * 0.35 + position[0]) * 0.2
      groupRef.current.position.z = orbit > 0 ? position[2] + Math.sin(t * 0.12 + orbit) * 0.22 : position[2]
      groupRef.current.rotation.y = t * (isMain ? 0.06 : 0.1)
    }
    if (selRingRef.current) selRingRef.current.rotation.z = t * 0.12
    if (auraRef.current) {
      const s = 1 + Math.sin(t * 1.7 + position[2]) * 0.03
      auraRef.current.scale.set(s, s, s)
    }
  })

  return (
    <group>
      <group
        ref={groupRef}
        position={position}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {/* Planet body */}
        <PlanetSurface size={size} color={c} color2={c2} active={isExecuting} isMain={isMain} />
        <LiquidCore size={size * 0.72} color={c} color2={c2} active={isExecuting} />
        {highlight && <WireframeShell size={size * 1.03} color={c} active={isExecuting} />}

        {/* Hot center glow */}
        <Sphere args={[size * 0.15, 12, 12]}>
          <meshBasicMaterial color={c} transparent opacity={isExecuting ? 0.85 : 0.2} />
        </Sphere>
        {/* Center point light */}
        <Sphere args={[size * 0.08, 8, 8]}>
          <meshBasicMaterial color="#fff" transparent opacity={isExecuting ? 0.6 : 0.1} />
        </Sphere>

        {/* Atmosphere layers */}
        <Sphere args={[size * 1.15, 32, 32]}>
          <meshBasicMaterial color={c} transparent opacity={isExecuting ? 0.3 : 0.1} side={THREE.BackSide} />
        </Sphere>
        <Sphere args={[size * 1.35, 24, 24]}>
          <meshBasicMaterial color={c} transparent opacity={isExecuting ? 0.2 : 0.055} side={THREE.BackSide} />
        </Sphere>
        <Sphere ref={auraRef} args={[size * 1.65, 20, 20]}>
          <meshBasicMaterial color={c} transparent opacity={isExecuting ? 0.28 : 0.08} side={THREE.BackSide} />
        </Sphere>

        {/* Equatorial ring */}
        <PlanetRing size={size} color={c} active={isExecuting} />

        {/* Selection ring */}
        {highlight && (
          <group>
            <mesh ref={selRingRef} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 1.5, 0.04, 8, 80]} />
              <meshBasicMaterial color={c} transparent opacity={selected ? 0.62 : 0.33} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[size * 1.55, 0.015, 8, 80]} />
              <meshBasicMaterial color={c} transparent opacity={selected ? 0.25 : 0.13} />
            </mesh>
          </group>
        )}

        {/* Lighting */}
        <pointLight intensity={isExecuting ? (isMain ? 3.2 : 1.05) : (isMain ? 2.5 : 0.55)} color={c} distance={isMain ? 58 : 20} decay={2} />

        {/* Moons */}
        {crons.map((cron, i) => (
          <Moon key={cron.id} cron={cron} index={i} total={crons.length} planetSize={size} />
        ))}

        {/* Always-visible name tag */}
        {showName && (
          <Html position={[0, size + 1.05, 0]} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#05070cd8', border: `1px solid ${c}24`,
              borderRadius: 999, padding: '3px 9px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: c,
                boxShadow: isExecuting ? `0 0 8px ${c}` : 'none',
                opacity: isExecuting ? 1 : 0.75,
              }} />
              <span style={{ fontSize: 9, color: '#dbe4f3', fontWeight: 700, letterSpacing: '0.05em' }}>
                {agent.label}
              </span>
            </div>
          </Html>
        )}

        {/* Rich hover/selected details */}
        {showDetail && (
          <Html position={[0, size + 1.75, 0]} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <CometCard color={c} width={isMain ? 246 : 208}>
              <div style={{ fontSize: isMain ? 13 : 11, fontWeight: 700, color: '#f0f5ff', marginBottom: 5, letterSpacing: '0.04em' }}>
                {agent.label}
              </div>
              <StatusBadge status={agent.status} color={c} active={isExecuting} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 7 }}>
                <Stat label="MODEL" value={model} />
                <Stat label="SESSIONS" value={`${agent.activeSessions || 0}/${agent.sessionCount || 0}`} />
                <Stat label="RUNNING" value={`${runningLoad || 0}`} />
                <Stat label="LAST" value={agent.lastActivity} />
                {crons.length > 0 && <Stat label="CRONS" value={`${crons.length}`} />}
                {isMain && <Stat label="REASONING" value={agent.reasoningLevel || 'off'} />}
                {(connections ?? 0) > 0 && <Stat label="LINKS" value={`${connections}`} />}
              </div>
              {agent.description && (
                <div style={{
                  marginTop: 8, fontSize: 8, color: '#a8b8cf', lineHeight: 1.45,
                  borderTop: `1px solid ${c}18`, paddingTop: 5,
                }}>
                  {agent.description}
                </div>
              )}
              {agent.contextTokens && agent.contextTokens > 0 && <CtxBar tokens={agent.contextTokens} color={c} />}
            </CometCard>
          </Html>
        )}
      </group>
    </group>
  )
}

function formatElapsed(value?: number): string {
  if (!value || value <= 0) return '0s'
  const total = Math.round(value)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Moon ──
function Moon({ cron, index, total, planetSize }: {
  cron: Task; index: number; total: number; planetSize: number
}) {
  const ref = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const moonR = planetSize + 2.0 + index * 1.0
  const speed = 0.3 / (1 + index * 0.15)
  const base = (index / Math.max(total, 1)) * Math.PI * 2
  const isRunning = cron.status === 'running'
  const mc = isRunning ? '#8ea8bf' : '#7b8794'
  const tilt = 0.15 + index * 0.1
  const moonName = cron.label.replace('Cron: ', '')

  useFrame(({ clock }) => {
    if (!ref.current) return
    const a = base + clock.elapsedTime * speed
    ref.current.position.set(
      Math.cos(a) * moonR,
      Math.sin(a * 0.5) * tilt,
      Math.sin(a) * moonR
    )
    if (shellRef.current) shellRef.current.rotation.y = clock.elapsedTime * 0.1
    if (haloRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.2 + index) * 0.06
      haloRef.current.scale.set(s, s, s)
    }
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
      <Line points={orbitPts} color={ORBIT_GRAY} lineWidth={1.0} transparent opacity={isRunning ? 0.48 : 0.3} dashed dashSize={0.3} gapSize={0.2} />

      <group ref={ref} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
        <MoonSurface radius={0.24} color={mc} active={isRunning} />
        {/* Wireframe shell */}
        <mesh ref={shellRef}>
          <icosahedronGeometry args={[0.3, 1]} />
          <meshBasicMaterial color={mc} wireframe transparent opacity={isRunning ? 0.52 : 0.2} />
        </mesh>
        {/* Orbiting ring */}
        <mesh rotation={[Math.PI * 0.52 + index * 0.06, 0, 0]}>
          <torusGeometry args={[0.28, 0.01, 6, 50]} />
          <meshBasicMaterial color={mc} transparent opacity={isRunning ? 0.35 : 0.12} />
        </mesh>
        <Sphere ref={haloRef} args={[0.42, 10, 10]}>
          <meshBasicMaterial color={mc} transparent opacity={isRunning ? 0.09 : 0.03} side={THREE.BackSide} />
        </Sphere>
        <pointLight intensity={isRunning ? 0.22 : 0.08} color={mc} distance={3.4} decay={2} />
        {/* Label */}
        <Html position={[0, 0.52, 0]} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background: '#06060ae0', borderRadius: 3, padding: '1px 5px',
            border: `1px solid ${mc}2f`,
            fontSize: 7, lineHeight: 1.2, color: isRunning ? '#d9e7f5' : '#b6c3d1',
            fontFamily: "'JetBrains Mono', monospace",
            maxWidth: 170, textAlign: 'center', whiteSpace: 'normal', wordBreak: 'break-word',
          }}>
            {moonName}
          </div>
        </Html>
        {hovered && (
          <Html position={[0.92, 0.08, 0]} zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
            <CometCard color={mc} width={182}>
              <div style={{ fontSize: 9, color: '#e5ecf7', fontWeight: 700, marginBottom: 4 }}>
                {moonName}
              </div>
              <Detail label="Status" value={cron.status} />
              <Detail label="Type" value={cron.type || 'cron'} />
              <Detail label="Elapsed" value={formatElapsed(cron.elapsed)} />
              {cron.parentAgent && <Detail label="Parent" value={cron.parentAgent} />}
              <Detail label="Model" value={cron.model?.replace('anthropic/', '').replace('claude-', '') || 'unknown'} />
              {cron.reasoningLevel && <Detail label="Reasoning" value={cron.reasoningLevel} />}
              {cron.lastMessage && (
                <div style={{
                  marginTop: 4, paddingTop: 4, borderTop: `1px solid ${mc}20`,
                  fontSize: 8, color: '#aeb9c9', lineHeight: 1.35,
                }}>
                  {cron.lastMessage.slice(0, 100)}
                </div>
              )}
            </CometCard>
          </Html>
        )}
      </group>
    </group>
  )
}

// ── Comet (worker/spawn) ──
function Comet({ task, index }: { task: Task; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const isRunning = task.status === 'running'
  const c = isRunning ? '#60a5fa' : task.status === 'failed' ? '#f87171' : '#3a3a55'
  const cometName = task.label || task.id

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
    <group ref={groupRef} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
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
      <Html position={[0, 0.45, 0]} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: '#06060ae0', borderRadius: 3, padding: '1px 6px',
          border: `1px solid ${c}2a`,
          fontSize: 8, color: isRunning ? '#cbe0ff' : '#a9b5c7',
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.2, whiteSpace: 'normal', maxWidth: 176, wordBreak: 'break-word', textAlign: 'center',
        }}>
          {cometName}
        </div>
      </Html>
      {hovered && (
        <Html position={[1.15, 0.05, 0]} zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <CometCard color={c} width={188}>
            <div style={{ fontSize: 9, color: '#e5ecf7', fontWeight: 700, marginBottom: 4 }}>
              {cometName}
            </div>
            <Detail label="Status" value={task.status} />
            <Detail label="Type" value={task.type || 'spawn'} />
            <Detail label="Elapsed" value={formatElapsed(task.elapsed)} />
            {task.parentAgent && <Detail label="Parent" value={task.parentAgent} />}
            <Detail label="Model" value={task.model?.replace('anthropic/', '').replace('claude-', '') || 'unknown'} />
            {task.reasoningLevel && <Detail label="Reasoning" value={task.reasoningLevel} />}
            {task.lastMessage && (
              <div style={{
                marginTop: 4, paddingTop: 4, borderTop: `1px solid ${c}20`,
                fontSize: 8, color: '#aeb9c9', lineHeight: 1.35,
              }}>
                {task.lastMessage.slice(0, 100)}
              </div>
            )}
          </CometCard>
        </Html>
      )}
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
        <Html position={mid} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
  const interactingRef = useRef(false)
  const targetVec = useRef(new THREE.Vector3(0, 0, 0))
  const posVec = useRef(new THREE.Vector3(0, 16, 30))
  const wasEnabledRef = useRef(false)

  useFrame(({ camera }) => {
    if (!controlsRef.current) return
    const controls = controlsRef.current

    if (enabled && target) {
      if (!wasEnabledRef.current) {
        posVec.current.copy(camera.position)
      }
      targetVec.current.lerp(new THREE.Vector3(...target), 0.05)
      controls.target.copy(targetVec.current)

      if (!interactingRef.current) {
        const desired = new THREE.Vector3(
          target[0] + distance * 0.3,
          target[1] + distance * 0.6,
          target[2] + distance * 0.8,
        )
        posVec.current.lerp(desired, 0.045)
        camera.position.copy(posVec.current)
      }
    }

    if (!enabled && !interactingRef.current) {
      targetVec.current.lerp(new THREE.Vector3(0, 0, 0), 0.02)
      controls.target.lerp(targetVec.current, 0.02)
    }

    controls.autoRotate = !enabled && !interactingRef.current
    controls.update()
    wasEnabledRef.current = enabled
  })

  return (
    <OrbitControls ref={controlsRef} makeDefault
      minDistance={enabled ? 3 : 6} maxDistance={enabled ? 13 : 80}
      minPolarAngle={0.15} maxPolarAngle={Math.PI - 0.12}
      autoRotate={!enabled}
      autoRotateSpeed={enabled ? 0.16 : 0.1}
      enableDamping
      dampingFactor={0.05}
      enablePan
      panSpeed={0.7}
      rotateSpeed={0.7}
      zoomSpeed={0.85}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onStart={() => { interactingRef.current = true }}
      onEnd={() => { interactingRef.current = false }}
    />
  )
}

function FlowPortal({
  flow,
  position,
  active,
  onSelect,
}: {
  flow: MainView
  position: [number, number, number]
  active: boolean
  onSelect: (flow: MainView) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const pulseRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const meta = MAIN_VIEW_META[flow]

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.35 + position[0] * 0.01
      groupRef.current.position.y = position[1] + Math.sin(t * 1.1 + position[2] * 0.03) * 0.28
    }
    if (pulseRef.current) {
      const s = 1 + Math.sin(t * 2.2 + position[0]) * 0.06
      pulseRef.current.scale.set(s, s, s)
    }
  })

  const glow = hovered ? 0.36 : active ? 0.22 : 0.12

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(flow)
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <icosahedronGeometry args={[0.94, 1]} />
        <meshBasicMaterial color={meta.color} wireframe transparent opacity={hovered ? 0.78 : 0.44} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[active ? 0.56 : 0.48, 1]} />
        <meshBasicMaterial color={meta.color} transparent opacity={active ? 0.8 : 0.45} />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={meta.color} transparent opacity={glow} side={THREE.BackSide} />
      </mesh>
      <Line points={[[0, -0.9, 0], [0, -2.4, 0]]} color={meta.color} lineWidth={0.7} transparent opacity={0.14} />
      <Html position={[0, -2.7, 0]} center zIndexRange={SCENE_HTML_Z} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          style={{
            border: `1px solid ${meta.color}28`,
            background: '#060912d8',
            borderRadius: 7,
            padding: '4px 8px',
            minWidth: 108,
            textAlign: 'center',
            boxShadow: active ? `0 0 16px ${meta.color}25` : 'none',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ fontSize: 9, color: meta.color, fontWeight: 700 }}>{meta.shortcut}</div>
          <div style={{ fontSize: 9, color: '#b4c1d8', letterSpacing: '0.05em' }}>{meta.label}</div>
        </div>
      </Html>
    </group>
  )
}

const MAIN_VIEWS: MainView[] = ['deck', 'graph']

function FlowConstellation({
  mainView,
  onSelect,
}: {
  mainView: MainView
  onSelect: (v: MainView) => void
}) {
  const portals = useMemo(() => {
    const radius = 54
    return MAIN_VIEWS.map((flow, i) => {
      const a = (i / MAIN_VIEWS.length) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * radius
      const z = Math.sin(a) * radius
      const y = 2.5 + Math.sin(i * 1.4) * 1.6
      return { flow, pos: [x, y, z] as [number, number, number] }
    })
  }, [])

  return (
    <group>
      {portals.map((p) => (
        <FlowPortal
          key={`portal-${p.flow}`}
          flow={p.flow}
          position={p.pos}
          active={p.flow === mainView}
          onSelect={onSelect}
        />
      ))}
      {portals.map((p) => (
        <Line
          key={`portal-line-${p.flow}`}
          points={[p.pos, [0, 0, 0]]}
          color={MAIN_VIEW_META[p.flow].color}
          lineWidth={0.4}
          transparent
          opacity={p.flow === mainView ? 0.16 : 0.06}
          dashed
          dashSize={1.8}
          gapSize={0.8}
        />
      ))}
    </group>
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
            <Html center zIndexRange={DETAIL_HTML_Z} style={{ pointerEvents: 'auto', userSelect: 'text' }}
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

function Scene({
  mainView,
  onMainViewChange,
}: {
  mainView: MainView
  onMainViewChange: (v: MainView) => void
}) {
  const { agents, tasks, connections, selectedAgent, setSelectedAgent,
    focusedAgent, focusAgent, agentDetail, setAgentDetail, loadingDetail, setLoadingDetail } = useHubStore()
  const layout = useMemo(() => layoutAgents(agents), [agents])
  const focusMode = !!focusedAgent

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

  const runningByAgent = useMemo(() => {
    const counts = new Map<string, number>()
    agents.forEach(a => counts.set(a.id, 0))
    tasks.forEach(t => {
      if (t.status !== 'running') return
      const id = t.parentAgent || t.agentId
      if (!id) return
      counts.set(id, (counts.get(id) || 0) + 1)
    })
    return counts
  }, [agents, tasks])

  // Camera target
  const focusPos = focusedAgent ? layout.get(focusedAgent.id)?.pos ?? null : null
  const isMain = focusedAgent?.id === 'main'
  const focusSize = isMain ? 2.8 : 1.5

  return (
    <>
      <color attach="background" args={['#03060c']} />
      <fog attach="fog" args={['#05080f', 72, 160]} />
      <ambientLight intensity={0.14} color="#6e8da7" />
      <hemisphereLight args={['#88b3dc', '#090f17', 0.32]} />
      <directionalLight position={[20, 28, 16]} intensity={0.35} color="#adcfff" />
      <directionalLight position={[-18, 14, -24]} intensity={0.2} color="#65d7b9" />

      <SketchGrid />
      <SketchGridLines />
      <GroundReference />
      <AmbientDust />

      {/* Orbit rings */}
      {planets.map(p => {
        const info = layout.get(p.id)
        if (!info || info.orbit === 0) return null
        const c = STATUS_COLOR[p.status] ?? '#334'
        return <SketchOrbitRing key={`orbit-${p.id}`} radius={info.orbit} color={c} active={p.status === 'active' || p.status === 'thinking'} />
      })}

      {/* Connections */}
      {!focusMode && connections.map(conn => {
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
            connections={connectionCounts.get(star.id) || 0}
            runningLoad={runningByAgent.get(star.id) || 0}
            focusMode={focusMode}
            isFocused={focusedAgent?.id === star.id}
          />
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
            crons={[...moons, ...mainMoons]}
            connections={connectionCounts.get(p.id) || 0}
            runningLoad={runningByAgent.get(p.id) || 0}
            focusMode={focusMode}
            isFocused={focusedAgent?.id === p.id}
          />
        )
      })}

      {/* Legacy orbiting detail cards (disabled for readability) */}
      {ENABLE_FOCUS_ORBIT_PANELS && focusedAgent && focusPos && (
        <group position={focusPos}>
          <DetailPanels
            detail={agentDetail}
            size={focusSize}
            color={STATUS_COLOR[focusedAgent.status] ?? '#00ff88'}
          />
          {/* Loading indicator */}
          {loadingDetail && (
            <Html center position={[0, -focusSize - 1, 0]} zIndexRange={SCENE_HTML_Z}>
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
      {!focusMode && spawnTasks.map((t, i) => <Comet key={t.id} task={t} index={i} />)}

      {!focusMode && <FlowConstellation mainView={mainView} onSelect={onMainViewChange} />}

      <CameraController
        target={focusPos || [0, 0, 0]}
        distance={focusedAgent ? focusSize + 5 : 30}
        enabled={!!focusedAgent}
      />
    </>
  )
}

export function HubScene({
  mainView,
  onMainViewChange,
}: {
  mainView: MainView
  onMainViewChange: (v: MainView) => void
}) {
  const { focusedAgent, focusAgent, agentDetail, loadingDetail } = useHubStore()
  const [showControlsHint, setShowControlsHint] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setShowControlsHint(false), 9000)
    return () => window.clearTimeout(timer)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }
    if (e.key === 'Escape' && focusedAgent) {
      focusAgent(null)
      return
    }
    const viewMap: Partial<Record<string, MainView>> = {
      '1': 'deck',
      '2': 'graph',
    }
    const view = viewMap[e.key]
    if (view) onMainViewChange(view)
  }, [focusedAgent, focusAgent, onMainViewChange])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas camera={{ position: [0, 16, 30], fov: 48, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} dpr={[1, 1.5]} style={{ background: '#03060c', zIndex: 0 }}>
        <Scene mainView={mainView} onMainViewChange={onMainViewChange} />
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
      <FocusedAgentPanel
        agent={focusedAgent}
        detail={agentDetail}
        loading={loadingDetail}
      />
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 12, zIndex: 80, pointerEvents: 'auto' }}>
        <AnimatePresence mode="wait">
          {showControlsHint ? (
            <motion.div
              key="controls-hint-expanded"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.985 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                border: '1px solid #50678666', background: '#07101af2',
                borderRadius: 999, padding: '6px 10px 6px 12px',
                color: '#c6d2e3', fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, fontWeight: 700, letterSpacing: '0.015em',
                backdropFilter: 'blur(8px)', boxShadow: '0 8px 26px rgba(0,0,0,0.45)',
              }}
            >
              <span style={{
                fontSize: 8, letterSpacing: '0.09em', color: '#8ea7c2',
                border: '1px solid #3f567099', borderRadius: 999, padding: '1px 6px',
                background: '#08111b',
              }}>
                SUGGESTION
              </span>
              <span>drag rotate · right-drag pan · wheel zoom · double-click focus</span>
              <button
                onClick={() => setShowControlsHint(false)}
                aria-label="Hide controls suggestion"
                style={{
                  border: '1px solid #42576f99', background: '#0a1521',
                  color: '#a9bdd3', borderRadius: 999, width: 18, height: 18,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 11, lineHeight: 1,
                }}
              >
                ×
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="controls-hint-collapsed"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowControlsHint(true)}
              style={{
                border: '1px solid #3f56708a', background: '#08111be8', color: '#9fb2c8',
                borderRadius: 999, padding: '5px 11px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.05em', fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}
            >
              SUGGESTION: SHOW MOUSE CONTROLS
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 50,
          border: `1px solid ${MAIN_VIEW_META[mainView].color}40`,
          background: '#060912cc',
          borderRadius: 8,
          padding: '6px 10px',
          color: '#8f9ab0',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.04em',
          backdropFilter: 'blur(8px)',
        }}
      >
        VIEW {MAIN_VIEW_META[mainView].shortcut}: <span style={{ color: MAIN_VIEW_META[mainView].color }}>{MAIN_VIEW_META[mainView].label}</span>
      </div>
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
