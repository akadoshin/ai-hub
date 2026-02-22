import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Boxes, Network, Activity, Cpu, Sparkles } from 'lucide-react'
import { GraphView } from './GraphView'
import { TasksPanel } from './TasksPanel'
import { GatewayPanel } from './GatewayPanel'
import { MeshyPanel } from './MeshyPanel'
import type { FlowView } from '../types/flows'
import { FLOW_META, FLOW_ORDER } from '../types/flows'

interface Props {
  activeFlow: FlowView
  onFlowChange: (flow: FlowView) => void
}

const FLOW_ICON: Record<FlowView, ReactNode> = {
  overview: <Boxes size={13} />,
  graph: <Network size={13} />,
  tasks: <Activity size={13} />,
  gateway: <Cpu size={13} />,
  meshy: <Sparkles size={13} />,
}

function FlowButton({
  flow,
  active,
  onFlowChange,
}: {
  flow: FlowView
  active: boolean
  onFlowChange: (flow: FlowView) => void
}) {
  const meta = FLOW_META[flow]
  return (
    <button
      onClick={() => onFlowChange(flow)}
      className="group flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all"
      style={{
        border: `1px solid ${active ? `${meta.color}70` : '#2a3548'}`,
        background: active ? `${meta.color}26` : '#08101cf0',
        color: active ? meta.color : '#b3c0d3',
        boxShadow: active ? `0 0 18px ${meta.color}26` : 'none',
      }}
      title={`${meta.label} (${meta.shortcut})`}
    >
      <span className="shrink-0">{FLOW_ICON[flow]}</span>
      <span className="hidden md:block text-[10px] font-semibold tracking-wide">{meta.shortLabel}</span>
      <span className="hidden xl:block ml-auto text-[9px] text-[#8aa0be] font-mono">{meta.shortcut}</span>
    </button>
  )
}

function PanelContent({ activeFlow }: { activeFlow: FlowView }) {
  if (activeFlow === 'graph') {
    return <GraphView />
  }
  if (activeFlow === 'tasks') {
    return <TasksPanel sidebar />
  }
  if (activeFlow === 'gateway') {
    return <GatewayPanel />
  }
  if (activeFlow === 'meshy') {
    return <MeshyPanel embedded />
  }

  return (
    <div className="h-full p-4 flex flex-col gap-3 text-[#cdd6e7]">
      <div className="rounded-xl border border-[#1a1f2a] bg-[#070b12cc] p-3">
        <div className="text-[11px] font-semibold tracking-wide text-[#9cb2d2]">3D Command Deck</div>
        <div className="text-[12px] mt-1 text-[#d8e1f0]">
          Navega haciendo click en los portales 3D orbitando la escena o con los accesos rapidos `1-5`.
        </div>
      </div>
      <div className="rounded-xl border border-[#1a1f2a] bg-[#070b12cc] p-3">
        <div className="text-[10px] font-semibold tracking-wide text-[#83e7bf]">Flujos Activos</div>
        <ul className="mt-2 space-y-1 text-[11px] text-[#8e9ab1]">
          <li>Graph: topologia completa de agentes.</li>
          <li>Tasks: sesiones, cron y estado operativo.</li>
          <li>Gateway: chat, nodos y controles de runtime.</li>
          <li>Meshy: creacion de modelos 3D para tus agentes.</li>
        </ul>
      </div>
    </div>
  )
}

export function FlowPanelOverlay({ activeFlow, onFlowChange }: Props) {
  const meta = FLOW_META[activeFlow]
  const isOverview = activeFlow === 'overview'
  const isGraph = activeFlow === 'graph'

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      <div className="absolute left-3 top-[76px] hidden md:flex flex-col gap-2 pointer-events-auto">
        {FLOW_ORDER.map((flow) => (
          <FlowButton
            key={`dock-${flow}`}
            flow={flow}
            active={flow === activeFlow}
            onFlowChange={onFlowChange}
          />
        ))}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 md:hidden flex items-center gap-1 rounded-2xl border border-[#26344a] bg-[#040914f2] backdrop-blur-xl px-2 py-2 pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        {FLOW_ORDER.map((flow) => (
          <FlowButton
            key={`mobile-${flow}`}
            flow={flow}
            active={flow === activeFlow}
            onFlowChange={onFlowChange}
          />
        ))}
      </div>

      <AnimatePresence>
        {!isOverview && (
          <motion.div
            key={activeFlow}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={isGraph
              ? 'absolute top-[76px] bottom-3 left-3 right-3 md:left-[13%] md:right-3 pointer-events-auto'
              : 'absolute top-[76px] bottom-3 right-3 w-[min(96vw,430px)] pointer-events-auto'}
          >
            <div
              className="h-full rounded-2xl overflow-hidden backdrop-blur-xl"
              style={{
                border: `1px solid ${meta.color}35`,
                background: 'linear-gradient(165deg, rgba(8,10,16,0.92), rgba(5,7,12,0.92))',
                boxShadow: `0 14px 70px rgba(0,0,0,0.45), 0 0 24px ${meta.color}1f`,
              }}
            >
              <div className="h-12 px-3 border-b border-[#1b2230] flex items-center justify-between bg-[#070b12cc]">
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ color: meta.color }}>{FLOW_ICON[activeFlow]}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-[#dde6f7] tracking-wide truncate">{meta.label}</div>
                    <div className="text-[9px] text-[#647088] font-mono truncate">{meta.hint}</div>
                  </div>
                </div>
                <button
                  onClick={() => onFlowChange('overview')}
                  className="w-8 h-8 rounded-lg border border-[#1f2a3c] bg-[#0a101bcc] text-[#94a3b8] hover:text-white hover:border-[#2e425e] transition-colors flex items-center justify-center"
                  title="Cerrar panel"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="h-[calc(100%-48px)] overflow-hidden">
                <PanelContent activeFlow={activeFlow} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
