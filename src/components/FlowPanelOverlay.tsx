import { AnimatePresence, motion } from 'framer-motion'
import { X, Boxes, Network, Activity, Cpu, Sparkles } from 'lucide-react'
import { TasksPanel } from './TasksPanel'
import { GatewayPanel } from './GatewayPanel'
import { MeshyPanel } from './MeshyPanel'
import { GraphView } from './GraphView'
import type { MainView, PanelView } from '../types/flows'
import { MAIN_VIEW_META, PANEL_META } from '../types/flows'

interface Props {
  mainView: MainView
  onMainViewChange: (v: MainView) => void
  activePanel: PanelView
  onPanelChange: (p: PanelView) => void
}

const MAIN_VIEW_ICON: Record<MainView, React.ReactNode> = {
  deck: <Boxes size={16} />,
  graph: <Network size={16} />,
}

const PANEL_ICON: Record<Exclude<PanelView, null>, React.ReactNode> = {
  tasks: <Activity size={16} />,
  gateway: <Cpu size={16} />,
  meshy: <Sparkles size={16} />,
}

const MAIN_VIEWS: MainView[] = ['deck', 'graph']
const PANELS: Exclude<PanelView, null>[] = ['tasks', 'gateway', 'meshy']

// Panel width constant — used to shrink graph area
const PANEL_W = 442 // 430px + 12px gap

// Kept for external consumers
const DOCK_LEFT_MD = 64
const DOCK_LEFT_LG = 144

function PanelContent({ panel }: { panel: Exclude<PanelView, null> }) {
  if (panel === 'tasks') return <TasksPanel sidebar />
  if (panel === 'gateway') return <GatewayPanel />
  return <MeshyPanel embedded />
}

