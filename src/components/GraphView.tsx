import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData, Connection } from '../store'
import AgentNode from './AgentNode'
import { detailNodeTypes } from './DetailNodes'

const nodeTypes = {
  agentNode: AgentNode,
  ...detailNodeTypes,
}
const proOptions = { hideAttribution: true }
const POSITIONS_KEY = 'aihub-graph-positions'

function loadPositions(): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') } catch { return {} }
}
function savePositions(pos: Record<string, { x: number; y: number }>) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos))
}

// Detail node layout: radial positions around parent
const DETAIL_SLOTS = [
  { key: 'stats',       angle: -60,  dist: 320, label: 'Overview' },
  { key: 'files',       angle: -20,  dist: 350, label: 'Files' },
  { key: 'sessions',    angle: 20,   dist: 350, label: 'Sessions' },
  { key: 'connections', angle: 60,   dist: 320, label: 'Connections' },
  { key: 'memory',      angle: 100,  dist: 340, label: 'Memory' },
  { key: 'workspace',   angle: 140,  dist: 320, label: 'Workspace' },
]

function buildDetailNodes(
  agent: AgentData,
  parentPos: { x: number; y: number },
  detail: any,
  agentConnections: Connection[],
  color: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const parentId = agent.id

  for (const slot of DETAIL_SLOTS) {
    const rad = (slot.angle * Math.PI) / 180
    const x = parentPos.x + slot.dist * Math.cos(rad)
    const y = parentPos.y + slot.dist * Math.sin(rad)
    const nodeId = `${parentId}:${slot.key}`

    let nodeType = ''
    let nodeData: any = {}

    switch (slot.key) {
      case 'stats':
        nodeType = 'statsNode'
        nodeData = { agent, color }
        break
      case 'files':
        // Create individual file nodes instead of one big node
        if (detail?.files) {
          const fileEntries = Object.entries(detail.files).filter(([, v]) => v !== null)
          fileEntries.forEach(([key, content], fi) => {
            const fRad = ((slot.angle - 15 + fi * 12) * Math.PI) / 180
            const fDist = slot.dist + 60 + fi * 30
            const fId = `${parentId}:file:${key}`
            nodes.push({
              id: fId,
              type: 'fileNode',
              position: { x: parentPos.x + fDist * Math.cos(fRad), y: parentPos.y + fDist * Math.sin(fRad) },
              data: { name: `${key.toUpperCase()}.md`, content, color },
            })
            edges.push({
              id: `e:${parentId}→${fId}`,
              source: parentId,
              target: fId,
              style: { stroke: color + '20', strokeWidth: 1, strokeDasharray: '4 4' },
            })
          })
        }
        continue // Skip the slot node, we made individual file nodes
      case 'sessions':
        nodeType = 'sessionsNode'
        nodeData = { sessions: detail?.sessions || [], color: '#60a5fa' }
        break
      case 'connections':
        nodeType = 'connectionsNode'
        nodeData = { connections: agentConnections, color: '#00ff88' }
        break
      case 'memory':
        nodeType = 'memoryNode'
        nodeData = { memories: detail?.recentMemories || [], color: '#c084fc' }
        break
      case 'workspace':
        nodeType = 'workspaceNode'
        nodeData = { files: detail?.workspaceFiles || [], color: '#f59e0b' }
        break
    }

    if (!nodeType) continue

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x, y },
      data: nodeData,
    })

    edges.push({
      id: `e:${parentId}→${nodeId}`,
      source: parentId,
      target: nodeId,
      style: { stroke: color + '25', strokeWidth: 1 },
      animated: false,
    })
  }

  return { nodes, edges }
}

