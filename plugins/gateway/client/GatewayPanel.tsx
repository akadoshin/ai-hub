import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, RefreshCcw, Send, Clock3, Smartphone, Bot, Cpu, ShieldCheck,
} from 'lucide-react'
import { AnimatedTabs } from '../../../src/ui/tabs'

type GatewayTab = 'overview' | 'chat' | 'ops'

type JsonObject = Record<string, unknown>

const API_BASE = '/api/gateway'

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  const data = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || `GET ${path} failed`)
  return data
}

async function apiPost<T>(path: string, body: JsonObject): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || `POST ${path} failed`)
  return data
}

function shortJson(value: unknown, fallback = '0'): string {
  if (Array.isArray(value)) return String(value.length)
  if (value && typeof value === 'object') return String(Object.keys(value as JsonObject).length)
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value) return value
  return fallback
}

function parseJsonInput(input: string): JsonObject {
  if (!input.trim()) return {}
  const parsed = JSON.parse(input) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object')
  }
  return parsed as JsonObject
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1a1a22] bg-[#07070d] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#14141d] flex items-center gap-1.5">
        {icon}
        <span className="text-[9px] font-bold text-[#666] tracking-[0.14em] uppercase font-mono">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function StatChip({ label, value, tone = '#00ff88' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded border border-[#1a1a22] bg-[#06060a] px-2 py-1">
      <div className="text-[8px] text-[#555] uppercase tracking-[0.14em] font-mono">{label}</div>
      <div className="text-[11px] font-semibold font-mono" style={{ color: tone }}>{value}</div>
    </div>
  )
}

function ActionBtn({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#223226] bg-[#0a1010] text-[#86f8b2] text-[9px] font-mono tracking-[0.06em] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#3b5a42]"
    >
      {icon}
      {label}
    </button>
  )
}

export function GatewayPanel() {
  const [tab, setTab] = useState<GatewayTab>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const [health, setHealth] = useState<JsonObject | null>(null)
  const [status, setStatus] = useState<JsonObject | null>(null)
  const [agents, setAgents] = useState<JsonObject | null>(null)
  const [channels, setChannels] = useState<JsonObject | null>(null)
  const [crons, setCrons] = useState<JsonObject | null>(null)
  const [devices, setDevices] = useState<JsonObject | null>(null)
  const [nodes, setNodes] = useState<JsonObject | null>(null)

  const [chatKey, setChatKey] = useState('agent:main:main')
  const [chatText, setChatText] = useState('')
  const [chatResult, setChatResult] = useState('')

  const [cronId, setCronId] = useState('')
  const [cronRunResult, setCronRunResult] = useState('')

  const [nodeId, setNodeId] = useState('')
  const [nodeInput, setNodeInput] = useState('{}')
  const [nodeInvokeResult, setNodeInvokeResult] = useState('')

  const [runnerMethod, setRunnerMethod] = useState('status')
  const [runnerBody, setRunnerBody] = useState('{}')
  const [runnerResult, setRunnerResult] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, s, a, c, r, d, n] = await Promise.all([
        apiGet<JsonObject>('/health'),
        apiGet<JsonObject>('/status'),
        apiGet<JsonObject>('/agents'),
        apiGet<JsonObject>('/channels'),
        apiGet<JsonObject>('/cron'),
        apiGet<JsonObject>('/devices'),
        apiGet<JsonObject>('/nodes'),
      ])
      setHealth(h)
      setStatus(s)
      setAgents(a)
      setChannels(c)
      setCrons(r)
      setDevices(d)
      setNodes(n)
      setLastUpdate(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gateway not available')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 8000)
    return () => clearInterval(timer)
  }, [refresh])

  const handleChatSend = useCallback(async () => {
    if (!chatText.trim()) return
    try {
      setChatResult('sending...')
      const out = await apiPost<JsonObject>('/chat/send', { key: chatKey, content: chatText })
      setChatResult(JSON.stringify(out, null, 2))
      setChatText('')
    } catch (e) {
      setChatResult(`error: ${e instanceof Error ? e.message : 'chat send failed'}`)
    }
  }, [chatKey, chatText])

  const handleCronRun = useCallback(async () => {
    if (!cronId.trim()) return
    try {
      setCronRunResult('running...')
      const out = await apiPost<JsonObject>('/cron/run', { cronId })
      setCronRunResult(JSON.stringify(out, null, 2))
    } catch (e) {
      setCronRunResult(`error: ${e instanceof Error ? e.message : 'cron run failed'}`)
    }
  }, [cronId])

  const handleApproveFirstDevice = useCallback(async () => {
    const pending = (devices?.pending as JsonObject[] | undefined) || []
    const first = pending[0]
    if (!first) return
    try {
      const requestId = String(first.requestId || first.id || '')
      if (!requestId) throw new Error('missing requestId')
      const out = await apiPost<JsonObject>('/devices/approve', { requestId })
      setRunnerResult(JSON.stringify(out, null, 2))
      await refresh()
    } catch (e) {
      setRunnerResult(`error: ${e instanceof Error ? e.message : 'device approval failed'}`)
    }
  }, [devices, refresh])

  const handleNodeInvoke = useCallback(async () => {
    if (!nodeId.trim()) return
    try {
      setNodeInvokeResult('invoking...')
      const args = parseJsonInput(nodeInput)
      const out = await apiPost<JsonObject>('/nodes/invoke', { node: nodeId, input: args })
      setNodeInvokeResult(JSON.stringify(out, null, 2))
    } catch (e) {
      setNodeInvokeResult(`error: ${e instanceof Error ? e.message : 'node invoke failed'}`)
    }
  }, [nodeId, nodeInput])

  const handleRunner = useCallback(async () => {
    try {
      setRunnerResult('running...')
      const body = parseJsonInput(runnerBody)
      const method = runnerMethod.trim()
      const out = await apiPost<JsonObject>('/call', { method, params: body })
      setRunnerResult(JSON.stringify(out, null, 2))
    } catch (e) {
      setRunnerResult(`error: ${e instanceof Error ? e.message : 'runner failed'}`)
    }
  }, [runnerBody, runnerMethod])

  const summary = useMemo(() => {
    const agentCount = shortJson((agents as JsonObject)?.agents)
    const sessionCount = shortJson((status as JsonObject)?.sessions)
    const channelCount = shortJson((channels as JsonObject)?.channels)
    const cronCount = shortJson((crons as JsonObject)?.jobs)
    const pendingDevices = shortJson((devices as JsonObject)?.pending)
    const nodeCount = shortJson((nodes as JsonObject)?.nodes)
    return { agentCount, sessionCount, channelCount, cronCount, pendingDevices, nodeCount }
  }, [agents, channels, crons, devices, nodes, status])

  return (
    <div className="h-full bg-[#06060b] border-t border-[#1a1a22] flex flex-col">
      <div className="px-3 py-2 border-b border-[#1a1a22] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity size={11} className="text-[#3c8d66]" />
          <span className="text-[10px] font-bold text-[#5b8f73] tracking-[0.14em] uppercase font-mono">Gateway Control</span>
        </div>
        <ActionBtn onClick={refresh} label={loading ? 'Sync...' : 'Sync'} icon={<RefreshCcw size={10} />} disabled={loading} />
      </div>

      <div className="px-2 py-2 border-b border-[#1a1a22]">
        <AnimatedTabs
          tabs={[
            { id: 'overview', label: 'Overview', icon: <ShieldCheck size={11} /> },
            { id: 'chat', label: 'Chat', icon: <Bot size={11} /> },
            { id: 'ops', label: 'Ops', icon: <Cpu size={11} /> },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as GatewayTab)}
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {error && (
          <div className="rounded border border-[#502020] bg-[#1a0f12] px-2 py-1 text-[10px] text-[#fca5a5] font-mono">
            gateway error: {error}
          </div>
        )}

        {tab === 'overview' && (
          <>
            <Section title="Live Summary" icon={<Activity size={11} className="text-[#4ade80]" />}>
              <div className="grid grid-cols-3 gap-1.5">
                <StatChip label="Agents" value={summary.agentCount} />
                <StatChip label="Sessions" value={summary.sessionCount} tone="#60a5fa" />
                <StatChip label="Channels" value={summary.channelCount} tone="#f59e0b" />
                <StatChip label="Crons" value={summary.cronCount} tone="#c084fc" />
                <StatChip label="Devices" value={summary.pendingDevices} tone="#f87171" />
                <StatChip label="Nodes" value={summary.nodeCount} tone="#22d3ee" />
              </div>
              <div className="mt-2 text-[9px] text-[#555] font-mono">
                last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'never'}
              </div>
            </Section>

            <Section title="Status Snapshot" icon={<Cpu size={11} className="text-[#60a5fa]" />}>
              <pre className="text-[9px] text-[#8fa0b5] font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
                {JSON.stringify({ health, status, channels }, null, 2)}
              </pre>
            </Section>

            <Section title="Devices" icon={<Smartphone size={11} className="text-[#f87171]" />}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[9px] text-[#777] font-mono">pending pairing requests</div>
                <ActionBtn onClick={handleApproveFirstDevice} label="Approve First" />
              </div>
              <pre className="text-[9px] text-[#a69393] font-mono whitespace-pre-wrap break-words max-h-36 overflow-auto">
                {JSON.stringify(devices, null, 2)}
              </pre>
            </Section>
          </>
        )}

        {tab === 'chat' && (
          <>
            <Section title="Quick Chat Send" icon={<Send size={11} className="text-[#34d399]" />}>
              <div className="space-y-2">
                <input
                  value={chatKey}
                  onChange={(e) => setChatKey(e.target.value)}
                  className="w-full rounded border border-[#1f2f24] bg-[#08110b] px-2 py-1 text-[10px] font-mono text-[#9fe4ba]"
                  placeholder="session key"
                />
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="w-full h-20 rounded border border-[#1f2f24] bg-[#08110b] px-2 py-1 text-[10px] font-mono text-[#cde7d8]"
                  placeholder="message"
                />
                <ActionBtn onClick={handleChatSend} label="Send Message" icon={<Send size={10} />} disabled={!chatText.trim()} />
                {chatResult && (
                  <pre className="text-[9px] text-[#8bc6a5] font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{chatResult}</pre>
                )}
              </div>
            </Section>

            <Section title="Cron Trigger" icon={<Clock3 size={11} className="text-[#c084fc]" />}>
              <div className="space-y-2">
                <input
                  value={cronId}
                  onChange={(e) => setCronId(e.target.value)}
                  className="w-full rounded border border-[#2d203d] bg-[#0f0a14] px-2 py-1 text-[10px] font-mono text-[#d9b5ff]"
                  placeholder="cronId"
                />
                <ActionBtn onClick={handleCronRun} label="Run Cron" icon={<Clock3 size={10} />} disabled={!cronId.trim()} />
                {cronRunResult && (
                  <pre className="text-[9px] text-[#b7a0d6] font-mono whitespace-pre-wrap break-words max-h-36 overflow-auto">{cronRunResult}</pre>
                )}
              </div>
            </Section>
          </>
        )}

        {tab === 'ops' && (
          <>
            <Section title="Node Invoke" icon={<Cpu size={11} className="text-[#22d3ee]" />}>
              <div className="space-y-2">
                <input
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full rounded border border-[#1b2f3b] bg-[#081018] px-2 py-1 text-[10px] font-mono text-[#95d8ef]"
                  placeholder="node id"
                />
                <textarea
                  value={nodeInput}
                  onChange={(e) => setNodeInput(e.target.value)}
                  className="w-full h-20 rounded border border-[#1b2f3b] bg-[#081018] px-2 py-1 text-[10px] font-mono text-[#b5dce8]"
                  placeholder='{"arg":"value"}'
                />
                <ActionBtn onClick={handleNodeInvoke} label="Invoke" icon={<Cpu size={10} />} disabled={!nodeId.trim()} />
                {nodeInvokeResult && (
                  <pre className="text-[9px] text-[#9cc9d6] font-mono whitespace-pre-wrap break-words max-h-36 overflow-auto">{nodeInvokeResult}</pre>
                )}
              </div>
            </Section>

            <Section title="Raw Method Runner" icon={<Bot size={11} className="text-[#f59e0b]" />}>
              <div className="space-y-2">
                <input
                  value={runnerMethod}
                  onChange={(e) => setRunnerMethod(e.target.value)}
                  className="w-full rounded border border-[#3b2a11] bg-[#130f08] px-2 py-1 text-[10px] font-mono text-[#f2c17a]"
                  placeholder="gateway method"
                />
                <textarea
                  value={runnerBody}
                  onChange={(e) => setRunnerBody(e.target.value)}
                  className="w-full h-20 rounded border border-[#3b2a11] bg-[#130f08] px-2 py-1 text-[10px] font-mono text-[#f0d2a6]"
                  placeholder='{"key":"value"}'
                />
                <div className="text-[9px] text-[#7b6847] font-mono">bridges directly to gateway methods for fast prototyping.</div>
                <ActionBtn onClick={handleRunner} label="Execute" />
                {runnerResult && (
                  <pre className="text-[9px] text-[#d2b17b] font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">{runnerResult}</pre>
                )}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}
