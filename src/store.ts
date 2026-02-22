import { create } from 'zustand'

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
  totalTokens?: number
  percentUsed?: number
  inputTokens?: number
  outputTokens?: number
  cacheRead?: number
  cacheWrite?: number
  remainingTokens?: number | null
  reasoningLevel?: string
  bootstrapPending?: boolean
}

export interface Task {
  id: string
  key?: string
  label: string
  model: string
  status: 'running' | 'completed' | 'failed'
  type?: 'cron' | 'spawn'
  kind?: string
  elapsed: number
  startTime: number
  lastMessage: string
  agentId?: string
  parentAgent?: string
  targetAgent?: string
  // Token data (from gateway)
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  percentUsed?: number
  contextTokens?: number
  reasoningLevel?: string
  flags?: string[]
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
  stats: { totalAgents: number; activeSessions: number; messagesTotal: number; activeConnections: number }

  // 3D scene state (used by SolarSystem)
  selectedAgent: AgentData | null
  focusedAgent: AgentData | null
  agentDetail: AgentDetail | null
  loadingDetail: boolean

  setConnected: (v: boolean) => void
  setFullState: (agents: AgentData[], tasks: Task[], connections: Connection[]) => void
  upsertAgent: (agent: AgentData) => void
  upsertTask: (task: Task) => void
  removeTask: (id: string) => void
  clearCompletedTasks: () => void
  setConnections: (c: Connection[]) => void
  incrementMessages: () => void
  loadMockData: () => void
  // 3D scene setters
  setSelectedAgent: (a: AgentData | null) => void
  focusAgent: (a: AgentData | null) => void
  setAgentDetail: (d: AgentDetail | null) => void
  setLoadingDetail: (v: boolean) => void
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

export const useHubStore = create<HubState>((set, get) => ({
  connected: false,
  agents: [],
  tasks: [],
  connections: [],
  stats: { totalAgents: 0, activeSessions: 0, messagesTotal: 0, activeConnections: 0 },

  // 3D scene state
  selectedAgent: null,
  focusedAgent: null,
  agentDetail: null,
  loadingDetail: false,

  setConnected: (v) => set({ connected: v }),
  setSelectedAgent: (a) => set({ selectedAgent: a }),
  focusAgent: (a) => set({ focusedAgent: a, agentDetail: null }),
  setAgentDetail: (d) => set({ agentDetail: d }),
  setLoadingDetail: (v) => set({ loadingDetail: v }),

  setFullState: (agents, tasks, connections) => {
    const sorted = [...agents].sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
    const activeSessions = sorted.filter(a => a.status === 'active' || a.status === 'thinking').length
    const activeConnections = connections.filter(c => c.active).length
    set({
      agents: sorted,
      tasks,
      connections,
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
    const activeSessions = sorted.filter(a => a.status === 'active' || a.status === 'thinking').length
    set({ agents: sorted, stats: { ...get().stats, totalAgents: sorted.length, activeSessions } })
  },

  upsertTask: (task) => {
    const tasks = [task, ...get().tasks.filter(t => t.id !== task.id)]
    set({ tasks: tasks.slice(0, 50) })
  },

  removeTask: (id) => {
    set({ tasks: get().tasks.filter(t => t.id !== id) })
  },

  clearCompletedTasks: () => {
    set({ tasks: get().tasks.filter(t => t.status === 'running') })
  },

  setConnections: (connections) => {
    set({ connections, stats: { ...get().stats, activeConnections: connections.filter(c => c.active).length } })
  },

  incrementMessages: () => set(s => ({ stats: { ...s.stats, messagesTotal: s.stats.messagesTotal + 1 } })),

  loadMockData: () => {
    get().setFullState(MOCK_AGENTS, MOCK_TASKS, MOCK_CONNECTIONS)
  },
}))
