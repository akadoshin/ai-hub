import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

interface WorkspaceData {
  agentId: string; path: string; files: string[]; dirs: string[]
}

function WorkspaceNode({ data }: NodeProps) {
  const ws = data as unknown as WorkspaceData

  return (
    <div className="rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:border-[#2a2a33]"
      style={{ background: '#080810', border: '1px solid #14141c', minWidth: 160 }}>

      <Handle type="target" position={Position.Left} style={{ background: '#1a1a22', border: 'none', width: 5, height: 5 }} />

      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm">📂</span>
          <div>
            <div className="text-[10px] font-semibold text-[#888]">Workspace</div>
            <div className="text-[8px] font-mono text-[#444] truncate max-w-[120px]">{ws.path.split('/').pop()}</div>
          </div>
        </div>

        {/* Files */}
        <div className="space-y-0.5">
          {ws.dirs.slice(0, 4).map(d => (
            <div key={d} className="text-[9px] font-mono text-[#555] flex items-center gap-1">
              <span className="text-[8px]">📁</span> {d}
            </div>
          ))}
          {ws.files.slice(0, 6).map(f => (
            <div key={f} className="text-[9px] font-mono text-[#444] flex items-center gap-1">
              <span className="text-[8px]">📄</span> {f}
            </div>
          ))}
          {(ws.files.length + ws.dirs.length) > 10 && (
            <div className="text-[8px] text-[#333] font-mono">
              +{ws.files.length + ws.dirs.length - 10} more
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const WorkspaceNodeComponent = memo(WorkspaceNode)
