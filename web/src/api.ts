// --- Types for Change Notes System ---

export type ChangeType = 'annotation' | 'draft' | 'correction' | 'idea'

export type ChangeStatus = 'pending' | 'reviewed' | 'applied' | 'rejected'

export interface ChangeTarget {
  docPath: string
  section?: string
  elementType?: string      // 'h2' | 'h3' | 'p'
  elementText?: string      // 该元素文本的前 60 字（用于稳定定位）
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
  targetKey: string          // 稳定定位键：docPath|tag|textExcerpt
}

// --- 导出格式（批量下载时的外层容器） ---
export interface ChangeNoteBundle {
  version: 1
  exportedAt: string
  count: number
  notes: ChangeNote[]
}

// --- Helpers ---

export function generateId(): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  // 时间戳后四位 + 三位随机，保证同秒多条不会冲突
  const timeTail = now.getTime().toString().slice(-4)
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `CHG-${dateStr}-${timeTail}${seq}`
}

/**
 * 稳定的目标元素定位键：docPath | tag | 元素文本前 60 字
 * 同一段落在同一文档下，无论重新渲染多少次 key 都不变。
 */
export function computeTargetKey(
  docPath: string,
  element: HTMLElement,
): string {
  const tag = (element.tagName || '').toLowerCase()
  const text = (element.textContent || '').trim().slice(0, 60)
  return `${docPath}|${tag}|${text}`
}

/** 给缺少 targetKey 的旧记录回填（从已有字段推导） */
export function ensureTargetKey(note: ChangeNote): ChangeNote {
  if (note.targetKey) return note
  const tag = note.target?.elementType || ''
  const text = note.target?.elementText || note.target?.section || ''
  note.targetKey = `${note.target?.docPath || ''}|${tag}|${text.slice(0, 60)}`
  return note
}

/** 单条下载（保留旧 API，用于用户明确要求下载单条） */
export function downloadChangeNote(change: ChangeNote): void {
  const json = JSON.stringify(ensureTargetKey(change), null, 2)
  triggerDownload(json, `${change.id}.json`, 'application/json')
}

/** 批量下载：打包成单一 JSON 文件 —— 不再分别弹窗，浏览器友好 */
export function downloadAllChanges(changes: ChangeNote[]): void {
  if (!changes || changes.length === 0) return
  const safeNotes = changes.map(ensureTargetKey)
  const bundle: ChangeNoteBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: safeNotes.length,
    notes: safeNotes,
  }
  const json = JSON.stringify(bundle, null, 2)
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  triggerDownload(json, `change-notes-${stamp}.json`, 'application/json')
}

/** 通过用户选择文件导入一批变更记录（支持 bundle 或旧的单条 JSON） */
export function importChangeNotesFromFile(file: File): Promise<ChangeNote[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || '{}'))
        const notes: ChangeNote[] = raw?.notes
          ? (raw as ChangeNoteBundle).notes
          : isSingleNote(raw)
            ? [raw as ChangeNote]
            : []
        // 给每条记录确保有 targetKey
        resolve(notes.filter(Boolean).map(ensureTargetKey))
      } catch (e) {
        reject(new Error('JSON 解析失败 —— 文件格式不合法'))
      }
    }
    reader.readAsText(file)
  })
}

/** 从一段 JSON 文本（粘贴）解析为 Note[] */
export function importChangeNotesFromText(text: string): ChangeNote[] {
  const raw = JSON.parse(text)
  const list: ChangeNote[] = Array.isArray(raw)
    ? raw
    : raw?.notes
      ? (raw as ChangeNoteBundle).notes
      : isSingleNote(raw)
        ? [raw as ChangeNote]
        : []
  return list.map(ensureTargetKey)
}

// --- 内部工具 ---

function triggerDownload(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟释放——给浏览器下载留一点时间
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

function isSingleNote(raw: any): boolean {
  return raw
    && typeof raw === 'object'
    && typeof raw.id === 'string'
    && typeof raw.type === 'string'
    && raw.content
}
