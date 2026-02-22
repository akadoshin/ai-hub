/**
 * Real-time connection to AI Hub API server.
 * Uses SSE for live updates, falls back to polling.
 */
import { useHubStore } from './store'
import type { AgentData, Task, Connection } from './store'

const API_BASE = '/api'
let eventSource: EventSource | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchFullState() {
  try {
    const res = await fetch(`${API_BASE}/state`)
    if (!res.ok) throw new Error('fetch failed')

    const data = await res.json()
    const store = useHubStore.getState()

    const agents: AgentData[] = data.agents || []
    const sessions: Task[] = data.sessions || []
    const connections: Connection[] = data.connections || []

    store.setFullState(agents, sessions, connections)
    store.setConnected(true)
  } catch {
    useHubStore.getState().setConnected(false)
  }
}

function handleUpdate(data: any) {
  const store = useHubStore.getState()

  if (data.agents && data.sessions && data.connections) {
    // Full state update
    store.setFullState(data.agents, data.sessions, data.connections)
  } else {
    // Partial updates
    if (data.agents) {
      data.agents.forEach((a: AgentData) => store.upsertAgent(a))
    }
    if (data.sessions) {
      data.sessions.forEach((s: Task) => store.upsertTask(s))
    }
    if (data.connections) {
      store.setConnections(data.connections)
    }
  }
}

function connectSSE() {
  try {
    eventSource = new EventSource(`${API_BASE}/events`)

    eventSource.onopen = () => {
      useHubStore.getState().setConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'update') {
          handleUpdate(data)
        }
      } catch {}
    }

    eventSource.onerror = () => {
      useHubStore.getState().setConnected(false)
      eventSource?.close()
      eventSource = null
      startPolling()
      setTimeout(connectSSE, 10000)
    }
  } catch {
    startPolling()
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(fetchFullState, 5000)
}

export function initWS() {
  fetchFullState()
  connectSSE()
}

export function disconnectWS() {
  eventSource?.close()
  eventSource = null
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
