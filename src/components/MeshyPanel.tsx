import { useState, useEffect } from 'react'
import { useMeshyStore } from '../services/meshyStore'
import { Sparkles, Loader, CheckCircle, XCircle, ChevronDown, ChevronUp, Box } from 'lucide-react'

const PRESETS = [
  { label: 'AI Brain', prompt: 'glowing neural network brain, holographic, sci-fi, translucent blue and green, detailed' },
  { label: 'Cyber Server', prompt: 'futuristic server rack, neon lights, dark metal, sci-fi datacenter aesthetic' },
  { label: 'Robot Agent', prompt: 'small friendly robot assistant, sleek white and green design, minimal, cute' },
  { label: 'Data Orb', prompt: 'luminous data sphere, swirling energy particles inside, crystal clear, glowing green core' },
  { label: 'Circuit Board', prompt: 'artistic circuit board sculpture, gold traces, green substrate, glowing nodes' },
]

const ART_STYLES = ['pbr', 'realistic', 'cartoon', 'low-poly', 'sculpture']

export function MeshyPanel() {
  const { tasks, generating, error, generate, fetchHistory, selectModel, clearError } = useMeshyStore()
  const [prompt, setPrompt] = useState('')
  const [artStyle, setArtStyle] = useState('pbr')
  const [expanded, setExpanded] = useState(true)

  useEffect(() => { fetchHistory() }, [])

  const handleGenerate = () => {
    if (!prompt.trim() || generating) return
    generate(prompt.trim(), artStyle)
    setPrompt('')
  }

  return (
    <div className="bg-[#080810] border-t border-[#1a1a22] shrink-0">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-transparent border-none cursor-pointer text-[#eee] hover:bg-[#0a0a14] transition-colors"
        style={{ borderBottom: expanded ? '1px solid #1a1a22' : 'none' }}
      >
        <Box size={14} className="text-[#00ff88]" />
        <span className="text-[11px] font-bold text-[#555] tracking-widest uppercase flex-1 text-left">
          Meshy 3D Generator
        </span>
        {expanded ? <ChevronDown size={14} className="text-[#555]" /> : <ChevronUp size={14} className="text-[#555]" />}
      </button>

      {expanded && (
        <div className="p-3">
          {error && (
            <div className="bg-[#f8717115] border border-[#f8717130] rounded-md px-2.5 py-1.5 text-[11px] text-[#f87171] mb-2 flex justify-between items-center">
              <span>{error}</span>
              <button onClick={clearError} className="bg-transparent border-none text-[#f87171] cursor-pointer p-0 text-base">×</button>
            </div>
          )}

          {/* Presets */}
          <div className="flex gap-1 flex-wrap mb-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                className="px-2 py-0.5 rounded-full text-[10px] bg-[#00ff8808] border border-[#00ff8825] text-[#00ff88] cursor-pointer font-semibold hover:bg-[#00ff8815] transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe a 3D model to generate..."
            rows={2}
            className="w-full bg-[#0a0a10] border border-[#1a1a22] rounded-md px-2 py-1.5 text-[#eee] text-[11px] resize-none outline-none font-inherit focus:border-[#00ff8840] transition-colors"
          />

          <div className="flex gap-2 mt-1.5 items-center">
            <select
              value={artStyle}
              onChange={e => setArtStyle(e.target.value)}
              className="bg-[#0a0a10] border border-[#1a1a22] rounded-md text-[#888] text-[10px] px-1.5 py-1 outline-none"
            >
              {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className={`flex-1 py-1.5 rounded-md border-none text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                generating || !prompt.trim()
                  ? 'bg-[#00ff8815] text-[#00ff8850] cursor-wait'
                  : 'bg-[#00ff88] text-[#040407] cursor-pointer hover:bg-[#00ee7d]'
              }`}
            >
              {generating
                ? <><Loader size={12} className="animate-spin" /> Generating...</>
                : <><Sparkles size={12} /> Generate 3D</>
              }
            </button>
          </div>

          {/* Tasks */}
          {tasks.length > 0 && (
            <div className="mt-2.5 max-h-[140px] overflow-y-auto space-y-1">
              {tasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  onClick={() => task.status === 'SUCCEEDED' ? selectModel(task) : undefined}
                  className={`flex items-center gap-2 px-1.5 py-1.5 rounded-md bg-[#0a0a10] border border-[#1a1a22] ${
                    task.status === 'SUCCEEDED' ? 'cursor-pointer hover:border-[#2a2a33]' : ''
                  } transition-colors`}
                >
                  {task.thumbnail_url
                    ? <img src={task.thumbnail_url} className="w-7 h-7 rounded object-cover" />
                    : <div className="w-7 h-7 rounded bg-[#00ff8808] flex items-center justify-center">
                        <Box size={12} className="text-[#00ff8840]" />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-[#ccc] truncate">
                      {task.prompt || task.id.slice(0, 16) + '...'}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {task.status === 'SUCCEEDED' && <CheckCircle size={9} className="text-[#00ff88]" />}
                      {task.status === 'FAILED' && <XCircle size={9} className="text-[#f87171]" />}
                      {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && <Loader size={9} className="text-[#60a5fa] animate-spin" />}
                      <span className={`text-[9px] font-mono ${
                        task.status === 'SUCCEEDED' ? 'text-[#00ff88]' : task.status === 'FAILED' ? 'text-[#f87171]' : 'text-[#60a5fa]'
                      }`}>
                        {task.status === 'IN_PROGRESS' ? `${task.progress}%` : task.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
