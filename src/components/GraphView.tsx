import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant, useReactFlow,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData, Connection } from '../store'
import AgentNode from './AgentNode'
import { detailNodeTypes } from './DetailNodes'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

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

  // Detail nodes fan out to the right of the agent node
  let y = agentPos.y - 100
  const colX = agentPos.x + 320

  // Files — individual file nodes
  if (detail?.files) {
    const fileEntries = Object.entries(detail.files).filter(([, v]) => v !== null)
    for (const [key, content] of fileEntries) {
      const nid = `${pid}:file:${key}`
      nodes.push({
        id: nid,
        type: 'fileNode',
        position: { x: colX, y },
        data: { name: `${key.toUpperCase()}.md`, content, color },
      })
      edges.push({
        id: `e:${pid}→${nid}`,
        source: pid,
        target: nid,
        style: { stroke: color + '15', strokeWidth: 1, strokeDasharray: '4 4' },
      })
      y += 55
    }
  }

  // Second column
  let y2 = agentPos.y - 100
  const col2X = agentPos.x + 640

  // Sessions
  const sessId = `${pid}:sessions`
  nodes.push({
    id: sessId,
    type: 'sessionsNode',
    position: { x: col2X, y: y2 },
    data: { sessions: detail?.sessions || [], color: '#60a5fa' },
  })
  edges.push({
    id: `e:${pid}→${sessId}`,
    source: pid,
    target: sessId,
    style: { stroke: '#60a5fa15', strokeWidth: 1 },
  })
  y2 += 280

  // Connections
  const connId = `${pid}:connections`
  nodes.push({
    id: connId,
    type: 'connectionsNode',
    position: { x: col2X, y: y2 },
    data: { connections: agentConnections, color: '#00ff88' },
  })
  edges.push({
    id: `e:${pid}→${connId}`,
    source: pid,
    target: connId,
    style: { stroke: '#00ff8815', strokeWidth: 1 },
  })
  y2 += 180

  // Third column
  let y3 = agentPos.y - 100
  const col3X = agentPos.x + 960

  // Memory
  const memId = `${pid}:memory`
  nodes.push({
    id: memId,
    type: 'memoryNode',
    position: { x: col3X, y: y3 },
    data: { memories: detail?.recentMemories || [], color: '#c084fc' },
  })
  edges.push({
    id: `e:${pid}→${memId}`,
    source: pid,
    target: memId,
    style: { stroke: '#c084fc15', strokeWidth: 1 },
  })
  y3 += 280

  // Workspace
  const wsId = `${pid}:workspace`
  nodes.push({
    id: wsId,
    type: 'workspaceNode',
    position: { x: col3X, y: y3 },
    data: { files: detail?.workspaceFiles || [], color: '#f59e0b' },
  })
  edges.push({
    id: `e:${pid}→${wsId}`,
    source: pid,
    target: wsId,
    style: { stroke: '#f59e0b15', strokeWidth: 1 },
  })

  return { nodes, edges }
}

type ViewState = 'agents' | 'transitioning' | 'detail'

function GraphInner() {
  const agents = useHubStore(s => s.agents)
  const connections = useHubStore(s => s.connections)
  const [viewState, setViewState] = useState<ViewState>('agents')
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null)
  const [agentDetail, setAgentDetail] = useState<any>(null)
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])
  const savedPos = useRef(loadPositions())
  const reactFlow = useReactFlow()

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
        setAgentDetail(detail)
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
    // Grab the agent node's current position before we clear detail nodes
    const agentId = selectedAgent?.id
    const currentAgentNode = agentId ? localNodes.find(n => n.id === agentId) : null
    if (currentAgentNode && agentId) {
      savedPos.current[agentId] = currentAgentNode.position
      savePositions(savedPos.current)
    }

    setViewState('transitioning')
    setSelectedAgent(null)
    setAgentDetail(null)

    const { nodes, edges } = buildAgentGraph()
    setLocalNodes(nodes.map(n => {
      if (savedPos.current[n.id]) return { ...n, position: savedPos.current[n.id] }
      return n
    }))
    setLocalEdges(edges)
    setViewState('agents')

    setTimeout(() => {
      reactFlow.fitView({ padding: 0.3, duration: 500 })
    }, 50)
  }, [buildAgentGraph, reactFlow, selectedAgent, localNodes])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (viewState === 'agents' && node.type === 'agentNode') {
      const agent = agents.find(a => a.id === node.id)
      if (agent) enterAgent(agent)
    }
  }, [viewState, agents, enterAgent])

  const onNodesChange = useCallback((changes: any) => {
    setLocalNodes(prev => {
      const next = prev.map(n => {
        const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
        if (change?.position) {
          if (viewState === 'agents' && !n.id.includes(':')) savedPos.current[n.id] = change.position
          return { ...n, position: change.position }
        }
        return n
      })
      if (viewState === 'agents' && changes.some((c: any) => c.type === 'position' && c.dragging === false)) {
        savePositions(savedPos.current)
      }
      return next
    })
  }, [viewState])

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
        proOptions={proOptions}
        fitView={viewState === 'agents'}
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.15}
        maxZoom={2.5}
        nodesDraggable={viewState !== 'transitioning'}
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
