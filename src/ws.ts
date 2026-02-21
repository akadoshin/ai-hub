/**
 * Real-time connection to OpenClaw via our API server.
 * Uses Server-Sent Events (SSE) for live updates.
 * Falls back to polling if SSE fails.
 */
import { useHubStore } from './store'
import type { AgentData, Task } from './store'

const API_BASE = '/api'
let eventSource: EventSource | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

async function fetchInitialState() {
  try {
    const [agentsRes, sessionsRes] = await Promise.all([
      fetch(`${API_BASE}/agents`),
      fetch(`${API_BASE}/sessions`),
    ])

    if (agentsRes.ok) {
      const agents: AgentData[] = await agentsRes.json()
      const store = useHubStore.getState()
      agents.forEach(a => store.upsertAgent(a))
    }

    if (sessionsRes.ok) {
      const sessions: Task[] = await sessionsRes.json()
      const store = useHubStore.getState()
      sessions.forEach(s => store.upsertTask(s))
    }

    useHubStore.getState().setConnected(true)
  } catch {
    useHubStore.getState().setConnected(false)
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
        const store = useHubStore.getState()

        if (data.type === 'update') {
          if (data.agents) {
            data.agents.forEach((a: AgentData) => store.upsertAgent(a))
          }
          if (data.sessions) {
            data.sessions.forEach((s: Task) => store.upsertTask(s))
          }
        }
      } catch {}
    }

    eventSource.onerror = () => {
      useHubStore.getState().setConnected(false)
      eventSource?.close()
      eventSource = null
      // Fallback: poll every 5s
      startPolling()
      // Try SSE again after 10s
      setTimeout(connectSSE, 10000)
    }
  } catch {
    startPolling()
  }
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(fetchInitialState, 5000)
}

export function initWS() {
  // Fetch initial state immediately
  fetchInitialState()
  // Then connect SSE for live updates
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
