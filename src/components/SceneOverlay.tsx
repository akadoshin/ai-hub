import { useHubStore } from '../store'
import { BackgroundBeams } from '../ui/background-beams'
import type { FlowView } from '../types/flows'
import { FLOW_META, FLOW_ORDER } from '../types/flows'

export function SceneOverlay({
  activeFlow,
  onFlowChange,
}: {
  activeFlow: FlowView
  onFlowChange: (flow: FlowView) => void
}) {
  const { agents, tasks, connected } = useHubStore()
  const active = agents.filter(a => a.status === 'active' || a.status === 'thinking').length
  const crons = tasks.filter(t => t.type === 'cron').length
  const running = tasks.filter(t => t.status === 'running').length

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      <BackgroundBeams className="opacity-50" />

      {/* Top-center: flow quick switch */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-[#26344a] bg-[#040914f2] px-2 py-1.5 backdrop-blur-md pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        {FLOW_ORDER.map((flow) => {
          const meta = FLOW_META[flow]
          const selected = flow === activeFlow
          return (
            <button
              key={flow}
              onClick={() => onFlowChange(flow)}
              className="rounded-full px-2 py-1 text-[9px] font-semibold tracking-wide transition-colors"
              style={{
                color: selected ? meta.color : '#a0aec0',
                border: `1px solid ${selected ? `${meta.color}66` : '#2a3548'}`,
                background: selected ? `${meta.color}20` : '#0a1220',
              }}
              title={`${meta.label} (${meta.shortcut})`}
            >
              {meta.shortLabel}
            </button>
          )
        })}
      </div>

      {/* Bottom-left: legend */}
      <div className="absolute bottom-3.5 left-3.5 flex flex-col gap-1 bg-[#040a14ef] backdrop-blur-md rounded-lg px-2.5 py-2 border border-[#24344c] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="text-[8px] text-[#96a6be] font-bold tracking-wider mb-0.5">SYSTEM MAP</div>
        <Legend emoji="☀" label="Star — core agent" />
        <Legend emoji="🪐" label="Planet — persistent agent" />
        <Legend emoji="🌙" label="Moon — cron task" />
        <Legend emoji="☄" label="Comet — worker/spawn" />
        <Legend emoji="◆" label="Portal — AI flow control" />
      </div>

      {/* Top-right: status pills */}
      <div className="absolute top-2.5 right-3 flex gap-1.5">
        <Pill color={connected ? '#00ff88' : '#f87171'} label={connected ? 'LIVE' : 'OFFLINE'} pulse={connected} />
        {active > 0 && <Pill color="#00ff88" label={`${active} active`} />}
        <Pill color="#555" label={`${crons} moons`} />
        {running > 0 && <Pill color="#60a5fa" label={`${running} in flight`} />}
      </div>
    </div>
  )
}

function Legend({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] text-[#a0aec0]">
      <span className="text-[10px]">{emoji}</span>
      {label}
    </div>
  )
}

function Pill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold border backdrop-blur-sm"
      style={{
        background: `${color}10`,
        borderColor: `${color}25`,
        color,
      }}
    >
      {pulse && (
        <div
          className="w-1 h-1 rounded-full animate-pulse"
          style={{ background: color, boxShadow: `0 0 4px ${color}` }}
        />
      )}
      {label}
    </div>
  )
}
