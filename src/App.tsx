import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { GraphView } from './components/GraphView'
import { TasksPanel } from './components/TasksPanel'
import { initWS } from './ws'
import { useHubStore } from './store'

export default function App() {
  const { loadMockData } = useHubStore()

  useEffect(() => {
    // Load mock data immediately so UI is always demonstrable
    loadMockData()
    // Attempt WS connection
    initWS()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <GraphView />
        <TasksPanel />
      </div>
    </div>
  )
}
