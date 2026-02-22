import { create } from 'zustand'
import type { MeshyTask } from './meshy'
import { createTextTo3D, pollTask, listTasks, proxyAssetUrl } from './meshy'

interface MeshyState {
  tasks: MeshyTask[]
  generating: boolean
  error: string | null
  selectedModel: MeshyTask | null

  generate: (prompt: string, artStyle?: string) => Promise<void>
  fetchHistory: () => Promise<void>
  selectModel: (task: MeshyTask | null) => void
  clearError: () => void
}

export const useMeshyStore = create<MeshyState>((set) => ({
  tasks: [],
  generating: false,
  error: null,
  selectedModel: null,

  generate: async (prompt, artStyle = 'pbr') => {
    set({ generating: true, error: null })
    try {
      const taskId = await createTextTo3D({
        prompt,
        art_style: artStyle as 'pbr' | 'realistic' | 'cartoon' | 'low-poly' | 'sculpture',
        should_texture: true,
        should_remesh: true,
      })

      // Add pending task immediately
      const pending: MeshyTask = {
        id: taskId,
        status: 'PENDING',
        progress: 0,
        prompt,
        created_at: Date.now(),
      }
      set(s => ({ tasks: [pending, ...s.tasks] }))

      // Poll until done
      const completed = await pollTask(taskId, (task) => {
        set(s => ({
          tasks: s.tasks.map(t => t.id === taskId ? task : t),
        }))
      })

      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? completed : t),
        generating: false,
        selectedModel: completed,
      }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ generating: false, error: msg })
    }
  },

  fetchHistory: async () => {
    try {
      const tasks = (await listTasks()).map(t => ({
        ...t,
        model_urls: t.model_urls ? {
          ...t.model_urls,
          glb: t.model_urls.glb ? proxyAssetUrl(t.model_urls.glb) : undefined,
        } : undefined,
      }))
      set({ tasks })
    } catch {
      // silently fail on history fetch
    }
  },

  selectModel: (task) => set({ selectedModel: task }),
  clearError: () => set({ error: null }),
}))
