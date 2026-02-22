const API_ORIGIN = 'https://api.meshy.ai'
const ASSET_ORIGIN = 'https://assets.meshy.ai'

function copyRequestHeaders(req) {
  const out = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    const lower = key.toLowerCase()
    if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue
    out[key] = Array.isArray(value) ? value.join(',') : value
  }
  return out
}

function buildRequestBody(req, headers) {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return undefined

  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    return req.body
  }

  const hasJson = typeof req.body === 'object' && req.body !== null
  if (!hasJson) return undefined

  if (!headers['content-type']) {
    headers['content-type'] = 'application/json'
  }

  return JSON.stringify(req.body)
}

function copyResponseHeaders(proxyRes, res) {
  for (const [key, value] of proxyRes.headers.entries()) {
    const lower = key.toLowerCase()
    if (lower === 'transfer-encoding' || lower === 'connection' || lower === 'content-encoding') continue
    res.setHeader(key, value)
  }
}

async function proxy(req, res, targetBase, targetPrefix = '') {
  try {
    const targetUrl = `${targetBase}${targetPrefix}${req.url}`
    const headers = copyRequestHeaders(req)
    const body = buildRequestBody(req, headers)

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    })

    copyResponseHeaders(upstream, res)
    res.status(upstream.status)

    if ((req.method || 'GET').toUpperCase() === 'HEAD') {
      res.end()
      return
    }

    const data = await upstream.arrayBuffer()
    res.send(Buffer.from(data))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'proxy request failed'
    res.status(502).json({ error: message })
  }
}

export async function register(app) {
  app.use('/api/plugins/meshy/openapi/v2', (req, res) => {
    return proxy(req, res, API_ORIGIN, '/openapi/v2')
  })

  app.use('/api/plugins/meshy/assets', (req, res) => {
    return proxy(req, res, ASSET_ORIGIN)
  })
}
