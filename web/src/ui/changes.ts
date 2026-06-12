import type { ChangeNote, ChangeType, ChangeStatus } from '../api'
import {
  generateId,
  downloadChangeNote,
  downloadAllChanges,
  importChangeNotesFromFile,
  computeTargetKey,
  ensureTargetKey,
} from '../api'

const STORAGE_KEY = 'app.changeNotes.v1'

// --- Session state ---
let changes: ChangeNote[] = loadFromStorage().map(ensureTargetKey)
let currentDocPath: string | null = null
let currentSection: string | null = null
let currentTargetEl: HTMLElement | null = null   // 当前 hover 的文本元素
let currentTargetKey: string | null = null      // 对应计算出的 key
let badgeContainer: HTMLElement | null = null   // 最近一次渲染角标的容器
let badgeDocPath: string = ''                   // 最近一次的 docPath

// 可选筛选条件
let filterText = ''
let filterStatus: 'all' | ChangeStatus = 'all'

// --- DOM elements ---
let annotateBtn: HTMLElement
let annotatePanel: HTMLElement
let changesPanel: HTMLElement
let changesToggle: HTMLElement
let changesCount: HTMLElement
let changesList: HTMLElement
let changesImportInput: HTMLInputElement | null = null

// --- Type labels ---
const typeLabels: Record<ChangeType, string> = {
  annotation: '标注',
  draft: '草稿',
  correction: '修正',
  idea: '灵感',
}

const statusLabels: Record<ChangeStatus, string> = {
  pending: '待处理',
  reviewed: '已审阅',
  applied: '已应用',
  rejected: '已忽略',
}