function GraphInner() {
  const agents = useHubStore(s => s.agents)
  const connections = useHubStore(s => s.connections)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [agentDetail, setAgentDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])
  const savedPos = useRef(loadPositions())

  // Base nodes from agents
  const buildBaseGraph = useCallback(() => {
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
      style: {
        stroke: c.active ? '#00ff88' : '#333',
        strokeWidth: c.active ? 2 : 1,
        opacity: c.active ? 0.8 : 0.3,
      },
      label: c.label || undefined,
    }))

    return { nodes, edges }
  }, [agents, connections])

  // Rebuild on agent/connection changes
  useEffect(() => {
    const { nodes, edges } = buildBaseGraph()

    setLocalNodes(prev => {
      // Keep existing positions for agent nodes, remove stale detail nodes
      const agentNodes = nodes.map(n => {
        const existing = prev.find(p => p.id === n.id)
        if (existing && !n.id.includes(':')) return { ...n, position: existing.position, data: n.data }
        return n
      })

      // Re-add detail nodes if agent is still expanded
      if (expandedAgent && agentDetail) {
        const parentNode = agentNodes.find(n => n.id === expandedAgent)
        if (parentNode) {
          const color = getAgentColor(agents.find(a => a.id === expandedAgent))
          const agentConns = connections.filter(c => c.from === expandedAgent || c.to === expandedAgent)
          const { nodes: detailNodes } = buildDetailNodes(
            agents.find(a => a.id === expandedAgent)!,
            parentNode.position,
            agentDetail,
            agentConns,
            color,
          )
          // Preserve detail node positions too
          const mergedDetail = detailNodes.map(dn => {
            const existing = prev.find(p => p.id === dn.id)
            return existing ? { ...dn, position: existing.position } : dn
          })
          return [...agentNodes, ...mergedDetail]
        }
      }

      return agentNodes
    })

    setLocalEdges(prev => {
      const { edges: baseEdges } = buildBaseGraph()
      if (expandedAgent && agentDetail) {
        const parentNode = localNodes.find(n => n.id === expandedAgent)
        if (parentNode) {
          const color = getAgentColor(agents.find(a => a.id === expandedAgent))
          const agentConns = connections.filter(c => c.from === expandedAgent || c.to === expandedAgent)
          const { edges: detailEdges } = buildDetailNodes(
            agents.find(a => a.id === expandedAgent)!,
            parentNode.position,
            agentDetail,
            agentConns,
            color,
          )
          return [...baseEdges, ...detailEdges]
        }
      }
      return baseEdges
    })
  }, [agents, connections, expandedAgent, agentDetail])

  // Fetch detail when expanding
  useEffect(() => {
    if (!expandedAgent) {
      setAgentDetail(null)
      return
    }
    setDetailLoading(true)
    fetch(`/api/agents/${expandedAgent}/detail`)
      .then(r => r.json())
      .then(d => { setAgentDetail(d); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
  }, [expandedAgent])

  // When detail loads, rebuild nodes
  useEffect(() => {
    if (!expandedAgent || !agentDetail) return
    const parentNode = localNodes.find(n => n.id === expandedAgent)
    if (!parentNode) return

    const agent = agents.find(a => a.id === expandedAgent)
    if (!agent) return

    const color = getAgentColor(agent)
    const agentConns = connections.filter(c => c.from === expandedAgent || c.to === expandedAgent)
    const { nodes: detailNodes, edges: detailEdges } = buildDetailNodes(agent, parentNode.position, agentDetail, agentConns, color)

    setLocalNodes(prev => {
      const withoutDetail = prev.filter(n => !n.id.startsWith(`${expandedAgent}:`))
      return [...withoutDetail, ...detailNodes]
    })
    setLocalEdges(prev => {
      const withoutDetail = prev.filter(e => !e.id.startsWith(`e:${expandedAgent}→`))
      return [...withoutDetail, ...detailEdges]
    })
  }, [agentDetail])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    // Only toggle expand on agent nodes
    if (node.type === 'agentNode') {
      setExpandedAgent(prev => {
        if (prev === node.id) {
          // Collapse: remove detail nodes
          setLocalNodes(p => p.filter(n => !n.id.startsWith(`${prev}:`)))
          setLocalEdges(p => p.filter(e => !e.id.startsWith(`e:${prev}→`)))
          return null
        }
        // Collapse previous if any
        if (prev) {
          setLocalNodes(p => p.filter(n => !n.id.startsWith(`${prev}:`)))
          setLocalEdges(p => p.filter(e => !e.id.startsWith(`e:${prev}→`)))
        }
        return node.id
      })
    }
  }, [])

  const onNodesChange = useCallback((changes: any) => {
    setLocalNodes(prev => {
      const next = prev.map(n => {
        const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
        if (change?.position) {
          // Only save agent node positions
          if (!n.id.includes(':')) savedPos.current[n.id] = change.position
          return { ...n, position: change.position }
        }
        return n
      })
      if (changes.some((c: any) => c.type === 'position' && c.dragging === false)) {
        savePositions(savedPos.current)
      }
      return next
    })
  }, [])

  const onPaneClick = useCallback(() => {
    if (expandedAgent) {
      setLocalNodes(p => p.filter(n => !n.id.startsWith(`${expandedAgent}:`)))
      setLocalEdges(p => p.filter(e => !e.id.startsWith(`e:${expandedAgent}→`)))
      setExpandedAgent(null)
    }
  }, [expandedAgent])

  // ESC to collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedAgent) {
        setLocalNodes(p => p.filter(n => !n.id.startsWith(`${expandedAgent}:`)))
        setLocalEdges(p => p.filter(e => !e.id.startsWith(`e:${expandedAgent}→`)))
        setExpandedAgent(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expandedAgent])

  return (
    <ReactFlow
      nodes={localNodes}
      edges={localEdges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onNodesChange={onNodesChange}
      onPaneClick={onPaneClick}
      proOptions={proOptions}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2.5}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a22" />
      <Controls
        showInteractive={false}
        className="!bg-[#0a0a10] !border-[#1a1a22] !shadow-none [&>button]:!bg-[#0a0a10] [&>button]:!border-[#1a1a22] [&>button]:!text-[#555] [&>button:hover]:!bg-[#111118]"
      />
      <MiniMap
        nodeColor={(n) => {
          if (n.type !== 'agentNode') return '#1a1a22'
          const a = n.data as AgentData
          return ({ active: '#00ff88', idle: '#555', thinking: '#60a5fa', error: '#f87171' })[a?.status] ?? '#555'
        }}
        maskColor="#04040799"
        className="!bg-[#0a0a10] !border-[#1a1a22]"
        pannable zoomable
      />
    </ReactFlow>
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
