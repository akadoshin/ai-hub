/**
 * AI Hub API Server
 * Connects to OpenClaw gateway for real-time state + reads filesystem for details.
 */

import express from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { watch } from 'fs'
import { callGateway, isConnected } from './gateway-client.mjs'

const app = express()
app.use(cors())
app.use(express.json())

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(process.env.HOME, '.openclaw')
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
  main: path.join(OPENCLAW_DIR, 'workspace'),
  psych: path.join(OPENCLAW_DIR, 'workspace-psych'),
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
  const workspace = WORKSPACE_MAP[agentId] || path.join(OPENCLAW_DIR, `workspace-${agentId}`)
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

// ── Graph Data — full structural view of OpenClaw ──

async function getGraphData() {
  const agents = await getAgents()
  const sessions = await getSessions()
  const connections = await getConnections(agents, sessions)

  // Read cron jobs
  let cronJobs = []
  try {
    const cronPath = path.join(OPENCLAW_DIR, 'cron', 'jobs.json')
    const cronData = await readJsonSafe(cronPath)
    if (cronData?.jobs) {
      cronJobs = cronData.jobs.map(j => ({
        id: j.id,
        name: j.name,
        agentId: j.agentId,
        enabled: j.enabled,
        schedule: j.schedule?.kind === 'cron' ? j.schedule.expr : j.schedule?.kind === 'every' ? `every ${Math.round((j.schedule.everyMs || 0) / 60000)}m` : 'unknown',
        sessionTarget: j.sessionTarget || 'isolated',
        model: null, // inherits from agent
        payload: j.payload?.message?.slice(0, 200) || '',
        state: {
          lastStatus: j.state?.lastStatus || 'unknown',
          lastRunAt: j.state?.lastRunAtMs || 0,
          lastDuration: j.state?.lastDurationMs || 0,
          nextRunAt: j.state?.nextRunAtMs || 0,
          consecutiveErrors: j.state?.consecutiveErrors || 0,
          lastActivity: formatTimeDiff(j.state?.lastRunAtMs),
        },
        delivery: j.delivery?.mode || 'none',
      }))
    }
  } catch {}

  // Read all sessions with full detail for subagents
  const subagents = []
  const cronSessions = []
  try {
    const raw = await getAllSessionsRaw()
    for (const { key, session, agentId } of raw) {
      if (key.endsWith(':main')) continue
      const isCron = key.includes(':cron:')
      const isSubagent = key.includes(':subagent:')
      const isCronRun = key.includes(':run:')

      if (isSubagent) {
        subagents.push({
          id: session.sessionId || key,
          key,
          agentId,
          model: session.model || 'unknown',
          label: session.label || 'Subagent',
          status: getSessionStatus(session),
          lastActivity: formatTimeDiff(session.updatedAt),
          lastActivityMs: session.updatedAt || 0,
        })
      } else if (isCron && !isCronRun) {
        // Cron session (not a run)
        const cronId = key.split(':cron:')[1]?.split(':')[0]
        cronSessions.push({
          id: session.sessionId || key,
          key,
          cronId,
          agentId,
          model: session.model || 'unknown',
          label: session.label || key.split(':').pop(),
          status: getSessionStatus(session),
          lastActivity: formatTimeDiff(session.updatedAt),
        })
      }
    }
  } catch {}

  // Read workspace structure for each agent
  const workspaces = {}
  for (const agent of agents) {
    const ws = agent.id === 'main'
      ? path.join(OPENCLAW_DIR, 'workspace')
      : path.join(OPENCLAW_DIR, `workspace-${agent.id}`)
    try {
      const entries = await fs.readdir(ws, { withFileTypes: true })
      const files = entries.filter(e => e.name.endsWith('.md') || e.name.endsWith('.json')).map(e => e.name)
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)
      workspaces[agent.id] = { path: ws, files, dirs }
    } catch {
      workspaces[agent.id] = { path: ws, files: [], dirs: [] }
    }
  }

  return {
    agents,
    sessions,
    connections,
    cronJobs,
    subagents,
    cronSessions,
    workspaces,
  }
}

app.get('/api/graph', async (req, res) => {
  res.json(await getGraphData())
})

