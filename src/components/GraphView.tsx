import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant, useReactFlow,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler, FinalConnectionState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData, Connection } from '../store'
import AgentNode from './AgentNode'
import { useOnRelayout } from './DetailNodes'
import { detailNodeTypes } from './DetailNodes'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { GraphCreator } from './GraphCreator'
import type { CreatorState } from './GraphCreator'

const nodeTypes = { agentNode: AgentNode, ...detailNodeTypes }
const proOptions = { hideAttribution: true }
const POSITIONS_KEY = 'aihub-graph-positions'

function loadPositions(): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') } catch { return {} }
}
function savePositions(pos: Record<string, { x: number; y: number }>) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos))
}

// ── Detail layout: organized grid ──
function buildDetailNodes(
  agent: AgentData,
  agentPos: { x: number; y: number },
  detail: any,
  agentConnections: Connection[],
  color: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const pid = agent.id

  // The agent node itself stays — same id, same type, just at its original position
  nodes.push({
    id: pid,
    type: 'agentNode',
    position: agentPos,
    data: agent,
  })

  const edgeStyle = (c: string) => ({
    stroke: c + '20', strokeWidth: 1, strokeDasharray: '4 4',
  })

  // Col 1: Files — fanning out from agent's right handle
  const COL_GAP = 380 // horizontal gap between columns
  const colX = agentPos.x + COL_GAP
  const fileEntries = detail?.files
    ? Object.entries(detail.files).filter(([, v]) => v !== null)
    : []
  const fileGap = 48
  const totalFileH = fileEntries.length * fileGap
  let fy = agentPos.y - totalFileH / 2 + 20

  for (const [key, content] of fileEntries) {
    const nid = `${pid}:file:${key}`
    nodes.push({
      id: nid, type: 'fileNode',
      position: { x: colX, y: fy },
      data: { name: `${key.toUpperCase()}.md`, content, color },
    })
    edges.push({
      id: `e:${pid}→${nid}`, source: pid, target: nid,
      sourceHandle: 'right',
      type: 'smoothstep',
      style: edgeStyle(color),
    })
    fy += fileGap
  }

  // Col 2: Sessions + Connections
  const col2X = agentPos.x + COL_GAP * 2
  const col2Source = fileEntries.length > 0 ? `${pid}:file:${fileEntries[0][0]}` : pid
  const col2SrcHandle = fileEntries.length > 0 ? undefined : 'right'

  const sessId = `${pid}:sessions`
  nodes.push({
    id: sessId, type: 'sessionsNode',
    position: { x: col2X, y: agentPos.y - 180 },
    data: { sessions: detail?.sessions || [], color: '#60a5fa' },
  })
  edges.push({
    id: `e:→${sessId}`, source: col2Source, target: sessId,
    sourceHandle: col2SrcHandle, type: 'smoothstep',
    style: edgeStyle('#60a5fa'),
  })

  const connId = `${pid}:connections`
  nodes.push({
    id: connId, type: 'connectionsNode',
    position: { x: col2X, y: agentPos.y + 180 },
    data: { connections: agentConnections, color: '#00ff88' },
  })
  edges.push({
    id: `e:→${connId}`, source: col2Source, target: connId,
    sourceHandle: col2SrcHandle, type: 'smoothstep',
    style: edgeStyle('#00ff88'),
  })

  // Col 3: Memory + Workspace
  const col3X = agentPos.x + COL_GAP * 3

  const memId = `${pid}:memory`
  nodes.push({
    id: memId, type: 'memoryNode',
    position: { x: col3X, y: agentPos.y - 180 },
    data: { memories: detail?.recentMemories || [], color: '#c084fc' },
  })
  edges.push({
    id: `e:→${memId}`, source: sessId, target: memId,
    type: 'smoothstep',
    style: edgeStyle('#c084fc'),
  })

  const wsId = `${pid}:workspace`
  nodes.push({
    id: wsId, type: 'workspaceNode',
    position: { x: col3X, y: agentPos.y + 180 },
    data: { files: detail?.workspaceFiles || [], color: '#f59e0b' },
  })
  edges.push({
    id: `e:→${wsId}`, source: connId, target: wsId,
    type: 'smoothstep',
    style: edgeStyle('#f59e0b'),
  })

  return { nodes, edges }
}