// --- Initialize ---
export function initChangesSystem(): void {
  // Create floating annotate button
  annotateBtn = document.createElement('div')
  annotateBtn.className = 'annotate-btn'
  annotateBtn.innerHTML = '+'
  annotateBtn.title = '添加标注'
  annotateBtn.addEventListener('click', openAnnotatePanel)
  document.body.appendChild(annotateBtn)

  // Create annotate panel (modal)
  annotatePanel = document.createElement('div')
  annotatePanel.className = 'annotate-panel'
  annotatePanel.innerHTML = `
    <div class="annotate-panel-overlay"></div>
    <div class="annotate-panel-card">
      <div class="annotate-panel-header">
        <h3>添加标注</h3>
        <button class="annotate-panel-close" id="annotate-close">&times;</button>
      </div>
      <div class="annotate-panel-body">
        <div class="annotate-field">
          <label>类型</label>
          <select id="annotate-type">
            <option value="annotation">标注</option>
            <option value="draft">草稿/灵感片段</option>
            <option value="correction">修正建议</option>
            <option value="idea">灵感笔记</option>
          </select>
        </div>
        <div class="annotate-field">
          <label>目标文档</label>
          <input type="text" id="annotate-doc" readonly />
        </div>
        <div class="annotate-field">
          <label>标题</label>
          <input type="text" id="annotate-summary" placeholder="简短描述..." />
        </div>
        <div class="annotate-field">
          <label>内容</label>
          <textarea id="annotate-body" rows="5" placeholder="详细内容..."></textarea>
        </div>
        <div class="annotate-field">
          <label>标签（逗号分隔）</label>
          <input type="text" id="annotate-tags" placeholder="颜色, 认知, 语言" />
        </div>
      </div>
      <div class="annotate-panel-footer">
        <button class="btn btn-secondary" id="annotate-cancel">取消</button>
        <button class="btn btn-primary" id="annotate-save">保存到变更记录</button>
      </div>
    </div>
  `
  document.body.appendChild(annotatePanel)

  // Create changes panel (right sidebar) —— 新增搜索 / 导入 / 状态筛选
  changesPanel = document.createElement('div')
  changesPanel.className = 'changes-panel'
  changesPanel.innerHTML = `
    <div class="changes-panel-header">
      <h3>变更记录</h3>
      <button class="changes-panel-close" id="changes-close">&times;</button>
    </div>
    <div class="changes-panel-toolbar">
      <input type="text" class="panel-search-input" placeholder="搜索标题 / 文档 / 标签..." />
      <select class="panel-status-select">
        <option value="all">全部状态</option>
        <option value="pending">待处理</option>
        <option value="reviewed">已审阅</option>
        <option value="applied">已应用</option>
        <option value="rejected">已忽略</option>
      </select>
    </div>
    <div class="changes-panel-body" id="changes-list">
      <div class="changes-empty">暂无变更记录</div>
    </div>
    <div class="changes-panel-footer">
      <button class="btn btn-secondary btn-sm" id="changes-import-btn">导入 JSON</button>
      <button class="btn btn-secondary btn-sm" id="changes-clear">清空</button>
      <button class="btn btn-primary btn-sm" id="changes-download-all">批量下载 (0 条)</button>
      <input type="file" id="changes-import-input" accept="application/json" multiple style="display:none;" />
    </div>
  `
  document.body.appendChild(changesPanel)

  // Create changes toggle button (fixed bottom-right)
  changesToggle = document.createElement('div')
  changesToggle.className = 'changes-toggle'
  changesToggle.title = '查看变更记录'
  changesCount = document.createElement('span')
  changesCount.className = 'changes-count'
  changesCount.textContent = '0'
  changesToggle.appendChild(changesCount)
  changesToggle.addEventListener('click', toggleChangesPanel)
  document.body.appendChild(changesToggle)

  // --- Event bindings ---
  document.getElementById('annotate-close')!.addEventListener('click', closeAnnotatePanel)
  document.getElementById('annotate-cancel')!.addEventListener('click', closeAnnotatePanel)
  document.getElementById('changes-close')!.addEventListener('click', closeChangesPanel)
  document.getElementById('annotate-save')!.addEventListener('click', saveAnnotate)

  // 批量下载（打包为单一 JSON 文件）
  document.getElementById('changes-download-all')!.addEventListener('click', () => {
    downloadAllChanges(changes)
  })

  // 清空记录
  document.getElementById('changes-clear')!.addEventListener('click', () => {
    if (!changes.length) return
    if (confirm(`确认清空全部 ${changes.length} 条变更记录？（不可恢复）`)) {
      changes = []
      persistAndRefresh()
    }
  })

  // 搜索 / 筛选 —— 直接在面板上查元素，查不到就明确报错（避免可选链静默死掉）
  const searchInput = changesPanel.querySelector('.panel-search-input') as HTMLInputElement | null
  const statusSelect = changesPanel.querySelector('.panel-status-select') as HTMLSelectElement | null
  if (!searchInput) throw new Error('[changes.ts] 未找到 .panel-search-input')
  if (!statusSelect) throw new Error('[changes.ts] 未找到 .panel-status-select')
  searchInput.addEventListener('input', () => {
    filterText = searchInput.value.trim().toLowerCase()
    updateChangesList()
  })
  statusSelect.addEventListener('change', () => {
    filterStatus = statusSelect.value as 'all' | ChangeStatus
    updateChangesList()
  })

  // 导入 JSON（支持多文件、bundle、单条记录）
  changesImportInput = document.getElementById('changes-import-input') as HTMLInputElement
  document.getElementById('changes-import-btn')!.addEventListener('click', () => {
    changesImportInput?.click()
  })
  changesImportInput?.addEventListener('change', async () => {
    if (!changesImportInput?.files || !changesImportInput.files.length) return
    let imported = 0
    let skipped = 0
    const existingIds = new Set(changes.map(c => c.id))
    for (const file of Array.from(changesImportInput.files)) {
      try {
        const notes = await importChangeNotesFromFile(file)
        for (const note of notes) {
          if (note.id && existingIds.has(note.id)) {
            skipped++
            continue
          }
          // 导入的记录若缺少字段则补默认值
          changes.push({
            id: note.id || generateId(),
            type: note.type || 'annotation',
            author: note.author || 'imported',
            timestamp: note.timestamp || new Date().toISOString(),
            target: note.target || { docPath: '' },
            content: note.content || { summary: '(无标题)', body: '', tags: [] },
            status: note.status || 'pending',
          })
          imported++
        }
      } catch (e: any) {
        alert(`文件 ${file.name} 导入失败: ${e?.message || e}`)
      }
    }
    changesImportInput.value = ''
    persistAndRefresh()
    if (imported || skipped) {
      alert(`导入完成：新增 ${imported} 条，跳过重复 ${skipped} 条`)
    }
  })

  // Close panels on overlay click
  annotatePanel.querySelector('.annotate-panel-overlay')!.addEventListener('click', closeAnnotatePanel)

  // 初次渲染
  changesList = document.getElementById('changes-list') as HTMLElement
  updateChangesList()
}

