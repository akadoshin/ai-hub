import { useCallback, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import type { NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import AgentNode from './AgentNode'
import { GraphDetailPanel } from './GraphDetailPanel'

const nodeTypes = { agentNode: AgentNode }
const proOptions = { hideAttribution: true }

export function GraphView() {
  const { nodes, edges, setNodesEdges, agents, connections } = useHubStore()
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedAgentId(prev => prev === node.id ? null : node.id)
  }, [])

  const onNodesChange = useCallback((changes: any) => {
    const next = nodes.map(n => {
      const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
      if (change?.position) return { ...n, position: change.position }
      return n
    })
    setNodesEdges(next, edges)
  }, [nodes, edges, setNodesEdges])

  const onPaneClick = useCallback(() => {
    setSelectedAgentId(null)
  }, [])

  return (
    <div className="flex-1 relative h-full flex">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
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
      </div>

      {selectedAgentId && (
        <GraphDetailPanel
          agentId={selectedAgentId}
          graphData={{ agents, sessions: [], connections, cronJobs: [], subagents: [], workspaces: {} } as any}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-xs font-mono">Loading agents...</div>
        </div>
      )}
    </div>
  )
}
