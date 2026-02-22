import { useEffect, useMemo, useState } from 'react'
import type { MeshyStatus, MeshyTask } from '../services/meshy'
import { useMeshyStore } from '../services/meshyStore'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'

const PRESETS = [
  { label: 'AI Brain', prompt: 'glowing neural network brain, holographic, sci-fi, translucent blue and green, detailed' },
  { label: 'Cyber Server', prompt: 'futuristic server rack, neon lights, dark metal, sci-fi datacenter aesthetic' },
  { label: 'Robot Agent', prompt: 'small friendly robot assistant, sleek white and green design, minimal, cute' },
  { label: 'Data Orb', prompt: 'luminous data sphere, swirling energy particles inside, crystal clear, glowing green core' },
  { label: 'Circuit Board', prompt: 'artistic circuit board sculpture, gold traces, green substrate, glowing nodes' },
]

const ART_STYLES = ['pbr', 'realistic', 'cartoon', 'low-poly', 'sculpture'] as const

const STATUS_META: Record<MeshyStatus, { label: string; color: string; soft: string }> = {
  PENDING: { label: 'Queued', color: '#7ea8ff', soft: '#7ea8ff1f' },
  IN_PROGRESS: { label: 'Running', color: '#8ad0ff', soft: '#8ad0ff1f' },
  SUCCEEDED: { label: 'Ready', color: '#c5f955', soft: '#c5f95522' },
  FAILED: { label: 'Failed', color: '#ff8fa7', soft: '#ff8fa71f' },
  EXPIRED: { label: 'Expired', color: '#f4ac4f', soft: '#f4ac4f1f' },
}

