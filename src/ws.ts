import { useHubStore } from './store'

const WS_URL = 'ws://127.0.0.1:18789'
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 2000

function connect() {
  try {
    ws = new WebSocket(WS_URL)

    ws.onopen = () => {
      console.log('[ws] connected to OpenClaw')
      useHubStore.getState().setConnected(true)
      reconnectDelay = 2000
      ws?.send(JSON.stringify({ type: 'auth', token: '' }))
      ws?.send(JSON.stringify({ type: 'subscribe', events: ['session_update', 'agent_update', 'task_progress', 'message_event'] }))
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        const store = useHubStore.getState()

        if (msg.type === 'agent_update' && msg.agent) {
          store.upsertAgent(msg.agent)
        } else if (msg.type === 'session_update' && msg.session) {
          store.upsertTask({
            id: msg.session.key || msg.session.id,
            label: msg.session.label || msg.session.key || 'Session',
            model: msg.session.model || 'unknown',
            status: msg.session.active ? 'running' : 'completed',
            elapsed: msg.session.elapsed || 0,
            startTime: msg.session.startTime || Date.now(),
            lastMessage: msg.session.lastMessage || '',
            agentId: msg.session.agentId,
          })
        } else if (msg.type === 'message_event') {
          store.incrementMessages()
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      useHubStore.getState().setConnected(false)
    }

    ws.onclose = () => {
      useHubStore.getState().setConnected(false)
      ws = null
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 1.5, 30000)
        connect()
      }, reconnectDelay)
    }
  } catch (e) {
    useHubStore.getState().setConnected(false)
  }
}

export function initWS() {
  connect()
}

export function disconnectWS() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  ws?.close()
}