// --- 持久化 ---
function persistAndRefresh(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changes))
  } catch (e) {
    // storage 不可用（隐私模式等）——静默失败
  }
  updateChangesList()
  // 同步刷新当前可见内容的角标（如果有）
  if (badgeContainer && badgeDocPath) {
    scanAndRenderBadges(badgeContainer, badgeDocPath)
  }
}

function loadFromStorage(): ChangeNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ============================================================
// Annotate button visibility — 单一状态源
// ============================================================
//
// 设计原则：按钮只在以下条件之一满足时显示：
//   1. 指针（鼠标/笔）正处于某个文本区块（h2/h3/p）上
//   2. 指针正处于按钮自身上
//   3. 触屏用户"钉住"了某个文本区块（tap-to-stick）
//
// 其余任何情况 → 延迟一小段时间后淡出（给指针移动留出时间）
//
// 实现方式：在 contentArea 上用事件委托监听 pointerover/pointerout，
// 在按钮自身上监听 pointerenter/pointerleave。所有状态判断集中在这里。
// ============================================================

let hideTimeoutId: number | null = null
let stickModeEl: HTMLElement | null = null   // 触屏"钉住"模式当前锁定的元素

function clearHideTimer(): void {
  if (hideTimeoutId !== null) {
    clearTimeout(hideTimeoutId)
    hideTimeoutId = null
  }
}

function requestHide(delayMs: number = 250): void {
  clearHideTimer()
  hideTimeoutId = window.setTimeout(() => {
    annotateBtn.classList.remove('visible')
    hideTimeoutId = null
  }, delayMs)
}

function showNow(): void {
  clearHideTimer()
  annotateBtn.classList.add('visible')
}

// 计算按钮相对于目标文本元素的位置
function positionBtnNextTo(targetEl: HTMLElement): void {
  const rect = targetEl.getBoundingClientRect()
  const btnSize = annotateBtn.offsetWidth || 34
  annotateBtn.style.top = `${rect.top + window.scrollY + 2}px`
  annotateBtn.style.left = `${Math.max(8, rect.left - btnSize - 6 + window.scrollX)}px`
}

// 获取目标元素的"章节标注"（用于 annotate 面板副标题）
function sectionLabelFor(targetEl: HTMLElement): string | null {
  if (!targetEl.tagName.match(/H[23]/)) return null
  return `${targetEl.tagName.toLowerCase()} ${targetEl.textContent?.trim() || ''}`
}

/**
 * 在指定容器内为所有匹配 selector 的元素绑定 hover + tap 交互。
 * 由外部调用一次，之后所有文档切换都复用同一批监听器。
 *
 * @param container 文本内容的容器元素（contentArea）
 * @param selector  哪些元素能触发标注按钮（'h2, h3, p'）
 * @param getDocPath 返回当前文档路径的回调（避免与父模块的循环引用）
 */