// ── Gateway-powered real-time state ──

function parseBool(v, fallback = false) {
  if (v == null) return fallback
  const s = String(v).toLowerCase()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return fallback
}

async function callGatewaySafe(method, params = {}, timeoutMs = 8000) {
  if (!isConnected()) throw new Error('gateway not connected')
  return await callGateway(method, params, timeoutMs)
}

async function getGatewayState() {
  if (!isConnected()) return null

  try {
    const [agentsResult, statusResult, sessionsResult, cronResult] = await Promise.all([
      callGateway('agents.list', {}, 5000).catch(() => null),
      callGateway('status', {}, 5000).catch(() => null),
      callGateway('sessions.list', {}, 5000).catch(() => null),
      callGateway('cron.list', {}, 5000).catch(() => null),
    ])

    if (!agentsResult && !statusResult && !sessionsResult && !cronResult) return null
    return { agents: agentsResult, status: statusResult, sessions: sessionsResult, crons: cronResult }
  } catch {
    return null
  }
}

function agentIdFromSessionKey(key, defaultId = 'main') {
  if (typeof key !== 'string') return defaultId
  if (key === 'global' || key === 'unknown') return defaultId
  if (key.startsWith('agent:')) {
    const parts = key.split(':')
    if (parts.length >= 2 && parts[1]) return parts[1]
  }
  return defaultId
}

function mapGatewayAgents(gwState) {
  if (!gwState?.agents?.agents) return null

  const defaultId = gwState.agents.defaultId || 'main'
  const sessionRows = Array.isArray(gwState?.sessions?.sessions) ? gwState.sessions.sessions : []

  const agents = gwState.agents.agents.map(agent => {
    const agentSessions = sessionRows.filter(s => agentIdFromSessionKey(s.key, defaultId) === agent.id)
    const mainSession = agentSessions.find(s => s.key?.endsWith(':main'))

    const ageMs = mainSession?.updatedAt ? Date.now() - mainSession.updatedAt : Infinity
    let status = 'idle'
    if (ageMs < 15_000) status = 'active'
    else if (ageMs < 120_000) status = 'thinking'

    const totalTokens = mainSession?.totalTokens ?? 0
    const contextTokens = mainSession?.contextTokens ?? gwState?.sessions?.defaults?.contextTokens ?? 200000
    const percentUsed = contextTokens > 0 ? Math.round((totalTokens / contextTokens) * 100) : 0

    return {
      id: agent.id,
      label: agent.id === 'main'
        ? 'Eugenio'
        : agent.identity?.name || agent.name || agent.id.charAt(0).toUpperCase() + agent.id.slice(1),
      model: mainSession?.model || 'unknown',
      status,
      lastActivity: formatTimeDiff(mainSession?.updatedAt),
      lastActivityMs: mainSession?.updatedAt || 0,
      messageCount: 0,
      description: agent.id === 'main' ? 'Main assistant — core agent' : `${agent.id} agent`,
      sessionKey: `agent:${agent.id}:main`,
      sessionCount: agentSessions.length,
      activeSessions: agentSessions.filter(s => {
        const age = s.updatedAt ? Date.now() - s.updatedAt : Infinity
        return age < 120_000
      }).length,
      contextTokens,
      totalTokens,
      percentUsed,
      inputTokens: mainSession?.inputTokens ?? 0,
      outputTokens: mainSession?.outputTokens ?? 0,
      cacheRead: mainSession?.cacheRead ?? 0,
      cacheWrite: mainSession?.cacheWrite ?? 0,
      remainingTokens: contextTokens > 0 ? Math.max(0, contextTokens - totalTokens) : null,
      reasoningLevel: mainSession?.reasoningLevel || 'off',
      bootstrapPending: false,
    }
  })

  agents.sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
  return agents
}

