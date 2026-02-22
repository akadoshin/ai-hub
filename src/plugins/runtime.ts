import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ClientPanelModule,
  PanelComponentMap,
  PanelPluginMeta,
  ServerPanelPlugin,
} from './types'

const MODULE_LOADERS = import.meta.glob('../../plugins/*/client/index.{ts,tsx,js,jsx}') as Record<string, () => Promise<unknown>>

function normalizeClientEntry(entryClient: string): string {
  return entryClient.replace(/^\.\//, '')
}

function findLoaderForPlugin(plugin: ServerPanelPlugin): (() => Promise<unknown>) | null {
  const entryClient = normalizeClientEntry(plugin.entryClient)
  const suffix = `/plugins/${plugin.id}/${entryClient}`

  for (const [key, loader] of Object.entries(MODULE_LOADERS)) {
    if (key.endsWith(suffix)) return loader
  }

  return null
}

function toPanelMeta(plugin: ServerPanelPlugin): PanelPluginMeta {
  return {
    id: plugin.id,
    label: plugin.panel.title,
    hint: plugin.panel.hint || '',
    color: plugin.panel.color || '#94a3b8',
    shortcut: plugin.panel.shortcut || '',
    icon: plugin.panel.icon || 'panel',
    order: Number.isFinite(plugin.panel.order) ? Number(plugin.panel.order) : 100,
  }
}

function pickComponent(moduleExports: unknown) {
  const mod = moduleExports as ClientPanelModule

  if (typeof mod?.registerPanel === 'function') {
    const registered = mod.registerPanel()
    if (typeof registered?.component === 'function') return registered.component
  }

  if (typeof mod?.Panel === 'function') return mod.Panel
  if (typeof mod?.default === 'function') return mod.default
  return null
}

export function usePanelPlugins() {
  const [panels, setPanels] = useState<PanelPluginMeta[]>([])
  const [panelComponents, setPanelComponents] = useState<PanelComponentMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/plugins')
      const payload = (await response.json().catch(() => [])) as ServerPanelPlugin[]
      if (!response.ok) {
        throw new Error(`failed loading plugins: ${response.status}`)
      }

      const sorted = [...payload].sort((a, b) => {
        const orderA = Number.isFinite(a.panel.order) ? Number(a.panel.order) : Number.POSITIVE_INFINITY
        const orderB = Number.isFinite(b.panel.order) ? Number(b.panel.order) : Number.POSITIVE_INFINITY
        if (orderA !== orderB) return orderA - orderB
        return a.id.localeCompare(b.id)
      })

      const loadedMeta: PanelPluginMeta[] = []
      const loadedComponents: PanelComponentMap = {}

      for (const plugin of sorted) {
        const loader = findLoaderForPlugin(plugin)
        if (!loader) {
          console.warn(`[plugins] missing client module loader for '${plugin.id}' (${plugin.entryClient})`)
          continue
        }

        const moduleExports = await loader()
        const component = pickComponent(moduleExports)
        if (!component) {
          console.warn(`[plugins] plugin '${plugin.id}' has no valid panel component export`)
          continue
        }

        loadedMeta.push(toPanelMeta(plugin))
        loadedComponents[plugin.id] = component
      }

      setPanels(loadedMeta)
      setPanelComponents(loadedComponents)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      setPanels([])
      setPanelComponents({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlugins()
    const timer = window.setInterval(() => {
      void loadPlugins()
    }, 10000)
    return () => window.clearInterval(timer)
  }, [loadPlugins])

  const panelIds = useMemo(() => new Set(panels.map(p => p.id)), [panels])

  return {
    panels,
    panelComponents,
    loading,
    error,
    panelIds,
    reload: loadPlugins,
  }
}