function normalizeTimestamp(value?: number): number | null {
  if (!value || Number.isNaN(value)) return null
  return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatTaskDate(value?: number): string {
  const ts = normalizeTimestamp(value)
  if (!ts) return '--'
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (sameDay) return time
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

function taskTitle(task: MeshyTask): string {
  if (task.prompt?.trim()) return task.prompt
  return `Task ${task.id.slice(0, 8)}`
}

export function MeshyPanel({ embedded = false }: { embedded?: boolean }) {
  const { tasks, generating, error, generate, fetchHistory, selectModel, clearError } = useMeshyStore()
  const [prompt, setPrompt] = useState('')
  const [artStyle, setArtStyle] = useState<(typeof ART_STYLES)[number]>('pbr')
  const [expanded, setExpanded] = useState(true)
  const [showAllTasks, setShowAllTasks] = useState(false)

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  const canGenerate = prompt.trim().length > 0 && !generating
  const visibleTasks = useMemo(() => (showAllTasks ? tasks : tasks.slice(0, 6)), [showAllTasks, tasks])

  const handleGenerate = () => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || generating) return
    void generate(cleanPrompt, artStyle)
    setPrompt('')
  }

  return (
    <div className={embedded ? 'relative h-full overflow-hidden bg-[#06080d] text-[#edf1f5] flex flex-col' : 'relative overflow-hidden bg-[#06080d] text-[#edf1f5] border-t border-[#1d2228]'}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-[-12%] h-56 w-56 rounded-full bg-[#c5f9551a] blur-3xl" />
        <div className="absolute -right-16 top-10 h-48 w-48 rounded-full bg-[#ff3e8f14] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_52%),linear-gradient(165deg,rgba(10,12,16,0.95),rgba(7,8,12,0.97))]" />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="relative z-10 w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-transparent border-none cursor-pointer hover:bg-[#ffffff08] transition-colors"
        style={{
          borderBottom: expanded ? '1px solid #242b31' : 'none',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#c5f9554f] bg-[#c5f95518] text-[#d7ff7f]">
            <Box size={14} />
          </div>
          <div className="min-w-0 text-left">
            <div className="text-[11px] font-semibold tracking-wide text-[#e7ecf0] truncate">Meshy Studio</div>
            <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-[#818b98] truncate">Text to 3D | API safe mode</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#2a3422] bg-[#151c12] px-2 py-0.5 text-[8px] font-mono uppercase tracking-[0.16em] text-[#c5f955]">
            1 job
          </span>
          {expanded ? <ChevronDown size={14} className="text-[#7d8794]" /> : <ChevronUp size={14} className="text-[#7d8794]" />}
        </div>
      </button>

      {expanded && (
        <div className={embedded ? 'relative z-10 p-3 overflow-y-auto flex-1' : 'relative z-10 p-3'}>
          {error && (
            <div className="mb-3 rounded-lg border border-[#ff8fa748] bg-[#2a151e] px-2.5 py-2 text-[10px] text-[#ffc5d1] flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle size={12} className="shrink-0 text-[#ff8fa7]" />
                <span className="truncate">{error}</span>
              </span>
              <button onClick={clearError} className="rounded-md border border-[#ff8fa742] bg-[#ff8fa71a] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[#ffb1c2] cursor-pointer">
                clear
              </button>
            </div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[#c5f9554a] bg-gradient-to-r from-[#1a2512] to-[#121a12] px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-[#d3f98a]">
              <Wand2 size={12} />
              <span className="font-semibold">Text to 3D</span>
            </div>
            <div className="rounded-lg border border-[#2b3440] bg-[#0f151f] px-2 py-1.5 flex items-center gap-1.5 text-[10px] text-[#738194] opacity-80">
              <ImageIcon size={12} />
              <span className="font-semibold">Image to 3D (soon)</span>
            </div>
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#8791a0] font-mono">Prompt</span>
            <span className="text-[9px] text-[#5d6978] font-mono">{prompt.length}/500</span>
          </div>

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe your 3D model idea..."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-[#26303d] bg-[#0b1119] px-3 py-2 text-[11px] text-[#e8edf3] resize-none outline-none font-inherit focus:border-[#c5f95570] focus:bg-[#0d1420] transition-colors"
          />

          <div className="mt-2 flex gap-1.5 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                className="px-2 py-0.5 rounded-full text-[9px] border border-[#2b3542] bg-[#111824] text-[#9ca8b6] cursor-pointer font-semibold hover:border-[#4a596c] hover:text-[#d5dce5] transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1 text-[9px] uppercase tracking-[0.16em] text-[#8791a0] font-mono">Style</div>
            <div className="grid grid-cols-5 gap-1">
              {ART_STYLES.map((style) => {
                const active = style === artStyle
                return (
                  <button
                    key={style}
                    onClick={() => setArtStyle(style)}
                    className={`rounded-md px-1 py-1 text-[9px] font-semibold capitalize transition-colors ${
                      active
                        ? 'border border-[#c5f95566] bg-[#1f2c14] text-[#d7ff8a]'
                        : 'border border-[#2b3440] bg-[#0e1520] text-[#8591a2] hover:text-[#d5dde8] hover:border-[#485468]'
                    }`}
                  >
                    {style}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 flex gap-2 items-center">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`flex-1 rounded-xl border-none py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                canGenerate
                  ? 'bg-gradient-to-r from-[#c5f955] to-[#9ee652] text-[#11170d] cursor-pointer hover:from-[#d2ff70] hover:to-[#b3f066]'
                  : 'bg-[#1d2a18] text-[#6f8362] cursor-not-allowed'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  Generate 3D
                </>
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.14em] text-[#7f8a98]">
            <span className="flex items-center gap-1">
              <Clock3 size={10} />
              ~1-2 min / model
            </span>
            <span className={generating ? 'text-[#8ad0ff]' : 'text-[#adb7c4]'}>{generating ? 'running...' : 'ready'}</span>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#202a34] bg-[#0a0f17cc]">
            <div className="px-3 py-2 border-b border-[#1d2630] flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8c96a5] font-mono">Recent generations</div>
              {tasks.length > 6 && (
                <button
                  onClick={() => setShowAllTasks(v => !v)}
                  className="text-[9px] uppercase tracking-[0.14em] font-mono text-[#a6b0bf] cursor-pointer hover:text-[#dbe2ec]"
                >
                  {showAllTasks ? 'Show less' : 'Show all'}
                </button>
              )}
            </div>

            {tasks.length === 0 ? (
              <div className="px-3 py-5 text-center">
                <div className="mx-auto mb-2 h-9 w-9 rounded-full border border-[#28323e] bg-[#121a26] text-[#7a8798] flex items-center justify-center">
                  <Box size={14} />
                </div>
                <div className="text-[10px] text-[#96a2b3]">No Meshy tasks yet.</div>
                <div className="text-[9px] text-[#657285] mt-1">Generate a model to populate this list.</div>
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto p-2 space-y-2">
                {visibleTasks.map((task) => {
                  const meta = STATUS_META[task.status]
                  const clickable = task.status === 'SUCCEEDED'
                  const progress = Math.max(6, Math.min(100, Number(task.progress || 0)))
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (clickable) selectModel(task)
                      }}
                      className={`group relative overflow-hidden rounded-lg border bg-[#0d141f] transition-colors ${
                        clickable
                          ? 'cursor-pointer border-[#2a3544] hover:border-[#c5f95562]'
                          : 'cursor-default border-[#232d3b]'
                      }`}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ background: `radial-gradient(180px circle at 100% 0%, ${meta.soft}, transparent 65%)` }}
                      />

                      <div className="relative flex items-start gap-2 p-2">
                        <div className="relative h-11 w-11 flex-none overflow-hidden rounded-md border border-[#293547] bg-[#101826]">
                          {task.thumbnail_url ? (
                            <img
                              src={task.thumbnail_url}
                              alt={taskTitle(task)}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[#6f7f93]">
                              <Box size={14} />
                            </div>
                          )}

                          {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-[#131d2b]">
                              <div className="h-full bg-[#8ad0ff] transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[10px] font-semibold text-[#e9edf2]">{taskTitle(task)}</p>
                            <span
                              className="rounded-full border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.14em]"
                              style={{ color: meta.color, borderColor: `${meta.color}66`, background: meta.soft }}
                            >
                              {meta.label}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[8px] font-mono uppercase tracking-[0.12em] text-[#7f8a98]">
                            <span>{formatTaskDate(task.created_at)}</span>
                            {task.status === 'SUCCEEDED' && (
                              <span className="flex items-center gap-1 text-[#c5f955]">
                                <CheckCircle2 size={9} />
                                Click to load
                              </span>
                            )}
                            {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                              <span className="flex items-center gap-1 text-[#8ad0ff]">
                                <Loader2 size={9} className="animate-spin" />
                                {progress}%
                              </span>
                            )}
                            {task.status === 'FAILED' && (
                              <span className="text-[#ff9db3]">Check details</span>
                            )}
                          </div>

                          {task.status === 'FAILED' && task.error_message && (
                            <div className="mt-1 truncate text-[8px] text-[#f2a8b9]">{task.error_message}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-2 text-[8px] font-mono uppercase tracking-[0.14em] text-[#5f6d7f] flex items-center justify-between">
            <span>History fetch size: 20 tasks</span>
            <span>No API limit changes</span>
          </div>
        </div>
      )}
    </div>
  )
}
