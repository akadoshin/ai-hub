import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { GraphView } from './components/GraphView'
import { TasksPanel } from './components/TasksPanel'
import { MeshyPanel } from './components/MeshyPanel'
import { SceneOverlay } from './components/SceneOverlay'
import { HubScene } from './3d/SolarSystem'
import { initWS } from './ws'
import { useHubStore } from './store'
import { Box, GitBranch } from 'lucide-react'
import { AnimatedTabs } from './ui/tabs'

type ViewMode = '3d' | 'graph'

const viewTabs = [
  { id: '3d', label: '3D Simulation', icon: <Box size={11} /> },
  { id: 'graph', label: 'Agent Graph', icon: <GitBranch size={11} /> },
]

export default function App() {
  const { loadMockData } = useHubStore()
  const [view, setView] = useState<ViewMode>('graph')

  useEffect(() => {
    initWS()
    const timeout = setTimeout(() => {
      const { agents } = useHubStore.getState()
      if (agents.length === 0) loadMockData()
    }, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#040407]">
      <TopBar />

      {/* View tabs */}
      <div className="flex items-center px-4 bg-[#080810] border-b border-[#1a1a22] h-[38px] shrink-0">
        <AnimatedTabs
          tabs={viewTabs}
          activeTab={view}
          onChange={(id) => setView(id as ViewMode)}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main view */}
        <div className="flex-1 relative overflow-hidden">
          {view === '3d' && (
            <>
              <HubScene />
              <SceneOverlay />
            </>
          )}
          {view === 'graph' && <GraphView />}
        </div>

        {/* Right sidebar */}
        <div className="w-[300px] flex flex-col bg-[#080810] border-l border-[#1a1a22] overflow-hidden shrink-0">
          <div className="flex-1 overflow-hidden flex flex-col">
            <TasksPanel sidebar />
          </div>
        </div>
      </div>
    </div>
  )
}
