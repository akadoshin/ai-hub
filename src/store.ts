import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'

export type AgentStatus = 'active' | 'idle' | 'thinking' | 'error'

export interface AgentData extends Record<string, unknown> {
  id: string
  label: string
  model: string
  status: AgentStatus
  lastActivity: string
  lastActivityMs?: number
  messageCount: number
  sessionKey?: string
  description?: string
  sessionCount?: number
  activeSessions?: number
  contextTokens?: number
  reasoningLevel?: string
}

export interface Task {
  id: string
  label: string
  model: string
  status: 'running' | 'completed' | 'failed'
  elapsed: number
  startTime: number
  lastMessage: string
  agentId?: string
}

interface HubState {
  connected: boolean
  agents: AgentData[]
  tasks: Task[]
  nodes: Node[]
  edges: Edge[]
  selectedAgent: AgentData | null
  stats: { totalAgents: number; activeSessions: number; messagesTotal: number }

  setConnected: (v: boolean) => void
  upsertAgent: (agent: AgentData) => void
  upsertTask: (task: Task) => void
  setSelectedAgent: (a: AgentData | null) => void
  setNodesEdges: (nodes: Node[], edges: Edge[]) => void
  incrementMessages: () => void
  loadMockData: () => void
}

const MOCK_AGENTS: AgentData[] = [
  { id: 'main', label: 'Eugenio (main)', model: 'claude-sonnet-4-6', status: 'active', lastActivity: 'just now', messageCount: 42, description: 'Main assistant session' },
  { id: 'psych', label: 'Psych Agent', model: 'claude-sonnet-4-6', status: 'idle', lastActivity: '5m ago', messageCount: 12, description: 'Background monitoring agent' },
  { id: 'opus-1', label: 'Dev Worker', model: 'claude-opus-4-6', status: 'thinking', lastActivity: '1m ago', messageCount: 7, description: 'Heavy development tasks' },
]

const MOCK_TASKS: Task[] = [
  { id: 't1', label: 'Building ai-hub app', model: 'claude-opus-4-6', status: 'running', elapsed: 180, startTime: Date.now() - 180000, lastMessage: 'Installing npm dependencies...', agentId: 'opus-1' },
  { id: 't2', label: 'Memory maintenance', model: 'claude-sonnet-4-6', status: 'completed', elapsed: 45, startTime: Date.now() - 300000, lastMessage: 'MEMORY.md updated successfully', agentId: 'psych' },
  { id: 't3', label: 'WhatsApp heartbeat', model: 'claude-sonnet-4-6', status: 'completed', elapsed: 3, startTime: Date.now() - 600000, lastMessage: 'HEARTBEAT_OK', agentId: 'main' },
]

function buildNodesEdges(agents: AgentData[]): { nodes: Node[]; edges: Edge[] } {
  const cx = 500, cy = 300, r = 220
  const nodes: Node[] = agents.map((a, i) => {
    const angle = (i / agents.length) * 2 * Math.PI - Math.PI / 2
    return {
      id: a.id,
      type: 'agentNode',
      position: { x: cx + r * Math.cos(angle) - 80, y: cy + r * Math.sin(angle) - 40 },
      data: a,
    }
  })
  const edges: Edge[] = []
  if (agents.length > 1) {
    edges.push({
      id: 'e-main-psych',
      source: 'main',
      target: 'psych',
      animated: true,
      style: { stroke: '#00ff8844' },
    })
  }
  if (agents.find(a => a.id === 'opus-1')) {
    edges.push({
      id: 'e-main-opus',
      source: 'main',
      target: 'opus-1',
      animated: true,
      style: { stroke: '#00ff8866' },
    })
  }
  return { nodes, edges }
}

export const useHubStore = create<HubState>((set, get) => ({
  connected: false,
  agents: [],
  tasks: [],
  nodes: [],
  edges: [],
  selectedAgent: null,
  stats: { totalAgents: 0, activeSessions: 0, messagesTotal: 0 },

  setConnected: (v) => set({ connected: v }),

  upsertAgent: (agent) => {
    const agents = [...get().agents.filter(a => a.id !== agent.id), agent]
    const { nodes, edges } = buildNodesEdges(agents)
    const activeSessions = agents.filter(a => a.status === 'active' || a.status === 'thinking').length
    set({ agents, nodes, edges, stats: { ...get().stats, totalAgents: agents.length, activeSessions } })
  },

  upsertTask: (task) => {
    const tasks = [task, ...get().tasks.filter(t => t.id !== task.id)]
    set({ tasks: tasks.slice(0, 50) })
  },

  setSelectedAgent: (a) => set({ selectedAgent: a }),
  setNodesEdges: (nodes, edges) => set({ nodes, edges }),
  incrementMessages: () => set(s => ({ stats: { ...s.stats, messagesTotal: s.stats.messagesTotal + 1 } })),

  loadMockData: () => {
    const store = get()
    MOCK_AGENTS.forEach(a => store.upsertAgent(a))
    MOCK_TASKS.forEach(t => store.upsertTask(t))
    set(s => ({ stats: { ...s.stats, messagesTotal: 156 } }))
  },
}))
