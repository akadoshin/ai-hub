import { useCallback, useEffect, useRef, useState } from 'react'
import { TopBar } from './components/TopBar'
import { SceneOverlay } from './components/SceneOverlay'
import { HubScene } from './3d/SolarSystem'
import { initWS } from './ws'
import { useHubStore } from './store'
import { FlowPanelOverlay } from './components/FlowPanelOverlay'
import type { MainView, PanelView } from './types/flows'

export default function App() {
  const { loadMockData } = useHubStore()
  const [mainView, setMainView] = useState<MainView>('deck')
  const [activePanel, setActivePanel] = useState<PanelView>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
    if (e.key === '1') setMainView('deck')
    else if (e.key === '2') setMainView('graph')
    else if (e.key === '3') setActivePanel(p => p === 'tasks' ? null : 'tasks')
    else if (e.key === '4') setActivePanel(p => p === 'gateway' ? null : 'gateway')
    else if (e.key === '5') setActivePanel(p => p === 'meshy' ? null : 'meshy')
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Auto-open Tasks panel when a new running task appears (if no panel is open)
  const prevRunningIds = useRef<Set<string>>(new Set())
  const initialLoad = useRef(true)
  const tasks = useHubStore(s => s.tasks)
  useEffect(() => {
    const runningIds = new Set(tasks.filter(t => t.status === 'running').map(t => t.id))
    if (initialLoad.current) {
      // Seed with existing running tasks on first load — don't auto-open for these
      prevRunningIds.current = runningIds
      initialLoad.current = false
      return
    }
    const hasNew = [...runningIds].some(id => !prevRunningIds.current.has(id))
    if (hasNew) {
      setActivePanel(p => p === null ? 'tasks' : p)
    }
    prevRunningIds.current = runningIds
  }, [tasks])

  useEffect(() => {
    initWS()
    const timeout = setTimeout(() => {
      const { agents } = useHubStore.getState()
      if (agents.length === 0) loadMockData()
    }, 3000)
    return () => clearTimeout(timeout)
  }, [loadMockData])

  return (
    <div className="flex h-screen flex-col bg-[#040407]">
      <TopBar mainView={mainView} />

      <div className="relative flex-1 overflow-hidden">
        {/* Background: always 3D deck (graph is rendered as floating panel in overlay) */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <HubScene mainView={mainView} onMainViewChange={setMainView} />
        </div>

        {mainView === 'deck' && (
          <SceneOverlay mainView={mainView} onMainViewChange={setMainView} />
        )}
        <FlowPanelOverlay
          mainView={mainView}
          onMainViewChange={setMainView}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />
      </div>
    </div>
  )
}