// ── Overlap resolution: push nodes apart so nothing overlaps ──
function resolveOverlaps(nodes: Node[], zoom: number, passes = 3): Node[] {
  let result = [...nodes]
  const PAD_X = 20
  const PAD_Y = 10

  for (let pass = 0; pass < passes; pass++) {
    let moved = false
    for (let i = 0; i < result.length; i++) {
      const a = result[i]
      const elA = document.querySelector(`[data-id="${a.id}"]`) as HTMLElement | null
      if (!elA) continue
      const wA = elA.getBoundingClientRect().width / zoom
      const hA = elA.getBoundingClientRect().height / zoom

      for (let j = i + 1; j < result.length; j++) {
        const b = result[j]
        const elB = document.querySelector(`[data-id="${b.id}"]`) as HTMLElement | null
        if (!elB) continue
        const wB = elB.getBoundingClientRect().width / zoom
        const hB = elB.getBoundingClientRect().height / zoom

        // Check overlap
        const overlapX = (a.position.x + wA + PAD_X) - b.position.x
        const overlapY = (a.position.y + hA + PAD_Y) - b.position.y
        const overlapXrev = (b.position.x + wB + PAD_X) - a.position.x
        const overlapYrev = (b.position.y + hB + PAD_Y) - a.position.y

        const isOverlapping =
          a.position.x < b.position.x + wB + PAD_X &&
          a.position.x + wA + PAD_X > b.position.x &&
          a.position.y < b.position.y + hB + PAD_Y &&
          a.position.y + hA + PAD_Y > b.position.y

        if (!isOverlapping) continue
        moved = true

        // Push the node that's further right/down
        // Determine which axis has less overlap to resolve
        const pushRight = Math.min(overlapX, overlapXrev)
        const pushDown = Math.min(overlapY, overlapYrev)

        if (pushDown < pushRight) {
          // Push vertically
          if (a.position.y < b.position.y) {
            result[j] = { ...b, position: { ...b.position, y: a.position.y + hA + PAD_Y } }
          } else {
            result[i] = { ...a, position: { ...a.position, y: b.position.y + hB + PAD_Y } }
          }
        } else {
          // Push horizontally
          if (a.position.x < b.position.x) {
            result[j] = { ...b, position: { ...b.position, x: a.position.x + wA + PAD_X } }
          } else {
            result[i] = { ...a, position: { ...a.position, x: b.position.x + wB + PAD_X } }
          }
        }
      }
    }
    if (!moved) break
  }

  return result
}

type ViewState = 'agents' | 'transitioning' | 'detail'

