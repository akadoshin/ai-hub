const API_KEY = import.meta.env.VITE_MESHY_API_KEY || 'msy_mIsdA4RZoWvvkRSIE6b4zegEDFt1rODXalKF'
const BASE = '/meshy-api/openapi/v2'

/** Rewrite Meshy asset URLs to go through our CORS proxy */
export function proxyAssetUrl(url: string): string {
  if (!url) return url
  return url.replace('https://assets.meshy.ai', '/meshy-assets')
}

export type MeshyStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'

export interface MeshyTask {
  id: string
  status: MeshyStatus
  progress: number
  prompt?: string
  model_urls?: {
    glb?: string
    fbx?: string
    usdz?: string
    obj?: string
    mtl?: string
  }
  thumbnail_url?: string
  created_at: number
  started_at?: number
  finished_at?: number
  error_message?: string
}

const headers = () => ({
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
})

export async function createTextTo3D(params: {
  prompt: string
  negative_prompt?: string
  art_style?: 'realistic' | 'cartoon' | 'low-poly' | 'sculpture' | 'pbr'
  topology?: 'quad' | 'triangle'
  target_polycount?: number
  should_remesh?: boolean
  should_texture?: boolean
  texture_richness?: 'low' | 'medium' | 'high'
}): Promise<string> {
  const res = await fetch(`${BASE}/text-to-3d`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      mode: 'preview',
      prompt: params.prompt,
      negative_prompt: params.negative_prompt || 'low quality, blurry',
      art_style: params.art_style || 'pbr',
      should_remesh: params.should_remesh ?? true,
      should_texture: params.should_texture ?? true,
    }),
  })
  if (!res.ok) throw new Error(`Meshy error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.result // task id
}

export async function refineTextTo3D(previewTaskId: string): Promise<string> {
  const res = await fetch(`${BASE}/text-to-3d`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ mode: 'refine', preview_task_id: previewTaskId }),
  })
  if (!res.ok) throw new Error(`Meshy refine error: ${res.status}`)
  const data = await res.json()
  return data.result
}

export async function getTask(taskId: string): Promise<MeshyTask> {
  const res = await fetch(`${BASE}/text-to-3d/${taskId}`, { headers: headers() })
  if (!res.ok) throw new Error(`Meshy get task error: ${res.status}`)
  return res.json()
}

export async function listTasks(): Promise<MeshyTask[]> {
  const res = await fetch(`${BASE}/text-to-3d?page_num=1&page_size=20&sort_by=-created_at`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Meshy list error: ${res.status}`)
  return res.json()
}

/** Poll a task until done or failed. Calls onProgress(0-100) each tick. */
export async function pollTask(
  taskId: string,
  onProgress?: (task: MeshyTask) => void,
  intervalMs = 3000,
  maxWaitMs = 600000
): Promise<MeshyTask> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const task = await getTask(taskId)
    onProgress?.(task)
    if (task.status === 'SUCCEEDED') return task
    if (task.status === 'FAILED' || task.status === 'EXPIRED')
      throw new Error(`Task ${taskId} ${task.status}: ${task.error_message}`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error('Task timed out')
}
