import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant, MarkerType,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useHubStore } from '../store'
import type { AgentData, CronJob, SubAgent, GraphData } from '../store'
import AgentNodeComponent from './AgentNode'
import { CronNodeComponent } from './CronNode'
import { SubAgentNodeComponent } from './SubAgentNode'
import { WorkspaceNodeComponent } from './WorkspaceNode'
import { AgentDetail } from './AgentDetail'

const nodeTypes = {
  agentNode: AgentNodeComponent,
  cronNode: CronNodeComponent,
  subagentNode: SubAgentNodeComponent,
  workspaceNode: WorkspaceNodeComponent,
}

const proOptions = { hideAttribution: true }

const edgeDefaults = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#2a2a33', strokeWidth: 1 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#2a2a33', width: 12, height: 12 },
}

function buildGraph(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  if (!graphData) return { nodes, edges }

  const { agents, cronJobs, subagents, workspaces } = graphData

  // ── Agent nodes — center row ──
  const agentSpacing = 400
  const agentY = 0
  agents.forEach((agent, i) => {
    const x = i * agentSpacing
    nodes.push({
      id: `agent:${agent.id}`,
      type: 'agentNode',
      position: { x, y: agentY },
      data: agent,
    })
  })

  // ── Connections between agents ──
  agents.forEach((agent, i) => {
    if (agent.id !== 'main' && agents[0]?.id === 'main') {
      edges.push({
        id: `edge:main→${agent.id}`,
        source: 'agent:main',
        target: `agent:${agent.id}`,
        ...edgeDefaults,
        animated: agent.status === 'active' || agent.status === 'thinking',
        style: {
          stroke: agent.status === 'active' ? '#00ff8840' : agent.status === 'thinking' ? '#60a5fa40' : '#1a1a22',
          strokeWidth: agent.status === 'active' ? 2 : 1,
        },
        label: agent.status === 'active' ? 'active' : undefined,
        labelStyle: { fill: '#555', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
        labelBgStyle: { fill: '#0a0a10', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
      })
    }
  })

  // ── Cron job nodes — below their parent agent ──
  const cronsByAgent = new Map<string, CronJob[]>()
  cronJobs.forEach(cron => {
    const list = cronsByAgent.get(cron.agentId) || []
    list.push(cron)
    cronsByAgent.set(cron.agentId, list)
  })

  cronsByAgent.forEach((crons, agentId) => {
    const agentIdx = agents.findIndex(a => a.id === agentId)
    if (agentIdx < 0) return
    const agentX = agentIdx * agentSpacing
    const cronSpacing = 220
    const startX = agentX - ((crons.length - 1) * cronSpacing) / 2

    crons.forEach((cron, i) => {
      const nodeId = `cron:${cron.id}`
      nodes.push({
        id: nodeId,
        type: 'cronNode',
        position: { x: startX + i * cronSpacing, y: agentY + 200 },
        data: cron,
      })
      edges.push({
        id: `edge:${agentId}→cron:${cron.id}`,
        source: `agent:${agentId}`,
        target: nodeId,
        ...edgeDefaults,
        animated: cron.enabled,
        style: {
          stroke: cron.enabled ? '#00ff8830' : '#1a1a22',
          strokeWidth: 1,
          strokeDasharray: cron.enabled ? undefined : '4 4',
        },
        label: cron.schedule,
        labelStyle: { fill: '#444', fontSize: 8, fontFamily: 'JetBrains Mono, monospace' },
        labelBgStyle: { fill: '#0a0a10', fillOpacity: 0.9 },
        labelBgPadding: [3, 2] as [number, number],
        labelBgBorderRadius: 3,
      })
    })
  })

  // ── Subagent nodes — above their parent agent ──
  const subsByAgent = new Map<string, SubAgent[]>()
  subagents.forEach(sub => {
    const list = subsByAgent.get(sub.agentId) || []
    list.push(sub)
    subsByAgent.set(sub.agentId, list)
  })

  subsByAgent.forEach((subs, agentId) => {
    const agentIdx = agents.findIndex(a => a.id === agentId)
    if (agentIdx < 0) return
    const agentX = agentIdx * agentSpacing
    const subSpacing = 220
    const startX = agentX - ((subs.length - 1) * subSpacing) / 2

    subs.forEach((sub, i) => {
      const nodeId = `sub:${sub.id}`
      nodes.push({
        id: nodeId,
        type: 'subagentNode',
        position: { x: startX + i * subSpacing, y: agentY - 180 },
        data: sub,
      })
      edges.push({
        id: `edge:${agentId}→sub:${sub.id}`,
        source: `agent:${agentId}`,
        target: nodeId,
        ...edgeDefaults,
        animated: sub.status === 'running',
        style: {
          stroke: sub.status === 'running' ? '#60a5fa40' : '#1a1a22',
          strokeWidth: 1,
        },
      })
    })
  })

  // ── Workspace nodes — to the side of each agent ──
  agents.forEach((agent, i) => {
    const ws = workspaces[agent.id]
    if (!ws) return
    const nodeId = `ws:${agent.id}`
    nodes.push({
      id: nodeId,
      type: 'workspaceNode',
      position: { x: i * agentSpacing + 250, y: agentY + 20 },
      data: { agentId: agent.id, ...ws },
    })
    edges.push({
      id: `edge:${agent.id}→ws`,
      source: `agent:${agent.id}`,
      target: nodeId,
      ...edgeDefaults,
      style: { stroke: '#1a1a22', strokeWidth: 1, strokeDasharray: '2 3' },
    })
  })

  return { nodes, edges }
}

export function GraphView() {
  const { graphData, setGraphData, setSelectedAgent, agents } = useHubStore()
  const [localNodes, setLocalNodes] = useState<Node[]>([])
  const [localEdges, setLocalEdges] = useState<Edge[]>([])

  // Fetch graph data
  useEffect(() => {
    fetch('/api/graph').then(r => r.json()).then(setGraphData).catch(() => {})
    const interval = setInterval(() => {
      fetch('/api/graph').then(r => r.json()).then(setGraphData).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [setGraphData])

  // Build nodes/edges from graph data
  useEffect(() => {
    if (!graphData) return
    const { nodes, edges } = buildGraph(graphData)
    setLocalNodes(nodes)
    setLocalEdges(edges)
  }, [graphData])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.id.startsWith('agent:')) {
      const agentId = node.id.replace('agent:', '')
      const agent = agents.find(a => a.id === agentId)
      if (agent) setSelectedAgent(agent as AgentData)
    }
  }, [agents, setSelectedAgent])

  const onNodesChange = useCallback((changes: any) => {
    setLocalNodes(prev => prev.map(n => {
      const change = changes.find((c: any) => c.id === n.id && c.type === 'position')
      if (change?.position) return { ...n, position: change.position }
      return n
    }))
  }, [])

  return (
    <div className="flex-1 relative h-full">
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={edgeDefaults}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1a1a22" />
        <Controls showInteractive={false} className="!bg-[#0a0a10] !border-[#1a1a22] !shadow-none [&>button]:!bg-[#0a0a10] [&>button]:!border-[#1a1a22] [&>button]:!text-[#555] [&>button:hover]:!bg-[#111118]" />
        <MiniMap
          nodeColor={(n) => {
            if (n.id.startsWith('cron:')) return n.data?.enabled ? '#00ff8860' : '#33333360'
            if (n.id.startsWith('sub:')) return '#60a5fa60'
            if (n.id.startsWith('ws:')) return '#33333340'
            const a = n.data as AgentData
            return ({ active: '#00ff88', idle: '#555', thinking: '#60a5fa', error: '#f87171' })[a?.status] ?? '#555'
          }}
          maskColor="#04040799"
          className="!bg-[#0a0a10] !border-[#1a1a22]"
          pannable
          zoomable
        />
      </ReactFlow>

      <AgentDetail />

      {localNodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#333] pointer-events-none">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-xs font-mono">Loading agent graph...</div>
        </div>
      )}
    </div>
  )
}