export function bindAnnotateZones(
  container: HTMLElement,
  selector: string,
  getDocPath: () => string
): void {

  // ---------- 悬停（鼠标/笔）：显示按钮 + 记录 targetKey ----------
  container.addEventListener('pointerover', (ev) => {
    // 仅对"进入文本区"的事件作出响应
    const targetEl = (ev.target as Element)?.closest?.(selector) as HTMLElement | null
    if (!targetEl) return

    // 桌面/笔：hover 模式；触屏：pointerover 不稳定，交给 click 路径
    if (ev.pointerType === 'touch') return

    // 进入钉住模式时也允许 hover 覆盖（移动到其他段落就更新位置）
    stickModeEl = null

    const docPath = getDocPath()
    currentDocPath = docPath
    currentSection = sectionLabelFor(targetEl)
    currentTargetEl = targetEl
    currentTargetKey = computeTargetKey(docPath, targetEl)

    positionBtnNextTo(targetEl)
    showNow()
  })

  // ---------- 离开文本区或内容区：延迟隐藏 ----------
  container.addEventListener('pointerout', (ev) => {
    if (ev.pointerType === 'touch') return

    const related = ev.relatedTarget as Node | null

    // 1. 如果指针是移动到 contentArea 内部另一个文本元素 → 不做任何事（后续 pointerover 会更新位置）
    const stillInSomeText =
      related instanceof Element && related.closest && related.closest(selector) !== null
    if (stillInSomeText) return

    // 2. 如果指针是移动到按钮本身 → 不隐藏（按钮的 pointerenter 会取消隐藏）
    const movingToBtn =
      related !== null && (annotateBtn === related || annotateBtn.contains(related))
    if (movingToBtn) return

    // 3. 其他情况（离开 contentArea、移到空白区等）→ 延迟隐藏
    requestHide(220)
  })

  // ---------- 按钮自身：悬停时取消隐藏；离开时延迟隐藏 ----------
  annotateBtn.addEventListener('pointerenter', (ev) => {
    if (ev.pointerType === 'touch') return
    clearHideTimer()
  })

  annotateBtn.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch') return
    const related = ev.relatedTarget as Node | null
    const goingToText =
      related instanceof Element && related.closest && related.closest(selector) !== null
    if (goingToText) {
      // 从按钮回到文本区 → 保持显示（container 的 pointerover 会接管）
      clearHideTimer()
      return
    }
    requestHide(180)
  })

  // ---------- 点击空白区 / 触屏交互（点击即可见） ----------
  // 桌面端（鼠标/笔）由 hover 路径接管显示/隐藏；这里只处理触屏与"点击空白取消"。
  container.addEventListener('pointerdown', (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target) return

    // 点击了交互元素（链接/按钮/输入框）→ 交给它们自己处理
    if (target.closest('a, button, input, textarea, .annotate-btn')) return

    const targetEl = target.closest(selector) as HTMLElement | null
    const isTouch = ev.pointerType === 'touch'

    if (!targetEl) {
      // 点在空白区 → 立即隐藏（同时退出钉住模式）
      stickModeEl = null
      hideAnnotateBtn()
      return
    }

    // 只有触屏才用点击来钉住；鼠标由 hover 负责
    if (!isTouch) return

    const docPath = getDocPath()
    currentDocPath = docPath
    currentSection = sectionLabelFor(targetEl)
    currentTargetEl = targetEl
    currentTargetKey = computeTargetKey(docPath, targetEl)

    positionBtnNextTo(targetEl)

    if (stickModeEl === targetEl) {
      // 同一段落再点一次 → 取消钉住
      stickModeEl = null
      hideAnnotateBtn()
    } else {
      stickModeEl = targetEl
      showNow()
      ev.stopPropagation()
    }
  })
}

// --- 对外 API（简洁明了） ---
export function showAnnotateBtn(docPath: string, section: string | null): void {
  currentDocPath = docPath
  currentSection = section
  showNow()
}

export function hideAnnotateBtn(): void {
  clearHideTimer()
  stickModeEl = null
  annotateBtn.classList.remove('visible')
}

export function scheduleHideAnnotateBtn(delayMs: number = 250): void {
  requestHide(delayMs)
}

// ============================================================
// Badge / Popover 角标系统
// ============================================================
//
// 交互流程：
//   1. 每次渲染内容后 → scanAndRenderBadges(container, docPath)
//   2. 对每个 h2/h3/p 计算 targetKey → 如果有匹配的 note → 加角标
//   3. 角标点击 → 弹出气泡，列出该段落所有记录
//   4. 点击气泡中的条目 → 打开变更面板 + scroll + highlight 到那条
// ============================================================

let popoverEl: HTMLElement | null = null  // 当前打开的气泡（单例）

