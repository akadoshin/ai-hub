export type MainView = 'deck' | 'graph'
export type PanelView = string | null

export const MAIN_VIEW_META: Record<MainView, { label: string; color: string; shortcut: string }> = {
  deck: { label: '3D Deck', color: '#00ff88', shortcut: '1' },
  graph: { label: 'Agent Graph', color: '#60a5fa', shortcut: '2' },
}