function GraphCard({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="h-full rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col"
      style={{
        border: `1px solid ${MAIN_VIEW_META.graph.color}25`,
        background: 'linear-gradient(165deg, rgba(10,10,16,0.94), rgba(6,6,12,0.94))',
        boxShadow: '0 14px 70px rgba(0,0,0,0.45)',
      }}
    >
      <div className="h-10 px-3 border-b border-[#1a1a22] flex items-center justify-between bg-[#0a0a10cc] shrink-0">
        <div className="flex items-center gap-2">
          <Network size={12} className="text-[#60a5fa]" />
          <span className="text-[10px] font-semibold text-[#aaaacc] tracking-wide">Agent Graph</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-[#222232] bg-[#0d0d1acc] text-[#888898] hover:text-white hover:border-[#333345] transition-colors flex items-center justify-center"
          title="Cerrar — volver al Deck"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <GraphView />
      </div>
    </div>
  )
}

/**
 * SidePanelCard
 *
 * fullHeight=true  → fills all available vertical space (h-full)
 * fullHeight=false → height driven by content; when content exceeds maxH → scrolls
 */
function SidePanelCard({
  panel,
  meta,
  onClose,
  fullHeight,
}: {
  panel: Exclude<PanelView, null>
  meta: (typeof PANEL_META)[Exclude<PanelView, null>]
  onClose: () => void
  fullHeight: boolean
}) {
  const isMeshy = panel === 'meshy'

  return (
    <div
      className={`rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col ${fullHeight ? 'h-full' : ''}`}
      style={{
        border: isMeshy ? '1px solid rgba(197,249,85,0.28)' : `1px solid ${meta.color}35`,
        background: isMeshy
          ? 'linear-gradient(165deg, rgba(12,14,19,0.96), rgba(8,9,12,0.97))'
          : 'linear-gradient(165deg, rgba(10,10,16,0.94), rgba(6,6,12,0.94))',
        boxShadow: isMeshy
          ? '0 16px 80px rgba(0,0,0,0.55), 0 0 36px rgba(197,249,85,0.12), 0 0 26px rgba(255,62,143,0.08)'
          : `0 14px 70px rgba(0,0,0,0.45), 0 0 24px ${meta.color}1f`,
      }}
    >
      {/* Header — always visible */}
      <div
        className="h-12 px-4 border-b flex items-center justify-between shrink-0"
        style={{
          borderBottomColor: isMeshy ? 'rgba(197,249,85,0.25)' : '#1a1a22',
          background: isMeshy
            ? 'linear-gradient(90deg, rgba(197,249,85,0.10), rgba(255,62,143,0.09) 55%, rgba(10,10,16,0.90))'
            : '#0a0a10cc',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span style={{ color: isMeshy ? '#c5f955' : meta.color }}>{PANEL_ICON[panel]}</span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#ddddee] tracking-wide truncate">{meta.label}</div>
            <div className="text-[9px] font-mono truncate" style={{ color: isMeshy ? '#8a9580' : '#555568' }}>{meta.hint}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`w-8 h-8 rounded-lg border transition-colors flex items-center justify-center ${
            isMeshy
              ? 'border-[#384a28] bg-[#182015cc] text-[#c5f955] hover:text-[#ecffb5] hover:border-[#5a743e]'
              : 'border-[#222232] bg-[#0d0d1acc] text-[#888898] hover:text-white hover:border-[#333345]'
          }`}
          title="Cerrar panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content
          fullHeight → flex-1 + min-h-0 → fills space, inner items scroll
          auto       → max-h caps growth, overflow-y scrolls         */}
      <div
        className={
          fullHeight
            ? 'flex-1 min-h-0 overflow-y-auto'
            : 'overflow-y-auto'
        }
        style={fullHeight ? undefined : { maxHeight: 'calc(100vh - 160px)' }}
      >
        <PanelContent panel={panel} />
      </div>
    </div>
  )
}

export function FlowPanelOverlay({ mainView, onMainViewChange, activePanel, onPanelChange }: Props) {
  const panelMeta = activePanel ? PANEL_META[activePanel] : null
  // Sidepanel gets full height when graph is also open
  const panelFullHeight = mainView === 'graph' && activePanel !== null

  return (
    <div className="absolute inset-0 pointer-events-none z-40">

      {/* ── Mobile bottom bar (nav only) ── */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 md:hidden flex items-center gap-1 rounded-2xl border border-[#222232] bg-[#08081af2] backdrop-blur-xl px-2 py-2 pointer-events-auto shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
        {MAIN_VIEWS.map((v) => {
          const meta = MAIN_VIEW_META[v]
          const active = v === mainView
          return (
            <button key={v} onClick={() => onMainViewChange(v)}
              className="rounded-xl px-2.5 py-1.5 text-[9px] font-semibold transition-all"
              style={{
                border: `1px solid ${active ? `${meta.color}60` : '#222230'}`,
                background: active ? `${meta.color}18` : 'transparent',
                color: active ? meta.color : '#777790',
              }}
            >
              {meta.label}
            </button>
          )
        })}
        <div className="w-px h-5 bg-[#1a1a22] mx-0.5" />
        {PANELS.map((p) => {
          const meta = PANEL_META[p]
          const active = p === activePanel
          return (
            <button key={p} onClick={() => onPanelChange(active ? null : p)}
              className="rounded-xl px-2.5 py-1.5 text-[9px] font-semibold transition-all"
              style={{
                border: `1px solid ${active ? `${meta.color}60` : '#222230'}`,
                background: active ? `${meta.color}18` : 'transparent',
                color: active ? meta.color : '#777790',
              }}
            >
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* ── Mobile panel overlay ── */}
      <AnimatePresence>
        {activePanel && panelMeta && (
          <motion.div
            key={`mobile-${activePanel}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden absolute top-3 bottom-[64px] left-3 right-3 pointer-events-auto"
          >
            <SidePanelCard panel={activePanel} meta={panelMeta} fullHeight onClose={() => onPanelChange(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          Desktop layout  (md+)

          Structure:
            absolute row: [dock (self-start)] [graph (flex-1, full-height)]
            absolute pos:                                 [sidepanel (bottom-right)]

          The sidepanel lives OUTSIDE the dock+graph flex row so it always
          anchors to the bottom-right corner of the screen.
          The graph area transitions its right edge to make room for the panel.
         ══════════════════════════════════════════════════════════════ */}

      {/* Dock + Graph flex row */}
      <div
        className="hidden md:flex absolute top-[68px] bottom-3 left-3 gap-3 pointer-events-none"
        style={{
          right: activePanel ? PANEL_W + 12 : 12,
          transition: 'right 0.25s ease',
        }}
      >
        {/* Left dock — self-start so buttons don't stretch vertically */}
        <div className="flex flex-col gap-3 pointer-events-auto shrink-0 self-start">
          {MAIN_VIEWS.map((v) => {
            const meta = MAIN_VIEW_META[v]
            const active = v === mainView
            return (
              <button key={v} onClick={() => onMainViewChange(v)}
                className="group flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all"
                style={{
                  border: `1px solid ${active ? `${meta.color}60` : '#222230'}`,
                  background: active ? `${meta.color}18` : '#0d0d16f0',
                  color: active ? meta.color : '#777790',
                  boxShadow: active ? `0 0 18px ${meta.color}20` : 'none',
                }}
                title={`${meta.label} (${meta.shortcut})`}
              >
                <span className="shrink-0">{MAIN_VIEW_ICON[v]}</span>
                <span className="hidden lg:block text-[10px] font-semibold tracking-wide">{meta.label}</span>
                <span className="hidden xl:block ml-auto text-[9px] text-[#555568] font-mono">{meta.shortcut}</span>
              </button>
            )
          })}

          <div className="h-px bg-[#1a1a22] mx-2" />

          {PANELS.map((p) => {
            const meta = PANEL_META[p]
            const active = p === activePanel
            return (
              <button key={p} onClick={() => onPanelChange(active ? null : p)}
                className="group flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all"
                style={{
                  border: `1px solid ${active ? `${meta.color}60` : '#222230'}`,
                  background: active ? `${meta.color}18` : '#0d0d16f0',
                  color: active ? meta.color : '#777790',
                  boxShadow: active ? `0 0 18px ${meta.color}20` : 'none',
                }}
                title={`${meta.label} (${meta.shortcut}) — ${meta.hint}`}
              >
                <span className="shrink-0">{PANEL_ICON[p]}</span>
                <span className="hidden lg:block text-[10px] font-semibold tracking-wide">{meta.label}</span>
                <span className="hidden xl:block ml-auto text-[9px] text-[#555568] font-mono">{meta.shortcut}</span>
              </button>
            )
          })}
        </div>

        {/* Graph window — fills remaining width, full height */}
        <AnimatePresence>
          {mainView === 'graph' && (
            <motion.div
              key="graph-panel"
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 min-w-0 h-full pointer-events-auto"
            >
              <GraphCard onClose={() => onMainViewChange('deck')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidepanel — always anchored bottom-right, independent of graph row */}
      <AnimatePresence>
        {activePanel && panelMeta && (
          <motion.div
            key={activePanel}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="hidden md:block absolute bottom-3 right-3 pointer-events-auto"
            style={{
              width: 430,
              // full height when graph is open; auto (content-driven) otherwise
              ...(panelFullHeight
                ? { top: 68 }
                : { top: 'auto' }),
            }}
          >
            <SidePanelCard
              panel={activePanel}
              meta={panelMeta}
              fullHeight={panelFullHeight}
              onClose={() => onPanelChange(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export { DOCK_LEFT_MD, DOCK_LEFT_LG }
