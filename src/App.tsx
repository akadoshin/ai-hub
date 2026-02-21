import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { GraphView } from './components/GraphView'
import { TasksPanel } from './components/TasksPanel'
import { MeshyPanel } from './components/MeshyPanel'
import { HubScene } from './3d/HubScene'
import { initWS } from './ws'
import { useHubStore } from './store'
import { Box, GitBranch } from 'lucide-react'

type ViewMode = '3d' | 'graph'

export default function App() {
  const { loadMockData } = useHubStore()
  const [view, setView] = useState<ViewMode>('3d')

  useEffect(() => {
    loadMockData()
    initWS()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f' }}>
      <TopBar />

      {/* View tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 16px',
        background: '#111',
        borderBottom: '1px solid #2a2a2a',
        height: 36,
        flexShrink: 0,
      }}>
        <TabButton active={view === '3d'} onClick={() => setView('3d')} icon={<Box size={12} />} label="3D Simulation" />
        <TabButton active={view === 'graph'} onClick={() => setView('graph')} icon={<GitBranch size={12} />} label="Agent Graph" />
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Main view */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {view === '3d'  && <HubScene />}
          {view === 'graph' && <GraphView />}
        </div>

        {/* Right sidebar */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', background: '#111', borderLeft: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <TasksPanel sidebar />
          </div>
          <MeshyPanel />
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? '#00ff8820' : 'none',
        color: active ? '#00ff88' : '#555',
        fontSize: 11, fontWeight: active ? 700 : 500,
        borderBottom: active ? '2px solid #00ff88' : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}
