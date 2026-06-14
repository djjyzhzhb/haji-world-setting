// --- Types for Change Notes System ---

export type ChangeType = 'annotation' | 'draft' | 'correction' | 'idea'

export type ChangeStatus = 'pending' | 'reviewed' | 'applied' | 'rejected'

export interface ChangeTarget {
  docPath: string
  section?: string
  elementType?: string      // 'h1' | 'h2' | 'h3' | 'p'
  elementText?: string      // 该元素文本的前 60 字（用于稳定定位）
  elementIndex?: string     // 同级同类元素中的序号，如 "h2#3"
  breadcrumb?: string       // 层级路径，如 "01_地理 > 05_大陆A > 区域A1"
}

export type ChangePriority = 'low' | 'medium' | 'high' | 'critical'

export interface ChangeContent {
  summary: string
  body: string
  tags: string[]
  priority?: ChangePriority
  reference?: string        // 引用来源（其他文档、外部链接等）
  relatedDocs?: string[]    // 关联文档路径列表
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
  contentFingerprint?: string // 创建时段落文本的指纹（用于检测段落内容是否变更）
}

// --- 导出格式（批量下载时的外层容器） ---
export interface ChangeNoteBundle {
  version: 1
  exportedAt: string
  source: string       // 导出者名字，用于多来源存档识别
  count: number
  notes: ChangeNote[]
}

// 可标注元素的选择器（全项目统一使用此常量，修改一处即可扩展标注范围）
export const ANNOTATABLE_SELECTOR = 'h1, h2, h3, p'

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
 * 稳定的目标元素定位键：docPath | tag | 元素文本前 N 字
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

/** 段落文本指纹：取文本内容的前 120 字做简单 hash，用于检测段落是否被编辑过 */
export function computeContentFingerprint(element: HTMLElement): string {
  const text = (element.textContent || '').trim().slice(0, 120)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

/** 给缺少 targetKey 的旧记录回填（从已有字段推导） */
export function ensureTargetKey(note: ChangeNote): ChangeNote {
  if (note.targetKey) return note
  const tag = note.target?.elementType || ''
  const text = note.target?.elementText || note.target?.section || ''
  note.targetKey = `${note.target?.docPath || ''}|${tag}|${text.slice(0, 60)}`
  return note
}

/**
 * 判定一条 note 是否应当绑定到某个元素：
 *   1) 精确匹配 targetKey（首选）
 *   2) tag + 文本包含（双向）
 *   3) 同 docPath 且 note.elementIndex 与当前元素序号一致（文本变了但位置没变的场景）
 *   4) breadcrumb 层级路径匹配
 *   5) section（标题）兜底：仅对 h2/h3 生效
 *
 * 返回匹配分数（0 表示不匹配），便于在多个候选里挑最佳。
 */
export function scoreMatch(note: ChangeNote, docPath: string, element: HTMLElement): number {
  if (!note.target) return 0
  if (note.target.docPath !== docPath) return 0

  const tag = (element.tagName || '').toLowerCase()
  const elementText = (element.textContent || '').trim()

  // 1) 精确 key —— 最高置信度
  if (note.targetKey && note.targetKey === computeTargetKey(docPath, element)) {
    return 1000
  }

  // 2) tag + 文本包含（双向）
  const noteText = (note.target.elementText || note.target.section || '').trim()
  if (note.target.elementType && note.target.elementType === tag && noteText) {
    if (elementText.startsWith(noteText) || noteText.startsWith(elementText)) return 100
    if (elementText.includes(noteText) || noteText.includes(elementText.slice(0, 30))) return 60
  }

  // 3) elementIndex 匹配（文本已变但段落位置未变时兜底）
  if (note.target.elementIndex && note.target.elementType === tag) {
    const currentIndex = computeElementIndex(element)
    if (note.target.elementIndex === currentIndex) return 50
  }

  // 4) breadcrumb 匹配（同一层级路径内的段落）
  if (note.target.breadcrumb) {
    const container = element.closest('.content-body, .home-content') as HTMLElement | null
    if (container) {
      const currentBc = computeBreadcrumb(container, element)
      if (note.target.breadcrumb === currentBc) return 40
    }
  }

  // 5) section（标题）兜底：仅对 h2/h3 生效
  if ((tag === 'h2' || tag === 'h3') && note.target.section) {
    if (elementText === note.target.section) return 80
  }

  return 0
}

/** 在容器内为给定 note 找到最佳匹配元素（分数最高者） */
export function findElementForNote(
  container: HTMLElement,
  docPath: string,
  note: ChangeNote,
): HTMLElement | null {
  const candidates = container.querySelectorAll(ANNOTATABLE_SELECTOR) as NodeListOf<HTMLElement>
  let best: HTMLElement | null = null
  let bestScore = 0
  candidates.forEach(el => {
    const s = scoreMatch(note, docPath, el)
    if (s > bestScore) {
      bestScore = s
      best = el
    }
  })
  return best
}

/** 计算元素在同级同标签中的序号，如 "h2#3" */
export function computeElementIndex(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase()
  let index = 1
  let sibling: Element | null = element.previousElementSibling
  while (sibling) {
    if (sibling.tagName.toLowerCase() === tag) index++
    sibling = sibling.previousElementSibling
  }
  return `${tag}#${index}`
}

/**
 * 从容器内头部元素获取层级面包屑路径。
 * 收集目标元素之前的所有 h1/h2/h3 作为路径分段。
 */
export function computeBreadcrumb(container: HTMLElement, targetEl: HTMLElement): string {
  const parts: string[] = []
  const headings = container.querySelectorAll('h1, h2, h3')
  for (const h of headings) {
    if (h === targetEl) break
    parts.push((h.textContent || '').trim())
  }
  return parts.join(' > ')
}

/** 单条下载（保留旧 API，用于用户明确要求下载单条） */
export function downloadChangeNote(change: ChangeNote): void {
  const json = JSON.stringify(ensureTargetKey(change), null, 2)
  triggerDownload(json, `${change.id}.json`, 'application/json')
}

/** 批量下载：打包成单一 JSON 文件 —— 不再分别弹窗，浏览器友好 */
export function downloadAllChanges(changes: ChangeNote[], exportedBy?: string): void {
  if (!changes || changes.length === 0) return
  const safeNotes = changes.map(ensureTargetKey)
  const bundle: ChangeNoteBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: exportedBy || '匿名',
    count: safeNotes.length,
    notes: safeNotes,
  }
  const json = JSON.stringify(bundle, null, 2)
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  triggerDownload(json, `change-notes-${stamp}.json`, 'application/json')
}

/** 通过用户选择文件导入一批变更记录（支持 bundle 或旧的单条 JSON） */
export function importChangeNotesFromFile(file: File): Promise<{ notes: ChangeNote[]; source?: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || '{}'))
        const bundleSource = (raw as any)?.source || (raw as any)?.exportedBy
        const notes: ChangeNote[] = raw?.notes
          ? (raw as ChangeNoteBundle).notes
          : isSingleNote(raw)
            ? [raw as ChangeNote]
            : []
        resolve({ notes: notes.filter(Boolean).map(ensureTargetKey), source: bundleSource || undefined })
      } catch (e) {
        reject(new Error('文件解析失败 —— 文件格式不合法'))
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
