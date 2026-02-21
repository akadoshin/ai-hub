import { useHubStore } from '../store'
import type { Task } from '../store'
import { CheckCircle, XCircle, Loader, Clock } from 'lucide-react'

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function TaskCard({ task }: { task: Task }) {
  const elapsed = fmtElapsed(
    task.status === 'running'
      ? Date.now() - task.startTime
      : task.elapsed * 1000
  )

  const statusMap = {
    running:   { icon: <Loader size={13} className="animate-spin" />, color: '#60a5fa', bg: '#60a5fa15' },
    completed: { icon: <CheckCircle size={13} />, color: '#00ff88', bg: '#00ff8815' },
    failed:    { icon: <XCircle size={13} />, color: '#f87171', bg: '#f8717115' },
  }
  const cfg = statusMap[task.status]

  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      borderLeft: `3px solid ${cfg.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
          {task.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: cfg.color, fontSize: 11 }}>
          {cfg.icon}
          <span style={{ textTransform: 'capitalize' }}>{task.status}</span>
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>
        {task.model.replace('anthropic/', '')}
      </div>

      {task.lastMessage && (
        <div style={{
          fontSize: 11, color: '#888',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 6,
          background: '#111', borderRadius: 4, padding: '3px 6px',
        }}>
          {task.lastMessage}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#555' }}>
        <Clock size={10} />
        <span>{elapsed}</span>
      </div>

      {task.status === 'running' && (
        <div style={{ marginTop: 6, height: 2, background: '#2a2a2a', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: cfg.color, borderRadius: 1,
            animation: 'progress-indeterminate 1.5s ease-in-out infinite',
            width: '40%',
          }} />
        </div>
      )}
    </div>
  )
}

export function TasksPanel() {
  const tasks = useHubStore(s => s.tasks)
  const running = tasks.filter(t => t.status === 'running')
  const done = tasks.filter(t => t.status !== 'running')

  return (
    <div style={{
      width: 280,
      height: '100%',
      background: '#111',
      borderLeft: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Tasks & Sessions
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
        {running.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
              Running ({running.length})
            </div>
            {running.map(t => <TaskCard key={t.id} task={t} />)}
          </>
        )}
        {done.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 }}>
              Recent
            </div>
            {done.map(t => <TaskCard key={t.id} task={t} />)}
          </>
        )}
        {tasks.length === 0 && (
          <div style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            No tasks yet
          </div>
        )}
      </div>
    </div>
  )
}
