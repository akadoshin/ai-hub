/**
 * Gateway client for OpenClaw protocol frames (req/res/event).
 * Includes device identity auth for gateways that require pairing.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'

function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = {}
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key) parsed[key] = value
    }
    return parsed
  } catch {
    return {}
  }
}

const FILE_ENV = parseEnvFile(path.resolve(process.cwd(), '.env.server'))
const env = (key, fallback = '') => process.env[key] ?? FILE_ENV[key] ?? fallback

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || path.join(process.env.HOME || '', '.openclaw')
const DEVICE_IDENTITY_PATH = process.env.OPENCLAW_DEVICE_IDENTITY || path.join(OPENCLAW_DIR, 'identity', 'device.json')

const GATEWAY_URL = env('OPENCLAW_GATEWAY_URL') || `ws://127.0.0.1:${env('OPENCLAW_GATEWAY_PORT', '18789')}`
const GATEWAY_TOKEN = env('OPENCLAW_GATEWAY_TOKEN')
const GATEWAY_PASSWORD = env('OPENCLAW_GATEWAY_PASSWORD')
const PROTOCOL_VERSION = 3

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

let ws = null
let connected = false
let connectSent = false
let reconnectTimer = null
let tickTimer = null
let lastTick = null
const pending = new Map() // id -> { resolve, reject, timer, method }

export function isConnected() { return connected }

function b64UrlEncode(buf) {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function b64UrlDecode(input) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function derivePublicKeyRaw(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem)
  const spki = key.export({ type: 'spki', format: 'der' })
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length)
  }
  return spki
}

function deviceIdFromPublicKeyPem(publicKeyPem) {
  return crypto.createHash('sha256').update(derivePublicKeyRaw(publicKeyPem)).digest('hex')
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return b64UrlEncode(derivePublicKeyRaw(publicKeyPem))
}

function loadOrCreateDeviceIdentity(filePath = DEVICE_IDENTITY_PATH) {
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKeyPem === 'string' &&
        typeof parsed.privateKeyPem === 'string'
      ) {
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem,
        }
      }
    }
  } catch {}

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const deviceId = deviceIdFromPublicKeyPem(publicKeyPem)

  const stored = {
    version: 1,
    deviceId,
    publicKeyPem,
    privateKeyPem,
    createdAtMs: Date.now(),
  }

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 })
    try { fs.chmodSync(filePath, 0o600) } catch {}
  } catch {}

  return { deviceId, publicKeyPem, privateKeyPem }
}

const deviceIdentity = loadOrCreateDeviceIdentity()

function buildDeviceAuthPayload({ deviceId, clientId, clientMode, role, scopes, signedAtMs, token, nonce }) {
  const version = nonce ? 'v2' : 'v1'
  const values = [
    version,
    deviceId,
    clientId,
    clientMode,
    role,
    (scopes || []).join(','),
    String(signedAtMs),
    token || '',
  ]
  if (version === 'v2') values.push(nonce || '')
  return values.join('|')
}

function cleanupPending(reason) {
  for (const [, p] of pending) {
    clearTimeout(p.timer)
    p.reject(new Error(reason))
  }
  pending.clear()
}

function buildConnectParams(nonce) {
  const auth = GATEWAY_TOKEN || GATEWAY_PASSWORD
    ? { token: GATEWAY_TOKEN || undefined, password: GATEWAY_PASSWORD || undefined }
    : undefined

  const signedAtMs = Date.now()
  const role = 'operator'
  const scopes = ['operator.admin']
  const payload = buildDeviceAuthPayload({
    deviceId: deviceIdentity.deviceId,
    clientId: 'gateway-client',
    clientMode: 'backend',
    role,
    scopes,
    signedAtMs,
    token: GATEWAY_TOKEN || null,
    nonce: nonce || null,
  })
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(deviceIdentity.privateKeyPem))

  return {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: 'gateway-client',
      displayName: 'AI Hub API',
      version: '0.1.0',
      platform: process.platform,
      mode: 'backend',
    },
    role,
    scopes,
    auth,
    caps: [],
    device: {
      id: deviceIdentity.deviceId,
      publicKey: publicKeyRawBase64UrlFromPem(deviceIdentity.publicKeyPem),
      signature: b64UrlEncode(signature),
      signedAt: signedAtMs,
      nonce: nonce || undefined,
    },
  }
}

function sendRawRequest(method, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('gateway not connected'))
      return
    }

    const id = randomUUID()
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`gateway timeout: ${method}`))
    }, timeoutMs)

    pending.set(id, { resolve, reject, timer, method })
    ws.send(JSON.stringify({ type: 'req', id, method, params }))
  })
}

function sendConnect(nonce = null) {
  if (!ws || ws.readyState !== WebSocket.OPEN || connectSent) return
  connectSent = true
  sendRawRequest('connect', buildConnectParams(nonce), 10_000).catch(() => {})
}

function connect() {
  if (ws) return

  const wsUrl = (() => {
    if (!GATEWAY_TOKEN) return GATEWAY_URL
    try {
      const u = new URL(GATEWAY_URL)
      if (!u.searchParams.get('token')) u.searchParams.set('token', GATEWAY_TOKEN)
      return u.toString()
    } catch {
      return GATEWAY_URL
    }
  })()

  ws = new WebSocket(wsUrl, {
    maxPayload: 25 * 1024 * 1024,
    headers: GATEWAY_TOKEN ? { Authorization: `Bearer ${GATEWAY_TOKEN}` } : {},
  })

  ws.on('open', () => {
    connectSent = false
    sendConnect()
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())

      if (msg?.type === 'event') {
        if (msg.event === 'connect.challenge') {
          const nonce = typeof msg?.payload?.nonce === 'string' ? msg.payload.nonce : null
          connectSent = false
          sendConnect(nonce)
          return
        }

        if (msg.event === 'tick') {
          lastTick = Date.now()
        }
        return
      }

      if (msg?.type !== 'res' || !msg.id) return

      const p = pending.get(msg.id)
      if (!p) return
      clearTimeout(p.timer)
      pending.delete(msg.id)

      if (msg.ok) {
        if (!connected && p.method === 'connect') {
          connected = true
          lastTick = Date.now()
          if (tickTimer) clearInterval(tickTimer)
          tickTimer = setInterval(() => {
            if (!ws || ws.readyState !== WebSocket.OPEN || !lastTick) return
            if (Date.now() - lastTick > 65_000) {
              try { ws.close(4000, 'tick timeout') } catch {}
            }
          }, 30_000)
          console.log('[gateway-client] connected to', wsUrl)
        }
        p.resolve(msg.payload)
      } else {
        p.reject(new Error(msg?.error?.message || 'gateway request failed'))
      }
    } catch {}
  })

  ws.on('close', (code, reason) => {
    connected = false
    ws = null
    connectSent = false
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
    cleanupPending('gateway disconnected')
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 3000)
    console.log('[gateway-client] disconnected', code, reason?.toString?.() || '', 'reconnecting in 3s...')
  })

  ws.on('error', (err) => {
    console.error('[gateway-client] error:', err.message)
    try { ws?.close() } catch {}
  })
}

export function callGateway(method, params = {}, timeoutMs = 10000) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('gateway not connected'))
  }
  if (!connected && method !== 'connect') {
    return Promise.reject(new Error('gateway handshake not completed'))
  }
  return sendRawRequest(method, params, timeoutMs)
}

// Auto-connect on import
connect()

export default { callGateway, isConnected }
