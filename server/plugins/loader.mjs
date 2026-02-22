import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

const DEFAULT_CONFIG = {
  enabled: [],
  disabled: [],
  order: [],
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function assertFile(filePath) {
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error(`not a file: ${filePath}`)
}

function resolveInside(baseDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim()) {
    throw new Error('entry path must be a non-empty string')
  }

  const abs = path.resolve(baseDir, relativePath)
  const rel = path.relative(baseDir, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`entry path escapes plugin directory: ${relativePath}`)
  }

  return { abs, rel }
}

function normalizePanel(panel, pluginId) {
  if (!isPlainObject(panel)) {
    throw new Error(`plugin ${pluginId}: panel metadata is required for kind=panel`)
  }

  const title = typeof panel.title === 'string' ? panel.title.trim() : ''
  if (!title) throw new Error(`plugin ${pluginId}: panel.title is required`)

  return {
    title,
    hint: typeof panel.hint === 'string' ? panel.hint : '',
    color: typeof panel.color === 'string' && panel.color.trim() ? panel.color : '#94a3b8',
    shortcut: typeof panel.shortcut === 'string' ? panel.shortcut : '',
    icon: typeof panel.icon === 'string' ? panel.icon : 'panel',
    order: Number.isFinite(panel.order) ? Number(panel.order) : 100,
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

async function normalizeManifest(pluginDir, manifestRaw) {
  if (!isPlainObject(manifestRaw)) {
    throw new Error(`invalid manifest at ${pluginDir}`)
  }

  const id = typeof manifestRaw.id === 'string' ? manifestRaw.id.trim() : ''
  const name = typeof manifestRaw.name === 'string' ? manifestRaw.name.trim() : ''
  const version = typeof manifestRaw.version === 'string' ? manifestRaw.version.trim() : '0.0.0'
  const kind = typeof manifestRaw.kind === 'string' ? manifestRaw.kind.trim() : ''

  if (!id) throw new Error('manifest.id is required')
  if (!name) throw new Error(`plugin ${id}: manifest.name is required`)
  if (kind !== 'panel') throw new Error(`plugin ${id}: unsupported kind '${kind}'`)

  const clientEntry = resolveInside(pluginDir, manifestRaw.entryClient)
  await assertFile(clientEntry.abs)

  let serverEntry = null
  if (manifestRaw.entryServer) {
    serverEntry = resolveInside(pluginDir, manifestRaw.entryServer)
    await assertFile(serverEntry.abs)
  }

  return {
    id,
    name,
    version,
    kind,
    pluginDir,
    panel: normalizePanel(manifestRaw.panel, id),
    permissions: {
      network: Boolean(manifestRaw.permissions?.network),
      fs: Boolean(manifestRaw.permissions?.fs),
    },
    entryClientAbs: clientEntry.abs,
    entryClientRel: toPosixPath(clientEntry.rel),
    entryServerAbs: serverEntry?.abs || null,
    entryServerRel: serverEntry?.rel ? toPosixPath(serverEntry.rel) : null,
  }
}

function sortPlugins(plugins, order) {
  const orderMap = new Map(order.map((id, idx) => [id, idx]))
  return [...plugins].sort((a, b) => {
    const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Number.POSITIVE_INFINITY
    const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Number.POSITIVE_INFINITY
    if (orderA !== orderB) return orderA - orderB

    const panelOrderA = Number.isFinite(a.panel.order) ? a.panel.order : Number.POSITIVE_INFINITY
    const panelOrderB = Number.isFinite(b.panel.order) ? b.panel.order : Number.POSITIVE_INFINITY
    if (panelOrderA !== panelOrderB) return panelOrderA - panelOrderB

    return a.id.localeCompare(b.id)
  })
}

export async function discoverPlugins({ rootDir = process.cwd(), logger = console } = {}) {
  const pluginsDir = path.join(rootDir, 'plugins')
  const configPath = path.join(rootDir, 'config', 'plugins.json')

  const configRaw = await readJson(configPath, DEFAULT_CONFIG)
  const config = {
    enabled: ensureArray(configRaw?.enabled).filter(v => typeof v === 'string'),
    disabled: ensureArray(configRaw?.disabled).filter(v => typeof v === 'string'),
    order: ensureArray(configRaw?.order).filter(v => typeof v === 'string'),
  }

  const enabledSet = new Set(config.enabled)
  const disabledSet = new Set(config.disabled)

  let entries = []
  try {
    entries = await fs.readdir(pluginsDir, { withFileTypes: true })
  } catch {
    logger.warn?.(`[plugins] plugins dir not found at ${pluginsDir}`)
    return { plugins: [], config, pluginsDir, configPath }
  }

  const discovered = []
  const errors = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const pluginDir = path.join(pluginsDir, entry.name)
    const manifestPath = path.join(pluginDir, 'plugin.json')
    const manifestRaw = await readJson(manifestPath, null)

    if (!manifestRaw) {
      errors.push(`missing or invalid plugin.json in ${entry.name}`)
      continue
    }

    try {
      const plugin = await normalizeManifest(pluginDir, manifestRaw)
      discovered.push(plugin)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${entry.name}: ${message}`)
    }
  }

  const discoveredIds = new Set(discovered.map(p => p.id))
  for (const id of enabledSet) {
    if (!discoveredIds.has(id)) {
      errors.push(`enabled plugin '${id}' not found in plugins directory`)
    }
  }

  let plugins = discovered.filter(plugin => {
    if (disabledSet.has(plugin.id)) return false
    if (enabledSet.size > 0 && !enabledSet.has(plugin.id)) return false
    return true
  })

  plugins = sortPlugins(plugins, config.order)

  for (const error of errors) {
    logger.warn?.(`[plugins] ${error}`)
  }

  return {
    plugins,
    config,
    pluginsDir,
    configPath,
  }
}

function pickRegisterFn(moduleExports) {
  if (typeof moduleExports?.register === 'function') return moduleExports.register
  if (typeof moduleExports?.default === 'function') return moduleExports.default
  if (typeof moduleExports?.default?.register === 'function') return moduleExports.default.register
  return null
}

export async function registerPluginServers({ plugins, app, context = {}, logger = console }) {
  for (const plugin of plugins) {
    if (!plugin.entryServerAbs) continue

    try {
      const mod = await import(pathToFileURL(plugin.entryServerAbs).href)
      const register = pickRegisterFn(mod)
      if (!register) {
        logger.warn?.(`[plugins] ${plugin.id}: server entry has no register function`)
        continue
      }
      await register(app, { ...context, plugin })
      logger.info?.(`[plugins] loaded server plugin '${plugin.id}'`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn?.(`[plugins] failed loading server plugin '${plugin.id}': ${message}`)
    }
  }
}

export function buildPanelCatalog(plugins) {
  return plugins
    .filter(p => p.kind === 'panel')
    .map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      kind: p.kind,
      entryClient: p.entryClientRel,
      panel: p.panel,
      permissions: p.permissions,
    }))
}
