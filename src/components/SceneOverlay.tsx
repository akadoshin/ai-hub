import { useHubStore } from '../store'
import { BackgroundBeams } from '../ui/background-beams'

export function SceneOverlay() {
  const { agents, tasks, connected } = useHubStore()
  const active = agents.filter(a => a.status === 'active' || a.status === 'thinking').length
  const crons = tasks.filter(t => t.type === 'cron').length
  const running = tasks.filter(t => t.status === 'running').length

  return (
    <div className="absolute inset-0 pointer-events-none z-5">
      <BackgroundBeams className="opacity-50" />

      {/* Bottom-left: legend */}
      <div className="absolute bottom-3.5 left-3.5 flex flex-col gap-1 bg-[#050508]/80 backdrop-blur-md rounded-lg px-2.5 py-2 border border-[#1a1a22]">
        <div className="text-[8px] text-[#444] font-bold tracking-wider mb-0.5">SYSTEM MAP</div>
        <Legend emoji="☀" label="Star — core agent" />
        <Legend emoji="🪐" label="Planet — persistent agent" />
        <Legend emoji="🌙" label="Moon — cron task" />
        <Legend emoji="☄" label="Comet — worker/spawn" />
      </div>

      {/* Top-right: status pills */}
      <div className="absolute top-2.5 right-[292px] flex gap-1.5">
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
    <div className="flex items-center gap-1.5 text-[9px] text-[#555]">
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