function GraphInner() {
  const agents = useHubStore(s => s.agents)
  const connections = useHubStore(s => s.connections)
  const [viewState, setViewState] = useState<ViewState>('agents')
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null)
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])
  const savedPos = useRef(loadPositions())
  const reactFlow = useReactFlow()

  // ── Graph Creator (drag-to-create) ──────────────────────────────────────
  const [creatorState, setCreatorState] = useState<CreatorState | null>(null)
  const connectSourceRef = useRef<string | null>(null)

  const onConnectStart = useCallback((_: unknown, { nodeId }: { nodeId: string | null }) => {
    connectSourceRef.current = nodeId
  }, [])

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
    // Only show creator when drag didn't land on a valid handle (no connection made)
    if (connectionState.isValid) return
    // Only in agents view, not detail
    if (viewState !== 'agents') return

    const sourceId = connectSourceRef.current
    if (!sourceId) return
    const sourceAgent = agents.find(a => a.id === sourceId)
    if (!sourceAgent) return

    // Did the user drop on another agent node body (not a handle)?
    const targetId = connectionState.toNode?.id ?? connectionState.toHandle?.nodeId ?? null
    const targetAgent = targetId && targetId !== sourceId
      ? agents.find(a => a.id === targetId) ?? null
      : null

    const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX ?? 0
    const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY ?? 0

    setCreatorState({ position: { x: clientX, y: clientY }, sourceAgent, targetAgent })
  }, [viewState, agents])
  // ────────────────────────────────────────────────────────────────────────

  // Build agent-level graph
  const buildAgentGraph = useCallback(() => {
    if (!agents.length) return { nodes: [] as Node[], edges: [] as Edge[] }
    const cx = 500, cy = 300, r = 220
    const nodes: Node[] = agents.map((a, i) => {
      const angle = (i / agents.length) * 2 * Math.PI - Math.PI / 2
      const defaultPos = { x: cx + r * Math.cos(angle) - 80, y: cy + r * Math.sin(angle) - 40 }
      return {
        id: a.id,
        type: 'agentNode',
        position: savedPos.current[a.id] || defaultPos,
        data: a,
      }
    })
    const edges: Edge[] = connections.map(c => ({
      id: c.id,
      source: c.from,
      target: c.to,
      animated: c.active,
      style: { stroke: c.active ? '#00ff88' : '#333', strokeWidth: c.active ? 2 : 1, opacity: c.active ? 0.8 : 0.3 },
      label: c.label || undefined,
    }))
    return { nodes, edges }
  }, [agents, connections])

  // Update agent graph when in agents view
  useEffect(() => {
    if (viewState !== 'agents') return
    const { nodes, edges } = buildAgentGraph()
    setLocalNodes(prev => nodes.map(n => {
      const existing = prev.find(p => p.id === n.id)
      if (existing && !n.id.includes(':')) return { ...n, position: existing.position, data: n.data }
      return n
    }))
    setLocalEdges(edges)
  }, [agents, connections, viewState])

  // Re-layout when nodes expand/collapse — adjust Y positions and push columns right
  const handleRelayout = useCallback(() => {
    if (viewState !== 'detail' || !selectedAgent) return
    const pid = selectedAgent.id

    setLocalNodes(prev => {
      const next = [...prev]

      // 1. Re-stack file nodes vertically based on actual DOM height
      const filePrefix = `${pid}:file:`
      const fileIdxs = next
        .map((n, i) => ({ n, i }))
        .filter(({ n }) => n.id.startsWith(filePrefix))
        .sort((a, b) => a.n.position.y - b.n.position.y)

      if (fileIdxs.length > 0) {
        let currentY = fileIdxs[0].n.position.y
        const gap = 8

        for (const { n, i } of fileIdxs) {
          const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null
          const h = el ? el.getBoundingClientRect().height : 40
          next[i] = { ...n, position: { ...n.position, y: currentY } }
          currentY += h / (reactFlow.getZoom()) + gap
        }
      }

      // 2. Push col2+ right if file nodes are wide
      let maxFileRight = 0
      for (const { n } of fileIdxs) {
        const el = document.querySelector(`[data-id="${n.id}"]`) as HTMLElement | null
        if (el) {
          const w = el.getBoundingClientRect().width / reactFlow.getZoom()
          const right = n.position.x + w
          if (right > maxFileRight) maxFileRight = right
        }
      }

      if (maxFileRight > 0) {
        const minColGap = 60 // min gap between file nodes and col2
        const col2Ids = [`${pid}:sessions`, `${pid}:connections`]
        const col3Ids = [`${pid}:memory`, `${pid}:workspace`]

        for (let i = 0; i < next.length; i++) {
          const n = next[i]
          if (col2Ids.includes(n.id)) {
            const newX = Math.max(n.position.x, maxFileRight + minColGap)
            if (newX !== n.position.x) {
              next[i] = { ...n, position: { ...n.position, x: newX } }
            }
          }
        }

        // Measure col2 max right for col3
        let maxCol2Right = 0
        for (let i = 0; i < next.length; i++) {
          if (col2Ids.includes(next[i].id)) {
            const el = document.querySelector(`[data-id="${next[i].id}"]`) as HTMLElement | null
            const w = el ? el.getBoundingClientRect().width / reactFlow.getZoom() : 300
            const right = next[i].position.x + w
            if (right > maxCol2Right) maxCol2Right = right
          }
        }

        if (maxCol2Right > 0) {
          for (let i = 0; i < next.length; i++) {
            if (col3Ids.includes(next[i].id)) {
              const newX = Math.max(next[i].position.x, maxCol2Right + minColGap)
              if (newX !== next[i].position.x) {
                next[i] = { ...next[i], position: { ...next[i].position, x: newX } }
              }
            }
          }
        }
      }

      // Final pass: resolve any remaining overlaps
      return resolveOverlaps(next, reactFlow.getZoom())
    })
  }, [viewState, selectedAgent, reactFlow])

  useOnRelayout(handleRelayout)

  // Enter agent detail
  const enterAgent = useCallback((agent: AgentData) => {
    // Remember the agent node's current position
    const agentNode = localNodes.find(n => n.id === agent.id)
    const agentPos = agentNode?.position || { x: 0, y: 0 }

    setSelectedAgent(agent)
    setViewState('transitioning')

    fetch(`/api/agents/${agent.id}/detail`)
      .then(r => r.json())
      .then(detail => {
        const color = getAgentColor(agent)
        const agentConns = connections.filter(c => c.from === agent.id || c.to === agent.id)
        const { nodes, edges } = buildDetailNodes(agent, agentPos, detail, agentConns, color)
        setLocalNodes(nodes)
        setLocalEdges(edges)
        setViewState('detail')

        setTimeout(() => {
          reactFlow.fitView({ padding: 0.12, duration: 500 })
        }, 50)
      })
      .catch(() => {
        setViewState('agents')
        setSelectedAgent(null)
      })
  }, [connections, reactFlow, localNodes])

  // Exit back to agents
  const exitAgent = useCallback(() => {
    const agentId = selectedAgent?.id
    const currentAgentNode = agentId ? localNodes.find(n => n.id === agentId) : null
    if (currentAgentNode && agentId) {
      savedPos.current[agentId] = currentAgentNode.position
      savePositions(savedPos.current)
    }

    setViewState('transitioning')

    // Step 1: Remove detail nodes but keep agent nodes (collapse effect)
    const { nodes: agentNodes, edges: agentEdges } = buildAgentGraph()
    const restored = agentNodes.map(n => {
      if (savedPos.current[n.id]) return { ...n, position: savedPos.current[n.id] }
      return n
    })

    // Brief pause to let the detail nodes disappear visually
    setLocalEdges(agentEdges)
    setLocalNodes(restored)

    // Step 2: Smooth zoom out to show all agents
    setTimeout(() => {
      setSelectedAgent(null)
      setViewState('agents')
      reactFlow.fitView({ padding: 0.3, duration: 600 })
    }, 100)
  }, [buildAgentGraph, reactFlow, selectedAgent, localNodes])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (viewState === 'agents' && node.type === 'agentNode') {
      const agent = agents.find(a => a.id === node.id)
      if (agent) enterAgent(agent)
    }
  }, [viewState, agents, enterAgent])

  const onNodesChange = useCallback((changes: any) => {
    const hasDragEnd = changes.some((c: any) => c.type === 'position' && c.dragging === false)

    setLocalNodes(prev => {
      let next = prev.map(n => {
        // Handle position changes (drag)
        const posChange = changes.find((c: any) => c.id === n.id && c.type === 'position')
        if (posChange?.position) {
          if (viewState === 'agents' && !n.id.includes(':')) savedPos.current[n.id] = posChange.position
          return { ...n, position: posChange.position }
        }
        // Handle selection changes
        const selChange = changes.find((c: any) => c.id === n.id && c.type === 'select')
        if (selChange) {
          return { ...n, selected: selChange.selected }
        }
        return n
      })

      // On drag end: resolve overlaps
      if (hasDragEnd) {
        // Save positions for all agent nodes that were part of selection
        next.forEach(n => {
          if (viewState === 'agents' && !n.id.includes(':') && savedPos.current[n.id] !== n.position) {
            savedPos.current[n.id] = n.position
          }
        })
        next = resolveOverlaps(next, reactFlow.getZoom())
        if (viewState === 'agents') savePositions(savedPos.current)
      }

      return next
    })
  }, [viewState, reactFlow])

  // ESC to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewState === 'detail') exitAgent()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [viewState, exitAgent])

  const color = selectedAgent ? getAgentColor(selectedAgent) : '#555'

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        proOptions={proOptions}
        fitView={viewState === 'agents'}
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.15}
        maxZoom={2.5}
        nodesDraggable={viewState !== 'transitioning'}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        connectOnClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a22" />
        <Controls
          showInteractive={false}
          className="!bg-[#0a0a10] !border-[#1a1a22] !shadow-none [&>button]:!bg-[#0a0a10] [&>button]:!border-[#1a1a22] [&>button]:!text-[#555] [&>button:hover]:!bg-[#111118]"
        />
        {viewState === 'agents' && (
          <MiniMap
            nodeColor={(n) => {
              const a = n.data as AgentData
              return ({ active: '#00ff88', idle: '#555', thinking: '#60a5fa', error: '#f87171' })[a?.status] ?? '#555'
            }}
            maskColor="#04040799"
            className="!bg-[#0a0a10] !border-[#1a1a22]"
            pannable zoomable
          />
        )}
      </ReactFlow>

      {/* Breadcrumb / back button */}
      <AnimatePresence>
        {viewState === 'detail' && selectedAgent && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-4 left-4 z-50 flex items-center gap-2"
          >
            <button
              onClick={exitAgent}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer"
              style={{
                background: '#0a0a10e0',
                border: `1px solid ${color}30`,
                backdropFilter: 'blur(12px)',
                color: '#ddd',
              }}
            >
              <ArrowLeft size={14} style={{ color }} />
              <span className="text-[10px] font-mono text-[#555]">Agents</span>
              <span className="text-[10px] font-mono text-[#333]">/</span>
              <span className="text-[11px] font-bold" style={{ color }}>{selectedAgent.label}</span>
            </button>
            <span className="text-[9px] font-mono text-[#333]">ESC to go back</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {viewState === 'transitioning' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: '#0a0a10e0', border: '1px solid #1a1a22' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
              <span className="text-[10px] font-mono text-[#555]">Loading...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {localNodes.length === 0 && viewState === 'agents' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-xs font-mono">Loading agents...</div>
        </div>
      )}

      {/* Drag-to-create popover */}
      <GraphCreator state={creatorState} onClose={() => setCreatorState(null)} />

      {/* Hint: drag from handle */}
      {viewState === 'agents' && localNodes.length > 0 && !creatorState && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-mono text-[#2a2a33] bg-[#08080f80]">
            drag from a node handle to create
          </div>
        </div>
      )}
    </div>
  )
}

function getAgentColor(agent?: AgentData | null): string {
  if (!agent) return '#555'
  return ({ active: '#00ff88', thinking: '#60a5fa', idle: '#555', error: '#f87171' } as any)[agent.status] || '#555'
}

export function GraphView() {
  return (
    <div className="flex-1 relative h-full">
      <ReactFlowProvider>
        <GraphInner />
      </ReactFlowProvider>
    </div>
  )
}