/** 关闭当前的角标气泡 */
function closeBadgePopover(): void {
  if (popoverEl && popoverEl.parentNode) {
    popoverEl.parentNode.removeChild(popoverEl)
  }
  popoverEl = null
}

/** 打开角标气泡：在 badge 附近，列出该段落所有记录 */
function openBadgePopover(badge: HTMLElement, notes: ChangeNote[]): void {
  closeBadgePopover()

  popoverEl = document.createElement('div')
  popoverEl.className = 'badge-popover'

  const itemsHtml = notes.map(n => `
    <div class="badge-popover-item" data-id="${n.id}">
      <span class="change-badge change-badge-${n.type}">${typeLabels[n.type] || n.type}</span>
      <div class="badge-popover-body">
        <div class="badge-popover-title">${esc(n.content.summary)}</div>
        ${n.content.body ? `<div class="badge-popover-snippet">${esc(n.content.body.slice(0, 60))}${n.content.body.length > 60 ? '...' : ''}</div>` : ''}
        <div class="badge-popover-meta">${formatTime(n.timestamp)} · ${statusLabels[n.status] || n.status}</div>
      </div>
    </div>
  `).join('')

  popoverEl.innerHTML = `
    <div class="badge-popover-arrow"></div>
    <div class="badge-popover-inner">
      <div class="badge-popover-header">
        <strong>${notes.length} 条记录</strong>
        <button class="badge-popover-close" title="关闭">×</button>
      </div>
      <div class="badge-popover-list">${itemsHtml}</div>
      <div class="badge-popover-footer">点击任意记录在变更面板中查看详情</div>
    </div>
  `

  // 先挂到 DOM 让它有尺寸，再定位
  document.body.appendChild(popoverEl)

  // 定位到 badge 附近（优先右侧，不够空间放左侧；优先下方，不够放上）
  const badgeRect = badge.getBoundingClientRect()
  const popRect = popoverEl.getBoundingClientRect()
  const margin = 8
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  // 水平：优先右边
  let left = badgeRect.right + margin
  if (left + popRect.width > viewportW - 8) {
    left = Math.max(8, badgeRect.left - popRect.width - margin)
  }
  // 垂直：优先下方
  let top = badgeRect.top + badgeRect.height + margin
  if (top + popRect.height > viewportH - 8) {
    top = Math.max(8, badgeRect.top - popRect.height - margin)
  }

  popoverEl.style.left = `${left}px`
  popoverEl.style.top = `${top}px`

  // 事件绑定
  popoverEl.querySelector('.badge-popover-close')!.addEventListener('click', (e) => {
    e.stopPropagation()
    closeBadgePopover()
  })

  // 点列表项 → 打开面板并定位
  popoverEl.querySelectorAll('.badge-popover-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation()
      const noteId = (item as HTMLElement).dataset.id || ''
      openChangesPanelAndHighlight(noteId)
      closeBadgePopover()
    })
  })

  // 气泡外层点击不被当作"点空白关闭"（由 document 监听器处理）
  popoverEl.addEventListener('pointerdown', (e) => e.stopPropagation())
}

/** 打开变更面板、清除筛选、滚动到指定记录、高亮 */
function openChangesPanelAndHighlight(noteId: string): void {
  if (!changesPanel) return
  // 1. 打开面板
  changesPanel.classList.add('open')

  // 2. 重置搜索/筛选 → 确保记录可见
  filterText = ''
  filterStatus = 'all'
  const searchInput = changesPanel.querySelector('.panel-search-input') as HTMLInputElement | null
  const statusSelect = changesPanel.querySelector('.panel-status-select') as HTMLSelectElement | null
  if (searchInput) searchInput.value = ''
  if (statusSelect) statusSelect.value = 'all'

  // 3. 重渲染列表
  updateChangesList()

  // 4. 滚动到目标条目并高亮
  requestAnimationFrame(() => {
    const item = changesPanel.querySelector(`.change-item[data-id="${noteId}"]`) as HTMLElement | null
    if (!item) return
    item.scrollIntoView({ behavior: 'smooth', block: 'center' })
    item.classList.add('change-item-highlight')
    window.setTimeout(() => item.classList.remove('change-item-highlight'), 2400)
  })
}

