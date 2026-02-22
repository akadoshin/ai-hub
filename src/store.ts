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
  key?: string
  label: string
  model: string
  status: 'running' | 'completed' | 'failed'
  type?: 'cron' | 'spawn'
  elapsed: number
  startTime: number
  lastMessage: string
  agentId?: string
  parentAgent?: string
  targetAgent?: string
}

export interface AgentDetail {
  id: string
  workspace: string
  files: {
    soul: string | null
    memory: string | null
    identity: string | null
    tools: string | null
    heartbeat: string | null
    agents: string | null
    user: string | null
  }
  recentMemories: { name: string; date: string; preview: string | null }[]
  sessions: {
    key: string; label: string; model: string; status: string
    type: string; updatedAt: number; lastActivity: string
    contextTokens: number; reasoningLevel: string
  }[]
  crons: any[]
  spawns: any[]
  workspaceFiles: { name: string; type: string }[]
  stats: {
    totalSessions: number; activeSessions: number
    cronCount: number; spawnCount: number; fileCount: number
  }
}

export interface CronJob {
  id: string; name: string; agentId: string; enabled: boolean
  schedule: string; sessionTarget: string; model: string | null
  payload: string; delivery: string
  state: {
    lastStatus: string; lastRunAt: number; lastDuration: number
    nextRunAt: number; consecutiveErrors: number; lastActivity: string
  }
}

export interface SubAgent {
  id: string; key: string; agentId: string; model: string
  label: string; status: string; lastActivity: string; lastActivityMs: number
}

export interface WorkspaceInfo {
  path: string; files: string[]; dirs: string[]
}

export interface GraphData {
  agents: AgentData[]; sessions: Task[]; connections: Connection[]
  cronJobs: CronJob[]; subagents: SubAgent[]
  workspaces: Record<string, WorkspaceInfo>
}

export interface Connection {
  id: string
  from: string
  to: string
  type: 'hierarchy' | 'task' | 'cron'
  active: boolean
  strength: number // 0-1
  label: string
  taskCount: number
  runningCount: number
}

interface HubState {
  connected: boolean
  agents: AgentData[]
  tasks: Task[]
  connections: Connection[]
  nodes: Node[]
  edges: Edge[]
  selectedAgent: AgentData | null
  focusedAgent: AgentData | null
  agentDetail: AgentDetail | null
  loadingDetail: boolean
  graphData: GraphData | null
  stats: { totalAgents: number; activeSessions: number; messagesTotal: number; activeConnections: number }

  setConnected: (v: boolean) => void
  setFullState: (agents: AgentData[], tasks: Task[], connections: Connection[]) => void
  upsertAgent: (agent: AgentData) => void
  upsertTask: (task: Task) => void
  setConnections: (c: Connection[]) => void
  setSelectedAgent: (a: AgentData | null) => void
  focusAgent: (a: AgentData | null) => void
  setAgentDetail: (d: AgentDetail | null) => void
  setLoadingDetail: (v: boolean) => void
  setGraphData: (d: GraphData) => void
  setNodesEdges: (nodes: Node[], edges: Edge[]) => void
  incrementMessages: () => void
  loadMockData: () => void
}

const MOCK_AGENTS: AgentData[] = [
  { id: 'main', label: 'Eugenio', model: 'claude-sonnet-4-6', status: 'active', lastActivity: 'just now', messageCount: 42, description: 'Main assistant — core agent', sessionCount: 3, activeSessions: 1, reasoningLevel: 'low' },
  { id: 'psych', label: 'Psych', model: 'claude-sonnet-4-6', status: 'idle', lastActivity: '5m ago', messageCount: 12, description: 'Background monitoring agent', sessionCount: 2, activeSessions: 0 },
]

const MOCK_TASKS: Task[] = [
  { id: 't1', label: 'ai-hub build', model: 'claude-opus-4-6', status: 'running', type: 'spawn', elapsed: 180, startTime: Date.now() - 180000, lastMessage: 'Building...', agentId: 'main', parentAgent: 'main' },
  { id: 't2', label: 'psych-usage-monitor', model: 'claude-sonnet-4-6', status: 'completed', type: 'cron', elapsed: 45, startTime: Date.now() - 300000, lastMessage: 'OK', agentId: 'psych', parentAgent: 'main' },
  { id: 't3', label: 'heartbeat', model: 'claude-sonnet-4-6', status: 'completed', type: 'cron', elapsed: 3, startTime: Date.now() - 600000, lastMessage: 'HEARTBEAT_OK', agentId: 'main', parentAgent: 'main' },
]

const MOCK_CONNECTIONS: Connection[] = [
  { id: 'main→psych', from: 'main', to: 'psych', type: 'hierarchy', active: false, strength: 0.3, label: '', taskCount: 2, runningCount: 0 },
]

function buildNodesEdges(agents: AgentData[], connections: Connection[]): { nodes: Node[]; edges: Edge[] } {
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
}

export const useHubStore = create<HubState>((set, get) => ({
  connected: false,
  agents: [],
  tasks: [],
  connections: [],
  nodes: [],
  edges: [],
  selectedAgent: null,
  focusedAgent: null,
  agentDetail: null,
  loadingDetail: false,
  graphData: null,
  stats: { totalAgents: 0, activeSessions: 0, messagesTotal: 0, activeConnections: 0 },

  setConnected: (v) => set({ connected: v }),

  setFullState: (agents, tasks, connections) => {
    const sorted = [...agents].sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
    const { nodes, edges } = buildNodesEdges(sorted, connections)
    const activeSessions = sorted.filter(a => a.status === 'active' || a.status === 'thinking').length
    const activeConnections = connections.filter(c => c.active).length
    set({
      agents: sorted,
      tasks,
      connections,
      nodes,
      edges,
      stats: {
        totalAgents: sorted.length,
        activeSessions,
        messagesTotal: sorted.reduce((sum, a) => sum + (a.messageCount || 0), 0),
        activeConnections,
      },
    })
  },

  upsertAgent: (agent) => {
    const agents = [...get().agents.filter(a => a.id !== agent.id), agent]
    const sorted = agents.sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
    const { nodes, edges } = buildNodesEdges(sorted, get().connections)
    const activeSessions = sorted.filter(a => a.status === 'active' || a.status === 'thinking').length
    set({ agents: sorted, nodes, edges, stats: { ...get().stats, totalAgents: sorted.length, activeSessions } })
  },

  upsertTask: (task) => {
    const tasks = [task, ...get().tasks.filter(t => t.id !== task.id)]
    set({ tasks: tasks.slice(0, 50) })
  },

  setConnections: (connections) => {
    const { nodes, edges } = buildNodesEdges(get().agents, connections)
    set({ connections, nodes, edges, stats: { ...get().stats, activeConnections: connections.filter(c => c.active).length } })
  },

  setSelectedAgent: (a) => set({ selectedAgent: a }),
  focusAgent: (a) => set({ focusedAgent: a, agentDetail: null }),
  setAgentDetail: (d) => set({ agentDetail: d }),
  setLoadingDetail: (v) => set({ loadingDetail: v }),
  setGraphData: (d) => set({ graphData: d }),
  setNodesEdges: (nodes, edges) => set({ nodes, edges }),
  incrementMessages: () => set(s => ({ stats: { ...s.stats, messagesTotal: s.stats.messagesTotal + 1 } })),

  loadMockData: () => {
    get().setFullState(MOCK_AGENTS, MOCK_TASKS, MOCK_CONNECTIONS)
  },
}))
