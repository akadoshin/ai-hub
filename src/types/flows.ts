export type MainView = 'deck' | 'graph'
export type PanelView = 'tasks' | 'gateway' | 'meshy' | null

export const MAIN_VIEW_META: Record<MainView, { label: string; color: string; shortcut: string }> = {
  deck: { label: '3D Deck', color: '#00ff88', shortcut: '1' },
  graph: { label: 'Agent Graph', color: '#60a5fa', shortcut: '2' },
}

export const PANEL_META: Record<Exclude<PanelView, null>, { label: string; color: string; shortcut: string; hint: string }> = {
  tasks: { label: 'Tasks', color: '#f59e0b', shortcut: '3', hint: 'Cron, spawns y sesiones' },
  gateway: { label: 'Gateway', color: '#22d3ee', shortcut: '4', hint: 'Chat y operaciones RPC' },
  meshy: { label: 'Meshy', color: '#f472b6', shortcut: '5', hint: 'Generacion de assets 3D' },
}