/** 扫描内容区域，给有记录的段落加角标。在渲染内容后调用。 */
export function scanAndRenderBadges(container: HTMLElement, docPath: string): void {
  if (!container) return
  badgeContainer = container
  badgeDocPath = docPath
  // 先清理旧角标
  container.querySelectorAll('.annotate-badge').forEach(b => b.parentNode?.removeChild(b))

  // 如果文档无记录 → 直接返回
  const notesForDoc = changes.filter(n => n.targetKey && n.target.docPath === docPath)
  if (!notesForDoc.length) return

  // 按 targetKey 分组
  const notesByKey = new Map<string, ChangeNote[]>()
  for (const n of notesForDoc) {
    if (!n.targetKey) continue
    const list = notesByKey.get(n.targetKey) || []
    list.push(n)
    notesByKey.set(n.targetKey, list)
  }

  // 遍历所有候选元素
  const elements = container.querySelectorAll('h2, h3, p') as NodeListOf<HTMLElement>
  elements.forEach(el => {
    const key = computeTargetKey(docPath, el)
    const matches = notesByKey.get(key)
    if (!matches || !matches.length) return

    const badge = document.createElement('span')
    badge.className = 'annotate-badge'
    badge.textContent = String(matches.length)
    badge.title = `${matches.length} 条记录：点击查看`

    // 角标颜色：按最常见 status 着色
    const statuses = matches.map(m => m.status)
    if (statuses.every(s => s === 'applied')) {
      badge.classList.add('annotate-badge-applied')
    } else if (statuses.some(s => s === 'pending')) {
      badge.classList.add('annotate-badge-pending')
    } else if (statuses.some(s => s === 'rejected')) {
      badge.classList.add('annotate-badge-rejected')
    } else {
      badge.classList.add('annotate-badge-reviewed')
    }

    // 点角标 → 弹气泡
    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      e.preventDefault()
      if (popoverEl && (popoverEl as any)._currentKey === key) {
        closeBadgePopover()
      } else {
        ;(popoverEl as any) && closeBadgePopover()
        openBadgePopover(badge, matches)
        if (popoverEl) (popoverEl as any)._currentKey = key
      }
    })

    el.style.position = getComputedStyle(el).position || 'static'
    if (el.style.position === 'static' || !el.style.position) {
      el.style.position = 'relative'
    }
    el.appendChild(badge)
  })
}

// 全局：点文档其他地方 → 关闭气泡
document.addEventListener('pointerdown', (ev) => {
  const target = ev.target as HTMLElement | null
  if (!target) return
  if (target.closest('.badge-popover') || target.closest('.annotate-badge')) return
  closeBadgePopover()
})

// --- Annotate panel ---
function openAnnotatePanel(): void {
  annotatePanel.classList.add('open')
  const docInput = document.getElementById('annotate-doc') as HTMLInputElement
  docInput.value = currentDocPath || ''
  if (currentSection) {
    const summaryInput = document.getElementById('annotate-summary') as HTMLInputElement
    summaryInput.placeholder = `关于“${currentSection}”的标注...`
  }
}

function closeAnnotatePanel(): void {
  annotatePanel.classList.remove('open')
}

function saveAnnotate(): void {
  const type = (document.getElementById('annotate-type') as HTMLSelectElement).value as ChangeType
  const summary = (document.getElementById('annotate-summary') as HTMLInputElement).value.trim()
  const body = (document.getElementById('annotate-body') as HTMLTextAreaElement).value.trim()
  const tagsStr = (document.getElementById('annotate-tags') as HTMLInputElement).value.trim()
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : []

  if (!summary) {
    alert('请填写标题')
    return
  }

  const elType = currentTargetEl
    ? currentTargetEl.tagName.toLowerCase()
    : ''
  const elText = currentTargetEl
    ? (currentTargetEl.textContent || '').trim().slice(0, 60)
    : ''
  const tKey = currentTargetKey
    || (currentDocPath && currentTargetEl && currentTargetEl
      ? computeTargetKey(currentDocPath, currentTargetEl)
      : '')

  const change: ChangeNote = {
    id: generateId(),
    type,
    author: 'user',
    timestamp: new Date().toISOString(),
    target: {
      docPath: currentDocPath || '',
      section: currentSection || undefined,
      elementType: elType || undefined,
      elementText: elText || undefined,
    },
    content: {
      summary,
      body,
      tags,
    },
    status: 'pending',
    targetKey: tKey,
  }

  changes.unshift(change)  // 新的在最上面
  persistAndRefresh()
  closeAnnotatePanel()

  // 清空表单
  ;(document.getElementById('annotate-summary') as HTMLInputElement).value = ''
  ;(document.getElementById('annotate-body') as HTMLTextAreaElement).value = ''
  ;(document.getElementById('annotate-tags') as HTMLInputElement).value = ''
}

