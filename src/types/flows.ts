export type FlowView = 'overview' | 'graph' | 'tasks' | 'gateway' | 'meshy'

export const FLOW_ORDER: FlowView[] = ['overview', 'graph', 'tasks', 'gateway', 'meshy']

export const FLOW_META: Record<FlowView, {
  label: string
  shortLabel: string
  hint: string
  color: string
  shortcut: string
}> = {
  overview: {
    label: '3D Command Deck',
    shortLabel: 'Deck',
    hint: 'Vista principal de agentes y conexiones',
    color: '#00ff88',
    shortcut: '1',
  },
  graph: {
    label: 'Agent Graph',
    shortLabel: 'Graph',
    hint: 'Topologia completa del sistema',
    color: '#60a5fa',
    shortcut: '2',
  },
  tasks: {
    label: 'Tasks & Sessions',
    shortLabel: 'Tasks',
    hint: 'Cron, spawns y sesiones activas',
    color: '#f59e0b',
    shortcut: '3',
  },
  gateway: {
    label: 'Gateway Control',
    shortLabel: 'Gateway',
    hint: 'Chat, nodos, cron y operaciones RPC',
    color: '#22d3ee',
    shortcut: '4',
  },
  meshy: {
    label: 'Meshy Studio',
    shortLabel: 'Meshy',
    hint: 'Generacion de assets 3D para AI flows',
    color: '#f472b6',
    shortcut: '5',
  },
}
