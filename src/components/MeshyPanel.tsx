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
    <div style={{
      background: '#111',
      borderTop: '1px solid #2a2a2a',
      flexShrink: 0,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', background: 'none', border: 'none',
          cursor: 'pointer', color: '#e0e0e0',
          borderBottom: expanded ? '1px solid #2a2a2a' : 'none',
        }}
      >
        <Box size={14} color="#00ff88" />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
          Meshy 3D Generator
        </span>
        {expanded ? <ChevronDown size={14} color="#555" /> : <ChevronUp size={14} color="#555" />}
      </button>

      {expanded && (
        <div style={{ padding: '12px 12px' }}>
          {/* Error */}
          {error && (
            <div style={{ background: '#f8717120', border: '1px solid #f8717140', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#f87171', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{error}</span>
              <button onClick={clearError} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}>×</button>
            </div>
          )}

          {/* Presets */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 10,
                  background: '#1a2a1a', border: '1px solid #00ff8830',
                  color: '#00ff88', cursor: 'pointer', fontWeight: 600,
                }}
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
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 6, padding: '6px 8px', color: '#e0e0e0', fontSize: 11,
              resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <select
              value={artStyle}
              onChange={e => setArtStyle(e.target.value)}
              style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
                color: '#888', fontSize: 10, padding: '4px 6px', outline: 'none',
              }}
            >
              {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              style={{
                flex: 1, padding: '6px', borderRadius: 6, border: 'none',
                background: generating || !prompt.trim() ? '#1a2a1a' : '#00ff88',
                color: generating || !prompt.trim() ? '#00ff8860' : '#0f0f0f',
                fontSize: 11, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {generating
                ? <><Loader size={12} className="animate-spin" /> Generating...</>
                : <><Sparkles size={12} /> Generate 3D</>
              }
            </button>
          </div>

          {/* Tasks list */}
          {tasks.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 140, overflowY: 'auto' }}>
              {tasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  onClick={() => task.status === 'SUCCEEDED' ? selectModel(task) : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 6px', borderRadius: 6, marginBottom: 3,
                    background: '#151515', border: '1px solid #222',
                    cursor: task.status === 'SUCCEEDED' ? 'pointer' : 'default',
                  }}
                >
                  {task.thumbnail_url
                    ? <img src={task.thumbnail_url} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                    : <div style={{ width: 28, height: 28, borderRadius: 4, background: '#1a2a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box size={12} color="#00ff8860" />
                      </div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.prompt || task.id.slice(0, 16) + '...'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      {task.status === 'SUCCEEDED' && <CheckCircle size={9} color="#00ff88" />}
                      {task.status === 'FAILED' && <XCircle size={9} color="#f87171" />}
                      {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && <Loader size={9} color="#60a5fa" className="animate-spin" />}
                      <span style={{ fontSize: 9, color: task.status === 'SUCCEEDED' ? '#00ff88' : task.status === 'FAILED' ? '#f87171' : '#60a5fa' }}>
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
