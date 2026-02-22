import type { ComponentType } from 'react'

export interface ServerPanelPlugin {
  id: string
  name: string
  version: string
  kind: 'panel'
  entryClient: string
  panel: {
    title: string
    hint?: string
    color?: string
    shortcut?: string
    icon?: string
    order?: number
  }
  permissions?: {
    network?: boolean
    fs?: boolean
  }
}

export interface PanelPluginMeta {
  id: string
  label: string
  hint: string
  color: string
  shortcut: string
  icon: string
  order: number
}

export type PanelPluginComponent = ComponentType
export type PanelComponentMap = Record<string, PanelPluginComponent>

export interface ClientPanelRegistration {
  component: PanelPluginComponent
}

export interface ClientPanelModule {
  registerPanel?: () => ClientPanelRegistration
  Panel?: PanelPluginComponent
  default?: PanelPluginComponent
}
