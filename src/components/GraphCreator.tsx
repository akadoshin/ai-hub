/**
 * GraphCreator — floating creation popover triggered by dragging
 * from a node handle and releasing on canvas or another node.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Repeat, X, Send, Loader, CheckCircle, XCircle, ChevronRight,
  Clock, Zap, Bot,
} from 'lucide-react'
import type { AgentData } from '../store'

// ── API ─────────────────────────────────────────────────────────────────────

async function callGateway(method: string, params: Record<string, unknown>) {
  const res = await fetch('/api/gateway/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error || `${method} failed`)
  return data
}

async function createAgent(name: string, workspace: string) {
  const res = await fetch('/api/gateway/agents/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), workspace: workspace.trim() }),
  })
  const data = await res.json()
  if (!res.ok || data?.error) throw new Error(data?.error || 'Failed to create agent')
  return data
}

function parseCronSchedule(raw: string): Record<string, unknown> | null {
  const s = raw.trim().toLowerCase()
  // "every 30m" / "every 2h" / "every 1d"
  const everyMatch = s.match(/^every\s+(\d+)\s*(m(?:in)?|h(?:our)?|d(?:ay)?)?$/)
  if (everyMatch) {
    const num = parseInt(everyMatch[1])
    const unit = (everyMatch[2] || 'm')[0]
    const ms = unit === 'd' ? num * 86400000 : unit === 'h' ? num * 3600000 : num * 60000
    return { kind: 'every', everyMs: ms }
  }
  // cron expression: 5 parts
  if (/^(\S+\s+){4}\S+$/.test(raw.trim())) {
    return { kind: 'cron', expr: raw.trim(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
  }
  return null
}

async function addCron(agentId: string, name: string, schedule: string, message: string) {
  const sched = parseCronSchedule(schedule)
  if (!sched) throw new Error('Invalid schedule. Use "every 30m", "every 1h", or a cron expression.')
  const body = {
    agentId,
    name: name.trim() || `cron-${Date.now()}`,
    schedule: sched,
    sessionTarget: 'isolated',
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message: message.trim(),
      timeoutSeconds: 120,
    },
    delivery: { mode: 'none' },
  }
  const res = await fetch('/api/gateway/cron/add', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Failed to add cron')
  return data
}

async function sendMessage(sessionKey: string, message: string) {
  const res = await fetch('/api/gateway/chat/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: sessionKey, content: message.trim() }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Failed to send message')
  return data
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-bold text-[#555] tracking-[0.12em] uppercase font-mono mb-1">{children}</div>
}

function Input({ value, onChange, placeholder, multiline = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  const cls = 'w-full bg-[#060609] border border-[#1a1a22] rounded px-2 py-1.5 text-[10px] font-mono text-[#ccc] placeholder-[#333] focus:outline-none focus:border-[#2a2a3a] resize-none'
  return multiline
    ? <textarea className={cls} rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    : <input className={cls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

function SubmitBtn({ label, icon, onClick, loading, disabled, color = '#00ff88' }: {
  label: string; icon?: React.ReactNode; onClick: () => void
  loading?: boolean; disabled?: boolean; color?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: color + '18', border: `1px solid ${color}30`, color }}
    >
      {loading ? <Loader size={10} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={`flex items-start gap-1.5 text-[9px] font-mono rounded px-2 py-1.5 mt-1 ${ok ? 'text-[#00ff88] bg-[#00ff8810]' : 'text-[#f87171] bg-[#f8717110]'}`}>
      {ok ? <CheckCircle size={10} className="shrink-0 mt-px" /> : <XCircle size={10} className="shrink-0 mt-px" />}
      {msg}
    </div>
  )
}

// ── Agent form ───────────────────────────────────────────────────────────────

const OPENCLAW_DIR = '/home/aka/.openclaw'

function AgentForm({ onSuccess, onCancel }: {
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-fill workspace when name changes
  const handleNameChange = (v: string) => {
    setName(v)
    const slug = v.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (slug) setWorkspace(`${OPENCLAW_DIR}/workspace-${slug}`)
    else setWorkspace('')
  }

  const submit = useCallback(async () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (!workspace.trim()) { setError('Workspace path is required'); return }
    setLoading(true)
    setError(null)
    try {
      const result = await createAgent(name, workspace)
      onSuccess(`Agent "${result.agentId}" created — restart gateway to activate`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }, [name, workspace, onSuccess])

  return (
    <div className="space-y-3">
      <div>
        <Label>Agent Name / ID</Label>
        <Input value={name} onChange={handleNameChange} placeholder="my-agent" />
        <div className="text-[8px] text-[#444] font-mono mt-1">lowercase, hyphens ok · becomes the agent id</div>
      </div>
      <div>
        <Label>Workspace Path</Label>
        <Input value={workspace} onChange={setWorkspace} placeholder={`${OPENCLAW_DIR}/workspace-NAME`} />
        <div className="text-[8px] text-[#444] font-mono mt-1">auto-filled · editable</div>
      </div>
      {error && <StatusMsg ok={false} msg={error} />}
      <div className="flex items-center gap-2 pt-1">
        <SubmitBtn
          label="Create Agent"
          icon={<Bot size={10} />}
          onClick={submit}
          loading={loading}
          disabled={!name.trim()}
          color="#00ff88"
        />
        <button onClick={onCancel} className="text-[9px] font-mono text-[#444] hover:text-[#666] transition-colors px-2">
          cancel
        </button>
      </div>
    </div>
  )
}

// ── Action selector (canvas drop) ────────────────────────────────────────────

type ActionType = 'cron' | 'message' | 'agent'

interface ActionOption {
  id: ActionType
  icon: React.ReactNode
  label: string
  description: string
  color: string
  disabled?: boolean
}

function ActionCard({ opt, onSelect }: { opt: ActionOption; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      disabled={opt.disabled}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed group"
      style={{ border: `1px solid #1a1a22`, background: '#0a0a10' }}
      onMouseEnter={e => !opt.disabled && ((e.currentTarget as HTMLElement).style.borderColor = opt.color + '40')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#1a1a22')}
    >
      <div className="w-7 h-7 rounded flex items-center justify-center shrink-0"
        style={{ background: opt.color + '15', color: opt.color }}>
        {opt.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-[#ddd] font-mono">{opt.label}</div>
        <div className="text-[9px] text-[#555] mt-0.5">{opt.description}</div>
      </div>
      {!opt.disabled && <ChevronRight size={12} className="text-[#333] group-hover:text-[#555] shrink-0" />}
    </button>
  )
}

// ── Cron form ────────────────────────────────────────────────────────────────

function CronForm({ agent, onSuccess, onCancel }: {
  agent: AgentData
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('every 1h')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!message.trim()) { setError('Message is required'); return }
    setLoading(true)
    setError(null)
    try {
      await addCron(agent.id, name, schedule, message)
      onSuccess(`Cron "${name || 'new cron'}" added to ${agent.label}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [agent, name, schedule, message, onSuccess])

  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={setName} placeholder="my-cron (optional)" />
      </div>
      <div>
        <Label>Schedule</Label>
        <Input value={schedule} onChange={setSchedule} placeholder='every 30m / every 1h / 0 * * * *' />
        <div className="text-[8px] text-[#444] font-mono mt-1">
          "every 30m" · "every 2h" · "every 1d" · or cron expr
        </div>
      </div>
      <div>
        <Label>Payload message</Label>
        <Input value={message} onChange={setMessage} placeholder="What should the agent do?" multiline />
      </div>
      {error && <StatusMsg ok={false} msg={error} />}
      <div className="flex items-center gap-2 pt-1">
        <SubmitBtn
          label="Add Cron"
          icon={<Repeat size={10} />}
          onClick={submit}
          loading={loading}
          disabled={!message.trim()}
          color="#c084fc"
        />
        <button onClick={onCancel} className="text-[9px] font-mono text-[#444] hover:text-[#666] transition-colors px-2">
          cancel
        </button>
      </div>
    </div>
  )
}

// ── Message form ─────────────────────────────────────────────────────────────

function MessageForm({ agent, onSuccess, onCancel }: {
  agent: AgentData
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      await sendMessage(agent.sessionKey || `agent:${agent.id}:main`, message)
      onSuccess(`Message sent to ${agent.label}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [agent, message, onSuccess])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Message to {agent.label}</Label>
        <textarea
          className="w-full bg-[#060609] border border-[#1a1a22] rounded px-2 py-1.5 text-[10px] font-mono text-[#ccc] placeholder-[#333] focus:outline-none focus:border-[#2a2a3a] resize-none"
          rows={4}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Tell ${agent.label} to do something...`}
          autoFocus
        />
        <div className="text-[8px] text-[#444] font-mono mt-1">⌘↵ to send</div>
      </div>
      {error && <StatusMsg ok={false} msg={error} />}
      <div className="flex items-center gap-2 pt-1">
        <SubmitBtn
          label="Send"
          icon={<Send size={10} />}
          onClick={submit}
          loading={loading}
          disabled={!message.trim()}
          color="#60a5fa"
        />
        <button onClick={onCancel} className="text-[9px] font-mono text-[#444] hover:text-[#666] transition-colors px-2">
          cancel
        </button>
      </div>
    </div>
  )
}

// ── Main popover ─────────────────────────────────────────────────────────────

export interface CreatorState {
  position: { x: number; y: number }
  sourceAgent: AgentData
  targetAgent: AgentData | null // null = dropped on canvas
}

interface Props {
  state: CreatorState | null
  onClose: () => void
}

const CANVAS_ACTIONS: ActionOption[] = [
  {
    id: 'agent',
    icon: <Bot size={14} />,
    label: 'New Agent',
    description: 'Create a new persistent agent in this system',
    color: '#00ff88',
  },
  {
    id: 'cron',
    icon: <Repeat size={14} />,
    label: 'Add Cron',
    description: 'Schedule a recurring task for this agent',
    color: '#c084fc',
  },
  {
    id: 'message',
    icon: <Send size={14} />,
    label: 'Send Message',
    description: 'Send a message to this agent\'s main session',
    color: '#60a5fa',
  },
]

const TARGET_ACTIONS: ActionOption[] = [
  {
    id: 'message',
    icon: <Send size={14} />,
    label: 'Send Message',
    description: 'Send a message to this agent',
    color: '#60a5fa',
  },
]

export function GraphCreator({ state, onClose }: Props) {
  const [step, setStep] = useState<'select' | ActionType | 'success'>('select')
  const [successMsg, setSuccessMsg] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Reset step when state changes
  useEffect(() => {
    setStep('select')
    setSuccessMsg('')
  }, [state])

  // Click outside to close
  useEffect(() => {
    if (!state) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid closing on the same click that opened it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [state, onClose])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Auto-close after success
  useEffect(() => {
    if (step === 'success') {
      const t = setTimeout(onClose, 2500)
      return () => clearTimeout(t)
    }
  }, [step, onClose])

  if (!state) return null

  const { position, sourceAgent, targetAgent } = state
  const activeAgent = targetAgent ?? sourceAgent
  const actions = targetAgent ? TARGET_ACTIONS : CANVAS_ACTIONS

  // Position: keep popover within viewport
  const POPOVER_W = 300
  const POPOVER_H = 380
  const x = Math.min(position.x + 12, window.innerWidth - POPOVER_W - 16)
  const y = Math.min(position.y - 12, window.innerHeight - POPOVER_H - 16)

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setStep('success')
  }

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ left: x, top: y, width: POPOVER_W, zIndex: 1000 }}
          className="fixed"
        >
          <div
            className="rounded-xl overflow-hidden shadow-2xl"
            style={{
              background: '#08080f',
              border: '1px solid #1a1a22',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #1a1a2240',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1a1a22]">
              <div className="flex items-center gap-2">
                <Zap size={11} className="text-[#333]" />
                <div className="text-[10px] font-bold text-[#666] tracking-[0.12em] uppercase font-mono">
                  {step === 'select' && (targetAgent
                    ? `${sourceAgent.label} → ${targetAgent.label}`
                    : `From ${sourceAgent.label}`
                  )}
                  {step === 'agent' && 'New Agent'}
                  {step === 'cron' && 'New Cron'}
                  {step === 'message' && 'Send Message'}
                  {step === 'success' && 'Done'}
                </div>
              </div>
              <button onClick={onClose} className="text-[#333] hover:text-[#777] transition-colors p-0.5">
                <X size={12} />
              </button>
            </div>

            <div className="p-3">
              {/* Step: select action */}
              {step === 'select' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-1.5"
                >
                  {/* Context pill */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <AgentPill agent={sourceAgent} />
                    {targetAgent && (
                      <>
                        <ChevronRight size={10} className="text-[#333]" />
                        <AgentPill agent={targetAgent} />
                      </>
                    )}
                  </div>

                  {actions.map(opt => (
                    <ActionCard
                      key={opt.id}
                      opt={opt}
                      onSelect={() => setStep(opt.id)}
                    />
                  ))}
                </motion.div>
              )}

              {/* Step: new agent form */}
              {step === 'agent' && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.12 }}>
                  <AgentForm
                    onSuccess={handleSuccess}
                    onCancel={() => setStep('select')}
                  />
                </motion.div>
              )}

              {/* Step: cron form */}
              {step === 'cron' && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.12 }}>
                  <CronForm
                    agent={sourceAgent}
                    onSuccess={handleSuccess}
                    onCancel={() => setStep('select')}
                  />
                </motion.div>
              )}

              {/* Step: message form */}
              {step === 'message' && (
                <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.12 }}>
                  <MessageForm
                    agent={activeAgent}
                    onSuccess={handleSuccess}
                    onCancel={() => setStep('select')}
                  />
                </motion.div>
              )}

              {/* Step: success */}
              {step === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-6 gap-3"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00ff8815]">
                    <CheckCircle size={20} className="text-[#00ff88]" />
                  </div>
                  <div className="text-[11px] font-mono text-[#aaa] text-center">{successMsg}</div>
                  <div className="flex items-center gap-1 text-[8px] text-[#444] font-mono">
                    <Clock size={8} />
                    closing...
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AgentPill({ agent }: { agent: AgentData }) {
  const color = ({ active: '#00ff88', thinking: '#60a5fa', idle: '#555', error: '#f87171' } as any)[agent.status] || '#555'
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono"
      style={{ background: color + '12', border: `1px solid ${color}25`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {agent.label}
    </div>
  )
}
