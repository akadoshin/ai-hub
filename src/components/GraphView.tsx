import { useCallback } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant,
} from '@xyflow/react'
import type { NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData } from '../store'
import AgentNode from './AgentNode'
import { AgentDetail } from './AgentDetail'

const nodeTypes = { agentNode: AgentNode }
const proOptions = { hideAttribution: true }

export function GraphView() {
  const { nodes, edges, setNodesEdges, setSelectedAgent, agents } = useHubStore()

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    const agent = agents.find(a => a.id === node.id)
    if (agent) setSelectedAgent(agent as AgentData)
  }, [agents, setSelectedAgent])

  const onNodesChange = useCallback((changes: any) => {
    const next = nodes.map(n => {
      const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
      if (change?.position) return { ...n, position: change.position }
      return n
    })
    setNodesEdges(next, edges)
  }, [nodes, edges, setNodesEdges])

  return (
    <div className="flex-1 relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1a22" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const a = n.data as AgentData
            const colors = { active: '#00ff88', idle: '#555', thinking: '#60a5fa', error: '#f87171' }
            return colors[a?.status] ?? '#555'
          }}
          maskColor="#04040788"
        />
      </ReactFlow>

      <AgentDetail />

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-5xl mb-3">🤖</div>
          <div className="text-sm font-semibold">No agents detected</div>
          <div className="text-xs mt-1">Waiting for OpenClaw connection...</div>
        </div>
      )}
    </div>
  )
}