// --- Changes panel ---
function toggleChangesPanel(): void {
  changesPanel.classList.toggle('open')
}

function closeChangesPanel(): void {
  changesPanel.classList.remove('open')
}

function updateChangesList(): void {
  if (!changesList) return
  changesCount.textContent = changes.length.toString()

  // 筛选（文字 + 状态）
  const visible = changes.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (!filterText) return true
    const haystack = [
      c.content?.summary,
      c.content?.body,
      c.target?.docPath,
      c.target?.section,
      (c.content?.tags || []).join(' '),
      c.id,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(filterText)
  })

  const downloadAllBtn = document.getElementById('changes-download-all') as HTMLButtonElement | null
  if (downloadAllBtn) {
    downloadAllBtn.textContent = `批量下载 (${changes.length} 条)`
    downloadAllBtn.disabled = changes.length === 0
  }

  if (visible.length === 0) {
    changesList.innerHTML = changes.length === 0
      ? `<div class="changes-empty">暂无变更记录<br/><span style="font-size:11px; opacity:.6;">在文档上点 <strong>+</strong> 添加备注；或从 JSON 导入。</span></div>`
      : `<div class="changes-empty">没有匹配的记录（共 ${changes.length} 条）</div>`
    return
  }

  changesList.innerHTML = visible.map((c, i) => `
    <div class="change-item" data-id="${c.id}">
      <div class="change-item-header">
        <span class="change-badge change-badge-${c.type}">${typeLabels[c.type] || c.type}</span>
        <span class="change-id">${c.id}</span>
        <div style="margin-left:auto; display:flex; gap:4px;">
          <button class="change-action" data-act="download" title="下载该条">&#8595;</button>
          <button class="change-action" data-act="status" title="点击切换状态">${statusLabels[c.status] || c.status}</button>
          <button class="change-action" data-act="delete" title="删除">&times;</button>
        </div>
      </div>
      <div class="change-item-title">${esc(c.content.summary)}</div>
      <div class="change-item-meta">${esc(c.target.docPath)}${c.target.section ? ' · ' + esc(c.target.section) : ''}</div>
      ${c.content.body ? `<div class="change-item-body">${esc(c.content.body).replace(/\n/g, '<br/>')}</div>` : ''}
      ${c.content.tags && c.content.tags.length ? `<div class="change-item-tags">${c.content.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="change-item-time">${formatTime(c.timestamp)} · ${esc(c.author)}</div>
    </div>
  `).join('')

  // Bind per-item actions
  changesList.querySelectorAll('.change-item').forEach(el => {
    const id = (el as HTMLElement).dataset.id
    const note = changes.find(n => n.id === id)
    if (!note) return

    // 下载单条
    el.querySelector('[data-act="download"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      downloadChangeNote(note)
    })

    // 切换状态（循环：pending → reviewed → applied → rejected → pending）
    el.querySelector('[data-act="status"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const order: ChangeStatus[] = ['pending', 'reviewed', 'applied', 'rejected']
      const idx = order.indexOf(note.status)
      note.status = order[(idx + 1) % order.length]
      persistAndRefresh()
    })

    // 删除
    el.querySelector('[data-act="delete"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (!confirm(`删除「${note.content.summary}」?`)) return
      changes = changes.filter(n => n.id !== id)
      persistAndRefresh()
    })
  })
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    const pad = (n: number) => n.toString().padStart(2, '0')
    if (sameDay) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}