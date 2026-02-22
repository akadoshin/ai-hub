import { useHubStore } from '../store'
import { Bot, Activity, MessageSquare, Link2, Wifi, WifiOff } from 'lucide-react'
import { Spotlight } from '../ui/spotlight'

export function TopBar() {
  const { connected, stats } = useHubStore()

  return (
    <Spotlight className="shrink-0 z-10" spotlightColor="rgba(0,255,136,0.04)">
      <div className="h-14 bg-[#0a0a10] border-b border-[#1a1a22] flex items-center px-5 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#00cc6a] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.2)]">
            <Bot size={18} color="#040407" strokeWidth={2.5} />
          </div>
          <span className="text-base font-extrabold text-white tracking-tight">
            AI Hub
          </span>
        </div>

        <div className="w-px h-6 bg-[#1a1a22]" />

        {/* Stats */}
        <Stat icon={<Bot size={14} />} label="Agents" value={stats.totalAgents} />
        <Stat icon={<Activity size={14} />} label="Active" value={stats.activeSessions} accent />
        <Stat icon={<MessageSquare size={14} />} label="Messages" value={stats.messagesTotal} />
        <Stat icon={<Link2 size={14} />} label="Links" value={stats.activeConnections} accent />

        <div className="flex-1" />

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
