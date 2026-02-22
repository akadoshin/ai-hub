import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant, useReactFlow,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import AgentNode from './AgentNode'
import { AgentOverlay } from './AgentOverlay'

const nodeTypes = { agentNode: AgentNode }
const proOptions = { hideAttribution: true }
const POSITIONS_KEY = 'aihub-graph-positions'

function loadPositions(): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') } catch { return {} }
}
function savePositions(pos: Record<string, { x: number; y: number }>) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(pos))
}

function GraphInner() {
  const agents = useHubStore(s => s.agents)
  const connections = useHubStore(s => s.connections)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])
  const savedPos = useRef(loadPositions())

  useEffect(() => {
    if (!agents.length) return

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

    setLocalNodes(prev => {
      return nodes.map(n => {
        const existing = prev.find(p => p.id === n.id)
        if (existing) return { ...n, position: existing.position, data: n.data }
        return n
      })
    })
    setLocalEdges(edges)
  }, [agents, connections])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedAgentId(prev => prev === node.id ? null : node.id)
  }, [])

  const onNodesChange = useCallback((changes: any) => {
    setLocalNodes(prev => {
      const next = prev.map(n => {
        const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
        if (change?.position) {
          savedPos.current[n.id] = change.position
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
    setSelectedAgentId(null)
  }, [])

  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null

  return (
    <>
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
        minZoom={0.3}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a22" />
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

      {selectedAgent && (
        <AgentOverlay
          agent={selectedAgent}
          connections={connections.filter(c => c.from === selectedAgentId || c.to === selectedAgentId)}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {localNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-xs font-mono">Loading agents...</div>
        </div>
      )}
    </>
  )
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
