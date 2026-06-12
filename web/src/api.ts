// --- Types for Change Notes System ---

export type ChangeType = 'annotation' | 'draft' | 'correction' | 'idea'

export type ChangeStatus = 'pending' | 'reviewed' | 'applied' | 'rejected'

export interface ChangeTarget {
  docPath: string
  section?: string
}

export interface ChangeContent {
  summary: string
  body: string
  tags: string[]
}

export interface ChangeNote {
  id: string
  type: ChangeType
  author: string
  timestamp: string
  target: ChangeTarget
  content: ChangeContent
  status: ChangeStatus
}

export function generateId(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CHG-${dateStr}-${seq}`
}

export function downloadChangeNote(change: ChangeNote): void {
  const json = JSON.stringify(change, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${change.id}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadAllChanges(changes: ChangeNote[]): void {
  // 批量下载：逐个触发下载
  changes.forEach(c => {
    if (c.status === 'pending') {
      setTimeout(() => downloadChangeNote(c), 100)
    }
  })
}
