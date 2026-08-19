import { supabase } from '../supabase'
import { markBackendAvailable, notifyApp, triggerRefresh } from '../hooks/useSupabase'

interface PendingMutation {
  id: string
  table: string
  type: 'insert' | 'update' | 'delete'
  data: Record<string, unknown>
  createdAt: number
}

const QUEUE_KEY = 'hpa_cabs_offline_queue'
const CACHE_PREFIX = 'hpa_cabs_cache_'
const offlineListeners = new Set<(state: { offline: boolean; pendingCount: number }) => void>()

function emitOfflineState() {
  const state = { offline: !navigator.onLine, pendingCount: getQueue().length }
  offlineListeners.forEach((listener) => listener(state))
}

export function subscribeOfflineState(listener: (state: { offline: boolean; pendingCount: number }) => void) {
  offlineListeners.add(listener)
  listener({ offline: !navigator.onLine, pendingCount: getQueue().length })
  return () => offlineListeners.delete(listener)
}

export function isOnline(): boolean {
  return navigator.onLine
}

function getQueue(): PendingMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: PendingMutation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function queueMutation(
  table: string,
  type: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>
) {
  const queue = getQueue()
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    table,
    type,
    data,
    createdAt: Date.now(),
  })
  saveQueue(queue)
  emitOfflineState()
}

export async function syncPendingMutations(): Promise<number> {
  const queue = getQueue()
  if (queue.length === 0) return 0

  let synced = 0
  const remaining: PendingMutation[] = []

  for (const mutation of queue) {
    try {
      if (mutation.type === 'insert') {
        const { error } = await supabase.from(mutation.table).insert(mutation.data)
        if (error) throw error
      } else if (mutation.type === 'update') {
        const { id, ...updates } = mutation.data
        const { error } = await supabase.from(mutation.table).update(updates).eq('id', id)
        if (error) throw error
      } else if (mutation.type === 'delete') {
        const { error } = await supabase.from(mutation.table).delete().eq('id', mutation.data.id)
        if (error) throw error
      }
      synced++
    } catch {
      remaining.push(mutation)
    }
  }

  saveQueue(remaining)
  emitOfflineState()
  if (synced > 0) triggerRefresh()
  if (remaining.length > 0) {
    notifyApp('error', 'Some offline changes could not sync yet. They remain queued for another attempt.')
  } else if (synced > 0) {
    notifyApp('success', 'Offline changes synced successfully.')
  }
  return synced
}

export function cacheData(key: string, data: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }))
  } catch {
    // Storage full — ignore
  }
}

export function getCachedData<T>(key: string, maxAgeMs = 1000 * 60 * 60): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.timestamp > maxAgeMs) return null
    return parsed.data as T
  } catch {
    return null
  }
}

export function getPendingCount(): number {
  return getQueue().length
}

export function setupOfflineSync() {
  window.addEventListener('online', async () => {
    emitOfflineState()
    markBackendAvailable()
    const synced = await syncPendingMutations()
    if (synced > 0) {
      console.log(`Synced ${synced} offline changes`)
    }
  })
  window.addEventListener('offline', () => emitOfflineState())
}
