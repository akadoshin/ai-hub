/**
 * AI Hub API Server
 * Reads OpenClaw agent/session state from the filesystem and exposes it
 * as REST + Server-Sent Events for real-time updates.
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { watch } from 'fs'

const app = express()
app.use(cors())
app.use(express.json())

const OPENCLAW_DIR = path.join(process.env.HOME, '.openclaw')
const AGENTS_DIR = path.join(OPENCLAW_DIR, 'agents')
const PORT = 3001

// ── Helpers ──

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── Agent Data ──

async function getAgents() {
  const agents = []
  try {
    const dirs = await fs.readdir(AGENTS_DIR)
    for (const agentId of dirs) {
      const agentDir = path.join(AGENTS_DIR, agentId)
      const stat = await fs.stat(agentDir).catch(() => null)
      if (!stat?.isDirectory()) continue

      const sessionsPath = path.join(agentDir, 'sessions', 'sessions.json')
      const data = await readJsonSafe(sessionsPath)
      if (!data) continue

      const mainKey = `agent:${agentId}:main`
      const mainSession = data[mainKey]

      const allSessions = Object.entries(data)
      const activeSessions = allSessions.filter(([, v]) => {
        const age = Date.now() - (v.updatedAt || 0)
        return age < 300_000
      }).length

      // Count messages from JSONL files
      let messageEstimate = 0
      try {
        const sessDir = path.join(agentDir, 'sessions')
        const files = await fs.readdir(sessDir)
        for (const f of files.filter(f => f.endsWith('.jsonl'))) {
          try {
            const stat = await fs.stat(path.join(sessDir, f))
            messageEstimate += Math.floor(stat.size / 2000)
          } catch {}
        }
      } catch {}

      agents.push({
        id: agentId,
        label: agentId === 'main' ? 'Eugenio' : agentId.charAt(0).toUpperCase() + agentId.slice(1),
        model: mainSession?.model || 'unknown',
        status: getAgentStatus(mainSession),
        lastActivity: formatTimeDiff(mainSession?.updatedAt),
        lastActivityMs: mainSession?.updatedAt || 0,
        messageCount: messageEstimate,
        description: agentId === 'main' ? 'Main assistant — core agent' : `${agentId} agent`,
        sessionKey: mainKey,
        sessionCount: allSessions.length,
        activeSessions,
        contextTokens: mainSession?.contextTokens || 0,
        reasoningLevel: mainSession?.reasoningLevel || 'off',
      })
    }
  } catch (e) {
    console.error('getAgents error:', e.message)
  }

  agents.sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
  return agents
}

// ── Sessions / Tasks ──

async function getAllSessionsRaw() {
  const sessions = []
  try {
    const dirs = await fs.readdir(AGENTS_DIR)
    for (const agentId of dirs) {
      const sessionsPath = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
      const data = await readJsonSafe(sessionsPath)
      if (!data || typeof data !== 'object') continue

      for (const [key, session] of Object.entries(data)) {
        sessions.push({ key, session, agentId })
      }
    }
  } catch {}
  return sessions
}

async function getSessions() {
  const raw = await getAllSessionsRaw()
  const tasks = []

  for (const { key, session, agentId } of raw) {
    if (key.endsWith(':main')) continue

    const isCron = key.includes(':cron:')
    const type = isCron ? 'cron' : 'spawn'

    // Try to detect target agent from session label or key
    let targetAgent = null
    if (session.label) {
      const labelLower = session.label.toLowerCase()
      // Check if label mentions another agent
      const agentIds = raw.map(r => r.agentId).filter((v, i, a) => a.indexOf(v) === i)
      for (const aid of agentIds) {
        if (aid !== agentId && labelLower.includes(aid)) {
          targetAgent = aid
          break
        }
      }
    }

    tasks.push({
      id: session.sessionId || key,
      key,
      label: session.label || key.split(':').pop() || key,
      model: session.model || 'unknown',
      status: getSessionStatus(session),
      type,
      startTime: session.createdAt || session.updatedAt || 0,
      lastActivityMs: session.updatedAt || 0,
      elapsed: session.updatedAt ? Math.floor((Date.now() - session.updatedAt) / 1000) : 0,
      lastMessage: session.label || '',
      agentId,
      parentAgent: agentId,
      targetAgent,
    })
  }

  const seen = new Set()
  const deduped = tasks.filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  deduped.sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0))
  return deduped.slice(0, 50)
}

// ── Connections ──

async function getConnections(agents, sessions) {
  const connections = []
  const seen = new Set()
  const agentIds = new Set(agents.map(a => a.id))

  // 1. Hierarchy: every non-main agent has a base connection to main
  for (const agent of agents) {
    if (agent.id === 'main') continue
    const key = `main→${agent.id}`
    if (seen.has(key)) continue
    seen.add(key)

    // Check if there's active interaction
    const relatedTasks = sessions.filter(s =>
      (s.parentAgent === 'main' && (s.agentId === agent.id || s.targetAgent === agent.id)) ||
      (s.parentAgent === agent.id && (s.targetAgent === 'main'))
    )
    const runningTasks = relatedTasks.filter(s => s.status === 'running')
    const isActive = agent.status === 'active' || agent.status === 'thinking' || runningTasks.length > 0

    connections.push({
      id: key,
      from: 'main',
      to: agent.id,
      type: 'hierarchy',
      active: isActive,
      strength: isActive ? 1.0 : 0.3,
      label: runningTasks.length > 0 ? `${runningTasks.length} running` : '',
      taskCount: relatedTasks.length,
      runningCount: runningTasks.length,
    })
  }

  // 2. Cross-agent connections from sessions
  for (const session of sessions) {
    if (!session.targetAgent || session.targetAgent === session.parentAgent) continue
    if (!agentIds.has(session.parentAgent) || !agentIds.has(session.targetAgent)) continue

    const key = `${session.parentAgent}→${session.targetAgent}`
    if (seen.has(key)) {
      // Update existing connection
      const existing = connections.find(c => c.id === key)
      if (existing) {
        existing.taskCount++
        if (session.status === 'running') {
          existing.runningCount++
          existing.active = true
          existing.strength = 1.0
          existing.label = `${existing.runningCount} running`
        }
      }
      continue
    }
    seen.add(key)

    const isRunning = session.status === 'running'
    connections.push({
      id: key,
      from: session.parentAgent,
      to: session.targetAgent,
      type: 'task',
      active: isRunning,
      strength: isRunning ? 1.0 : 0.5,
      label: isRunning ? session.label : '',
      taskCount: 1,
      runningCount: isRunning ? 1 : 0,
    })
  }

  // 3. Cron connections — crons create implicit connections
  for (const session of sessions) {
    if (session.type !== 'cron') continue
    // Crons run on their parent agent, so they connect parent to itself (moon)
    // But if they mention another agent, that's a cross connection
    if (session.targetAgent && session.targetAgent !== session.parentAgent) {
      const key = `${session.parentAgent}→${session.targetAgent}:cron`
      if (!seen.has(key) && agentIds.has(session.parentAgent) && agentIds.has(session.targetAgent)) {
        seen.add(key)
        connections.push({
          id: key,
          from: session.parentAgent,
          to: session.targetAgent,
          type: 'cron',
          active: session.status === 'running',
          strength: session.status === 'running' ? 0.8 : 0.2,
          label: session.status === 'running' ? `cron: ${session.label}` : '',
          taskCount: 1,
          runningCount: session.status === 'running' ? 1 : 0,
        })
      }
    }
  }

  return connections
}

// ── Status helpers ──

function getAgentStatus(session) {
  if (!session?.updatedAt) return 'idle'
  const age = Date.now() - session.updatedAt
  if (age < 30_000) return 'active'
  if (age < 300_000) return 'thinking'
  return 'idle'
}

function getSessionStatus(session) {
  if (!session?.updatedAt) return 'completed'
  const age = Date.now() - session.updatedAt
  if (age < 60_000) return 'running'
  return 'completed'
}

function formatTimeDiff(ms) {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 10_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ── Full state snapshot ──

async function getFullState() {
  const agents = await getAgents()
  const sessions = await getSessions()
  const connections = await getConnections(agents, sessions)
  return { agents, sessions, connections }
}

// ── REST Endpoints ──

app.get('/api/agents', async (req, res) => {
  res.json(await getAgents())
})

app.get('/api/sessions', async (req, res) => {
  res.json(await getSessions())
})

app.get('/api/connections', async (req, res) => {
  const agents = await getAgents()
  const sessions = await getSessions()
  res.json(await getConnections(agents, sessions))
})

// ── Agent Detail — deep dive into an agent's internal world ──

const WORKSPACE_MAP = {
  main: path.join(process.env.HOME, '.openclaw', 'workspace'),
  psych: path.join(process.env.HOME, '.openclaw', 'workspace-psych'),
}

async function readFileSafe(filePath, maxSize = 8000) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return content.length > maxSize ? content.slice(0, maxSize) + '\n\n[... truncated]' : content
  } catch {
    return null
  }
}

async function getAgentDetail(agentId) {
  const workspace = WORKSPACE_MAP[agentId] || path.join(process.env.HOME, '.openclaw', `workspace-${agentId}`)
  const sessionsPath = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')

  // Read workspace files
  const [soul, memory, identity, tools, heartbeat, agents, user] = await Promise.all([
    readFileSafe(path.join(workspace, 'SOUL.md')),
    readFileSafe(path.join(workspace, 'MEMORY.md')),
    readFileSafe(path.join(workspace, 'IDENTITY.md')),
    readFileSafe(path.join(workspace, 'TOOLS.md')),
    readFileSafe(path.join(workspace, 'HEARTBEAT.md')),
    readFileSafe(path.join(workspace, 'AGENTS.md')),
    readFileSafe(path.join(workspace, 'USER.md')),
  ])

  // Read recent memory files
  const memoryDir = path.join(workspace, 'memory')
  let recentMemories = []
  try {
    const files = (await fs.readdir(memoryDir)).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 5)
    recentMemories = await Promise.all(files.map(async f => ({
      name: f,
      date: f.replace('.md', ''),
      preview: await readFileSafe(path.join(memoryDir, f), 2000),
    })))
  } catch {}

  // Read all sessions for this agent
  const sessData = await readJsonSafe(sessionsPath)
  const sessions = []
  if (sessData) {
    for (const [key, session] of Object.entries(sessData)) {
      const isCron = key.includes(':cron:')
      const age = Date.now() - (session.updatedAt || 0)
      sessions.push({
        key,
        label: session.label || key.split(':').pop(),
        model: session.model || 'unknown',
        status: age < 60_000 ? 'running' : 'completed',
        type: isCron ? 'cron' : key.endsWith(':main') ? 'main' : 'spawn',
        updatedAt: session.updatedAt || 0,
        createdAt: session.createdAt || session.updatedAt || 0,
        lastActivity: formatTimeDiff(session.updatedAt),
        contextTokens: session.contextTokens || 0,
        reasoningLevel: session.reasoningLevel || 'off',
      })
    }
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  }

  // List workspace files
  let workspaceFiles = []
  try {
    const entries = await fs.readdir(workspace, { withFileTypes: true })
    workspaceFiles = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
    })).sort((a, b) => a.type === 'dir' ? -1 : 1)
  } catch {}

  // Cron jobs
  const crons = sessions.filter(s => s.type === 'cron')
  const spawns = sessions.filter(s => s.type === 'spawn')

  return {
    id: agentId,
    workspace: workspace,
    files: {
      soul, memory, identity, tools, heartbeat, agents, user,
    },
    recentMemories,
    sessions,
    crons,
    spawns,
    workspaceFiles,
    stats: {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'running').length,
      cronCount: crons.length,
      spawnCount: spawns.length,
      fileCount: workspaceFiles.length,
    }
  }
}

app.get('/api/agents/:id/detail', async (req, res) => {
  try {
    res.json(await getAgentDetail(req.params.id))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/state', async (req, res) => {
  res.json(await getFullState())
})

app.get('/api/status', async (req, res) => {
  const { agents, sessions, connections } = await getFullState()
  res.json({
    connected: true,
    totalAgents: agents.length,
    activeSessions: agents.filter(a => a.status === 'active' || a.status === 'thinking').length,
    totalSessions: sessions.length,
    runningSessions: sessions.filter(s => s.status === 'running').length,
    totalConnections: connections.length,
    activeConnections: connections.filter(c => c.active).length,
  })
})

// ── SSE ──

const sseClients = new Set()

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  res.write('data: {"type":"connected"}\n\n')
  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
})

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    client.write(payload)
  }
}

// Watch session files
function watchSessions() {
  fs.readdir(AGENTS_DIR).then(dirs => {
    for (const agentId of dirs) {
      const sessDir = path.join(AGENTS_DIR, agentId, 'sessions')
      try {
        watch(sessDir, { persistent: false }, async (eventType, filename) => {
          if (filename === 'sessions.json') {
            const state = await getFullState()
            broadcast({ type: 'update', ...state })
          }
        })
        console.log(`[watch] ${agentId}/sessions`)
      } catch {}
    }
  }).catch(() => {})
}

// Poll fallback every 5s
setInterval(async () => {
  if (sseClients.size === 0) return
  const state = await getFullState()
  broadcast({ type: 'update', ...state })
}, 5000)

// ── Start ──

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ai-hub-api] listening on :${PORT}`)
  watchSessions()
})