function mapGatewaySessions(gwState) {
  if (!gwState?.sessions?.sessions) return null

  const defaultAgentId = gwState?.agents?.defaultId || 'main'
  return gwState.sessions.sessions
    .filter(s => !s.key?.endsWith(':main'))
    .map(s => {
      const ageMs = s.updatedAt ? Date.now() - s.updatedAt : Infinity
      let sessionStatus = 'completed'
      if (ageMs < 30_000) sessionStatus = 'running'
      const agentId = agentIdFromSessionKey(s.key, defaultAgentId)

      return {
        id: s.sessionId || s.key,
        key: s.key,
        label: s.displayName || s.label || s.derivedTitle || s.key?.split(':').pop() || s.key,
        model: s.model || 'unknown',
        status: sessionStatus,
        type: s.key?.includes(':cron:') ? 'cron' : 'spawn',
        kind: s.kind,
        startTime: s.updatedAt || 0,
        lastActivityMs: s.updatedAt || 0,
        elapsed: s.updatedAt ? Math.floor((Date.now() - s.updatedAt) / 1000) : 0,
        lastMessage: s.lastMessagePreview || '',
        agentId,
        parentAgent: agentId,
        targetAgent: null,
        inputTokens: s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
        totalTokens: s.totalTokens ?? 0,
        percentUsed: s.contextTokens ? Math.round(((s.totalTokens || 0) / s.contextTokens) * 100) : 0,
        contextTokens: s.contextTokens ?? gwState?.sessions?.defaults?.contextTokens ?? 0,
        cacheRead: s.cacheRead ?? 0,
        cacheWrite: s.cacheWrite ?? 0,
        reasoningLevel: s.reasoningLevel || 'off',
        flags: s.flags || [],
      }
    })
}

// Hybrid state: gateway for real-time, filesystem for what gateway doesn't expose
async function getHybridState() {
  const gwState = await getGatewayState()

  if (gwState) {
    const agents = mapGatewayAgents(gwState) || await getAgents()
    const sessions = mapGatewaySessions(gwState) || await getSessions()
    const connections = await getConnections(agents, sessions)

    return {
      agents,
      sessions,
      connections,
      gateway: {
        connected: true,
        version: null,
        host: null,
      },
    }
  }

  // Fallback to filesystem
  const state = await getFullState()
  return { ...state, gateway: { connected: false } }
}

app.get('/api/state', async (req, res) => {
  res.json(await getHybridState())
})

app.get('/api/status', async (req, res) => {
  const { agents, sessions, connections, gateway } = await getHybridState()
  res.json({
    connected: gateway?.connected ?? false,
    totalAgents: agents.length,
    activeSessions: agents.filter(a => a.status === 'active' || a.status === 'thinking').length,
    totalSessions: sessions.length,
    runningSessions: sessions.filter(s => s.status === 'running').length,
    totalConnections: connections.length,
    activeConnections: connections.filter(c => c.active).length,
  })
})

// ── Gateway REST Bridge (for control UI features) ──

