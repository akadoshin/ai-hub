import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { SceneOverlay } from './components/SceneOverlay'
import { HubScene } from './3d/SolarSystem'
import { initWS } from './ws'
import { useHubStore } from './store'
import { FlowPanelOverlay } from './components/FlowPanelOverlay'
import type { FlowView } from './types/flows'

export default function App() {
  const { loadMockData } = useHubStore()
  const [activeFlow, setActiveFlow] = useState<FlowView>('overview')

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
      <TopBar activeFlow={activeFlow} />

      <div className="relative flex-1 overflow-hidden">
        <HubScene activeFlow={activeFlow} onFlowChange={setActiveFlow} />
        <SceneOverlay activeFlow={activeFlow} onFlowChange={setActiveFlow} />
        <FlowPanelOverlay activeFlow={activeFlow} onFlowChange={setActiveFlow} />
      </div>
    </div>
  )
}
