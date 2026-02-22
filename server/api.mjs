/**
 * AI Hub API Server
 * Reads OpenClaw agent/session state from the filesystem and exposes it
 * as REST + Server-Sent Events for real-time updates.
 *
 * Runs on port 3001. Frontend proxied through Vite.
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

async function getAgents() {
  const agents = []
  try {
    const dirs = await fs.readdir(AGENTS_DIR)
    for (const agentId of dirs) {
      const sessionsPath = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
      const data = await readJsonSafe(sessionsPath)
      if (!data) continue

      // sessions.json is an object keyed by session key
      const mainKey = `agent:${agentId}:main`
      const mainSession = data[mainKey]

      // Count sessions by status
      const allSessions = Object.entries(data)
      const activeSessions = allSessions.filter(([k, v]) => {
        const age = Date.now() - (v.updatedAt || 0)
        return age < 300_000 // active within 5min
      }).length

      // Count JSONL files for message estimation
      let messageEstimate = 0
      try {
        const sessDir = path.join(AGENTS_DIR, agentId, 'sessions')
        const files = await fs.readdir(sessDir)
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
        for (const f of jsonlFiles) {
          try {
            const stat = await fs.stat(path.join(sessDir, f))
            messageEstimate += Math.floor(stat.size / 2000) // rough estimate: ~2KB per message turn
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

  // Sort: main first
  agents.sort((a, b) => (a.id === 'main' ? -1 : b.id === 'main' ? 1 : 0))
  return agents
}

async function getSessions() {
  const sessions = []
  try {
    const dirs = await fs.readdir(AGENTS_DIR)
    for (const agentId of dirs) {
      const sessionsPath = path.join(AGENTS_DIR, agentId, 'sessions', 'sessions.json')
      const data = await readJsonSafe(sessionsPath)
      if (!data || typeof data !== 'object') continue

      for (const [key, session] of Object.entries(data)) {
        if (key.endsWith(':main')) continue

        // Determine type: cron or spawn
        const isCron = key.includes(':cron:')
        const type = isCron ? 'cron' : 'spawn'

        sessions.push({
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
          agentId: agentId,
          parentAgent: agentId,
        })
      }
    }
  } catch (e) {
    console.error('getSessions error:', e.message)
  }

  // Deduplicate by id
  const seen = new Set()
  const deduped = sessions.filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })

  // Sort by most recent
  deduped.sort((a, b) => (b.lastActivityMs || 0) - (a.lastActivityMs || 0))
  return deduped.slice(0, 20)
}

function getAgentStatus(session) {
  if (!session?.updatedAt) return 'idle'
  const age = Date.now() - session.updatedAt
  if (age < 30_000) return 'active'       // active within 30s
  if (age < 300_000) return 'thinking'     // within 5min — might be processing
  return 'idle'
}

function getSessionStatus(session) {
  if (!session?.updatedAt) return 'completed'
  const age = Date.now() - session.updatedAt
  if (age < 60_000) return 'running'
  if (age < 600_000) return 'completed'
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

// ── REST Endpoints ──

app.get('/api/agents', async (req, res) => {
  res.json(await getAgents())
})

app.get('/api/sessions', async (req, res) => {
  res.json(await getSessions())
})

app.get('/api/status', async (req, res) => {
  const agents = await getAgents()
  const sessions = await getSessions()
  res.json({
    connected: true,
    totalAgents: agents.length,
    activeSessions: agents.filter(a => a.status === 'active' || a.status === 'thinking').length,
    totalSessions: sessions.length,
    runningSessions: sessions.filter(s => s.status === 'running').length,
  })
})

// ── Server-Sent Events for real-time updates ──

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

// Watch session files for changes and broadcast updates
function watchSessions() {
  try {
    const dirsToWatch = []

    // Watch each agent's sessions dir
    fs.readdir(AGENTS_DIR).then(dirs => {
      for (const agentId of dirs) {
        const sessDir = path.join(AGENTS_DIR, agentId, 'sessions')
        try {
          watch(sessDir, { persistent: false }, async (eventType, filename) => {
            if (filename === 'sessions.json') {
              // Session state changed — broadcast full update
              const agents = await getAgents()
              const sessions = await getSessions()
              broadcast({ type: 'update', agents, sessions })
            }
          })
          console.log(`[watch] ${agentId}/sessions`)
        } catch {}
      }
    })
  } catch (e) {
    console.error('watch error:', e.message)
  }
}

// Also poll every 5s as fallback (file watch can miss events)
setInterval(async () => {
  if (sseClients.size === 0) return
  const agents = await getAgents()
  const sessions = await getSessions()
  broadcast({ type: 'update', agents, sessions })
}, 5000)

// ── Start ──

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ai-hub-api] listening on :${PORT}`)
  watchSessions()
})