app.get('/api/gateway/health', async (req, res) => {
  try { res.json(await callGatewaySafe('health', { probe: parseBool(req.query.probe, false) }, 10000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/gateway/status', async (req, res) => {
  try { res.json(await callGatewaySafe('status', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/gateway/channels', async (req, res) => {
  try { res.json(await callGatewaySafe('channels.status', {}, 10000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/gateway/agents', async (req, res) => {
  try { res.json(await callGatewaySafe('agents.list', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/gateway/sessions', async (req, res) => {
  try {
    const params = {}
    if (req.query.limit) params.limit = Number(req.query.limit)
    if (req.query.agentId) params.agentId = String(req.query.agentId)
    if (req.query.activeMinutes) params.activeMinutes = Number(req.query.activeMinutes)
    if (req.query.search) params.search = String(req.query.search)
    res.json(await callGatewaySafe('sessions.list', params, 10000))
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.get('/api/gateway/models', async (req, res) => {
  try { res.json(await callGatewaySafe('models.list', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/gateway/skills/status', async (req, res) => {
  try {
    const params = req.query.agentId ? { agentId: String(req.query.agentId) } : {}
    res.json(await callGatewaySafe('skills.status', params, 10000))
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.post('/api/gateway/skills/install', async (req, res) => {
  try { res.json(await callGatewaySafe('skills.install', req.body || {}, 20000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/skills/update', async (req, res) => {
  try { res.json(await callGatewaySafe('skills.update', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// ── System control ──
import { exec as execChild } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(execChild)

app.post('/api/system/gateway/restart', async (req, res) => {
  try {
    await execAsync('systemctl --user restart openclaw-gateway.service')
    res.json({ ok: true, message: 'Gateway restart initiated' })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Restart failed' })
  }
})

app.get('/api/system/gateway/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('systemctl --user is-active openclaw-gateway.service')
    res.json({ status: stdout.trim() })
  } catch {
    res.json({ status: 'inactive' })
  }
})

// ── Agent CRUD ──
app.post('/api/gateway/agents/create', async (req, res) => {
  try {
    const { name, workspace } = req.body || {}
    if (!name || !workspace) return res.status(400).json({ error: 'name and workspace are required' })
    res.json(await callGatewaySafe('agents.create', { name: String(name), workspace: String(workspace) }, 10000))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/gateway/agents/:id', async (req, res) => {
  try {
    res.json(await callGatewaySafe('agents.update', { agentId: req.params.id, ...req.body }, 10000))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/gateway/agents/:id', async (req, res) => {
  try {
    res.json(await callGatewaySafe('agents.delete', { agentId: req.params.id }, 10000))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/gateway/cron', async (req, res) => {
  try {
    const params = { includeDisabled: parseBool(req.query.includeDisabled, true) }
    res.json(await callGatewaySafe('cron.list', params, 10000))
  } catch (e) {
    res.status(503).json({ error: e.message })
  }
})

app.get('/api/gateway/cron/status', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.status', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/gateway/cron/add', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.add', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/cron/update', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.update', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/cron/remove', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.remove', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/cron/run', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.run', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/cron/runs', async (req, res) => {
  try { res.json(await callGatewaySafe('cron.runs', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/gateway/chat/history', async (req, res) => {
  try {
    const params = {
      key: String(req.query.key || req.query.sessionKey || 'agent:main:main'),
      limit: req.query.limit ? Number(req.query.limit) : 80,
    }
    res.json(await callGatewaySafe('chat.history', params, 12000))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/gateway/chat/send', async (req, res) => {
  try { res.json(await callGatewaySafe('chat.send', req.body || {}, 15000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/chat/abort', async (req, res) => {
  try { res.json(await callGatewaySafe('chat.abort', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/call', async (req, res) => {
  try {
    const method = String(req.body?.method || '').trim()
    if (!method) return res.status(400).json({ error: 'method is required' })
    const params = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : {}
    const timeoutMs = Number(req.body?.timeoutMs || 10000)
    res.json(await callGatewaySafe(method, params, timeoutMs))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/gateway/exec/settings', async (req, res) => {
  try { res.json(await callGatewaySafe('exec.approvals.get', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/gateway/exec/request', async (req, res) => {
  try { res.json(await callGatewaySafe('exec.approval.request', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/exec/resolve', async (req, res) => {
  try { res.json(await callGatewaySafe('exec.approval.resolve', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/gateway/devices', async (req, res) => {
  try { res.json(await callGatewaySafe('device.pair.list', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/gateway/devices/approve', async (req, res) => {
  try { res.json(await callGatewaySafe('device.pair.approve', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/devices/reject', async (req, res) => {
  try { res.json(await callGatewaySafe('device.pair.reject', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/gateway/devices/remove', async (req, res) => {
  try { res.json(await callGatewaySafe('device.pair.remove', req.body || {}, 10000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/gateway/voicewake', async (req, res) => {
  try { res.json(await callGatewaySafe('voicewake.get', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/gateway/voicewake', async (req, res) => {
  try { res.json(await callGatewaySafe('voicewake.set', req.body || {}, 8000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/gateway/nodes', async (req, res) => {
  try { res.json(await callGatewaySafe('node.list', {}, 8000)) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/gateway/nodes/invoke', async (req, res) => {
  try { res.json(await callGatewaySafe('node.invoke', req.body || {}, 15000)) }
  catch (e) { res.status(500).json({ error: e.message }) }
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
            const state = await getHybridState()
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
  const state = await getHybridState()
  broadcast({ type: 'update', ...state })
}, 5000)

// ── Start ──

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ai-hub-api] listening on :${PORT}`)
  watchSessions()
})
