import { useHubStore } from '../store'
import { X, Bot, Cpu, MessageSquare, Clock, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function AgentDetail() {
  const { selectedAgent, setSelectedAgent, tasks } = useHubStore()

  const statusColors: Record<string, string> = {
    active: '#00ff88', idle: '#888', thinking: '#60a5fa', error: '#f87171',
  }

  return (
    <AnimatePresence>
      {selectedAgent && (
        <AgentDetailInner
          agent={selectedAgent}
          color={statusColors[selectedAgent.status] || '#888'}
          tasks={tasks.filter(t => t.agentId === selectedAgent.id)}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </AnimatePresence>
  )
}

function AgentDetailInner({ agent, color, tasks, onClose }: {
  agent: any; color: string; tasks: any[]; onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute top-4 left-4 z-20 w-[300px] rounded-xl overflow-hidden border backdrop-blur-xl"
      style={{
        background: '#0a0a10ee',
        borderColor: `${color}30`,
        boxShadow: `0 8px 40px #00000080, 0 0 30px ${color}10`,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#1a1a22] flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}
        >
          <Bot size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[#eee] truncate">{agent.label}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
            {agent.status}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-[#888] transition-colors cursor-pointer p-1 rounded-md hover:bg-[#ffffff08] border-none bg-transparent"
        >
          <X size={16} />
        </button>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        <Row icon={<Cpu size={13} />} label="Model" value={agent.model.replace('anthropic/', '')} />
        <Row icon={<MessageSquare size={13} />} label="Messages" value={agent.messageCount.toString()} />
        <Row icon={<Clock size={13} />} label="Last active" value={agent.lastActivity} />
        {agent.description && (
          <Row icon={<Activity size={13} />} label="Description" value={agent.description} />
        )}
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="px-4 pb-3.5">
          <div className="text-[10px] text-[#444] font-bold tracking-wider uppercase mb-2">
            Recent Tasks
          </div>
          {tasks.slice(0, 3).map(t => (
            <div key={t.id} className="px-2 py-1.5 rounded-md bg-[#060608] border border-[#1a1a22] mb-1 text-[11px]">
              <div className="text-[#eee] font-semibold mb-0.5">{t.label}</div>
              <div className="text-[#555] truncate">{t.lastMessage}</div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[#555] mt-0.5 shrink-0">{icon}</span>
      <span className="text-[11px] text-[#555] shrink-0 min-w-[70px]">{label}</span>
      <span className="text-[11px] text-[#ccc] break-words font-mono">{value}</span>
    </div>
  )
}
