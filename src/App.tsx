import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { SceneOverlay } from './components/SceneOverlay'
import { HubScene } from './3d/SolarSystem'
import { GraphView } from './components/GraphView'
import { initWS } from './ws'
import { useHubStore } from './store'
import { FlowPanelOverlay } from './components/FlowPanelOverlay'
import type { MainView, PanelView } from './types/flows'

export default function App() {
  const { loadMockData } = useHubStore()
  const [mainView, setMainView] = useState<MainView>('deck')
  const [activePanel, setActivePanel] = useState<PanelView>(null)

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
        {/* Background views — only one visible at a time */}
        <div style={{ position: 'absolute', inset: 0, display: mainView === 'deck' ? 'block' : 'none' }}>
          <HubScene mainView={mainView} onMainViewChange={setMainView} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: mainView === 'graph' ? 'block' : 'none' }}>
          <GraphView />
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
