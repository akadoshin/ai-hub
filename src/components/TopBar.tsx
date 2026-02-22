import { useHubStore } from '../store'
import { Activity, MessageSquare, Link2, Wifi, WifiOff, Bot } from 'lucide-react'
import { Spotlight } from '../ui/spotlight'
import { LogoScene } from './LogoScene'
import type { MainView } from '../types/flows'
import { MAIN_VIEW_META } from '../types/flows'

export function TopBar({ mainView }: { mainView: MainView }) {
  const { connected, stats } = useHubStore()
  const flow = MAIN_VIEW_META[mainView]

  return (
    <Spotlight className="shrink-0 z-10" spotlightColor="rgba(0,255,136,0.04)">
      <div className="h-14 border-b border-[#1a1a22] flex items-center px-5 gap-6" style={{ background: 'rgba(10,10,16,0.97)', backdropFilter: 'blur(12px)' }}>
        {/* Logo 3D — canvas includes model + "AI HUB" text */}
        <div className="mr-3">
          <LogoScene />
        </div>

        <div className="w-px h-6 bg-[#1a1a22]" />

        {/* Stats */}
        <Stat icon={<Bot size={14} />} label="Agents" value={stats.totalAgents} />
        <Stat icon={<Activity size={14} />} label="Active" value={stats.activeSessions} accent />
        <Stat icon={<MessageSquare size={14} />} label="Messages" value={stats.messagesTotal} />
        <Stat icon={<Link2 size={14} />} label="Links" value={stats.activeConnections} accent />

        <div className="flex-1" />

        {/* Active flow */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
          style={{ borderColor: `${flow.color}25`, background: `${flow.color}0d` }}
        >
          <span className="text-[9px] text-[#5c6578] uppercase tracking-wider font-mono">Flow</span>
          <span className="text-[11px] font-semibold" style={{ color: flow.color }}>{flow.label}</span>
          <span className="text-[9px] text-[#6b7280] font-mono">[{flow.shortcut}]</span>
        </div>

        {/* Connection status */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          connected
            ? 'bg-[#00ff8810] border-[#00ff8830] text-[#00ff88]'
            : 'bg-[#f8717110] border-[#f8717130] text-[#f87171]'
        }`}>
          {connected ? (
            <>
              <Wifi size={12} />
              <span>Connected</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_6px_#00ff88]" />
            </>
          ) : (
            <>
              <WifiOff size={12} />
              <span>Disconnected</span>
            </>
          )}
        </div>
      </div>
    </Spotlight>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={accent ? 'text-[#00ff88]' : 'text-[#555]'}>{icon}</span>
      <span className="text-xs text-[#555]">{label}</span>
      <span className={`text-sm font-bold font-mono ${accent ? 'text-[#00ff88]' : 'text-[#eee]'}`}>
        {value}
      </span>
    </div>
  )
}
