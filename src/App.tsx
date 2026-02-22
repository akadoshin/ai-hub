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

type ViewMode = '3d' | 'graph'

export default function App() {
  const { loadMockData } = useHubStore()
  const [view, setView] = useState<ViewMode>('3d')

  useEffect(() => {
    initWS()
    // loadMockData only if no real data arrives within 3s
    const timeout = setTimeout(() => {
      const { agents } = useHubStore.getState()
      if (agents.length === 0) loadMockData()
    }, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#070709' }}>
      <TopBar />

      {/* View tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '0 16px',
        background: '#0c0c0e',
        borderBottom: '1px solid #1a1a1a',
        height: 34,
        flexShrink: 0,
      }}>
        <TabButton active={view === '3d'} onClick={() => setView('3d')} icon={<Box size={11} />} label="3D Simulation" />
        <TabButton active={view === 'graph'} onClick={() => setView('graph')} icon={<GitBranch size={11} />} label="Agent Graph" />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main view */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {view === '3d' && (
            <>
              <HubScene />
              <SceneOverlay />
            </>
          )}
          {view === 'graph' && <GraphView />}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 280, display: 'flex', flexDirection: 'column',
          background: '#0c0c0e', borderLeft: '1px solid #1a1a1a',
          overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TasksPanel sidebar />
          </div>
          <MeshyPanel />
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 14px', border: 'none', cursor: 'pointer',
        background: active ? '#00ff8812' : 'transparent',
        color: active ? '#00ff88' : '#444',
        fontSize: 11, fontWeight: active ? 700 : 500,
        borderBottom: active ? '2px solid #00ff88' : '2px solid transparent',
        borderRadius: '6px 6px 0 0',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
