import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant, MarkerType,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData, GraphData } from '../store'
import AgentNodeComponent from './AgentNode'
import { GraphDetailPanel } from './GraphDetailPanel'

const nodeTypes = { agentNode: AgentNodeComponent }
const proOptions = { hideAttribution: true }

function buildAgentGraph(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
  if (!graphData) return { nodes: [], edges: [] }

  const { agents, connections } = graphData
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Center agents in a clean horizontal layout
  const spacing = 350
  const totalWidth = (agents.length - 1) * spacing
  const startX = -totalWidth / 2

  agents.forEach((agent, i) => {
    nodes.push({
      id: agent.id,
      type: 'agentNode',
      position: { x: startX + i * spacing, y: 0 },
      data: agent,
    })
  })

  // Connections between agents only
  connections.forEach(conn => {
    if (!agents.find(a => a.id === conn.from) || !agents.find(a => a.id === conn.to)) return
    const isActive = conn.active
    edges.push({
      id: conn.id,
      source: conn.from,
      target: conn.to,
      type: 'smoothstep',
      animated: isActive,
      style: {
        stroke: isActive ? '#00ff8850' : '#1a1a22',
        strokeWidth: isActive ? 2 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: isActive ? '#00ff8850' : '#1a1a22', width: 12, height: 12 },
      label: conn.runningCount > 0 ? `${conn.runningCount} active` : undefined,
      labelStyle: { fill: '#555', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
      labelBgStyle: { fill: '#0a0a10', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
    })
  })

  return { nodes, edges }
}

export function GraphView() {
  const { graphData, setGraphData } = useHubStore()
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Fetch graph data
  useEffect(() => {
    const fetchGraph = () => fetch('/api/graph').then(r => r.json()).then(setGraphData).catch(() => {})
    fetchGraph()
    const interval = setInterval(fetchGraph, 5000)
    return () => clearInterval(interval)
  }, [setGraphData])

  // Build clean agent-only graph
  useEffect(() => {
    if (!graphData) return
    const { nodes, edges } = buildAgentGraph(graphData)
    setLocalNodes(prev => {
      // Preserve positions if nodes already exist
      return nodes.map(n => {
        const existing = prev.find(p => p.id === n.id)
        return existing ? { ...n, position: existing.position } : n
      })
    })
    setLocalEdges(edges)
  }, [graphData])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedAgentId(prev => prev === node.id ? null : node.id)
  }, [])

  const onNodesChange = useCallback((changes: any) => {
    setLocalNodes(prev => prev.map(n => {
      const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
      if (change?.position) return { ...n, position: change.position }
      return n
    }))
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedAgentId(null)
  }, [])

  // Highlight selected node
  const styledNodes = localNodes.map(n => ({
    ...n,
    selected: n.id === selectedAgentId,
  }))

  return (
    <div className="flex-1 relative h-full flex">
      {/* Graph */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={styledNodes}
          edges={localEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodesChange={onNodesChange}
          onPaneClick={onPaneClick}
          proOptions={proOptions}
          fitView
          fitViewOptions={{ padding: 0.5 }}
          minZoom={0.3}
          maxZoom={2.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a22" />
          <Controls
            showInteractive={false}
            className="!bg-[#0a0a10] !border-[#1a1a22] !shadow-none [&>button]:!bg-[#0a0a10] [&>button]:!border-[#1a1a22] [&>button]:!text-[#555] [&>button:hover]:!bg-[#111118]"
          />
          <MiniMap
            nodeColor={(n) => {
              const a = n.data as AgentData
              return ({ active: '#00ff88', idle: '#555', thinking: '#60a5fa', error: '#f87171' })[a?.status] ?? '#555'
            }}
            maskColor="#04040799"
            className="!bg-[#0a0a10] !border-[#1a1a22]"
            pannable zoomable
          />
        </ReactFlow>
      </div>

      {/* Detail panel — Level 2 */}
      {selectedAgentId && graphData && (
        <GraphDetailPanel
          agentId={selectedAgentId}
          graphData={graphData}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {localNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-xs font-mono">Loading agents...</div>
        </div>
      )}
    </div>
  )
}
