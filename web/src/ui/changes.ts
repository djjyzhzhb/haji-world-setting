import type { ChangeNote, ChangeType, ChangeStatus, ChangePriority } from '../api'
import {
  generateId,
  downloadChangeNote,
  downloadAllChanges,
  importChangeNotesFromFile,
  computeTargetKey,
  ensureTargetKey,
  findElementForNote,
  computeElementIndex,
  computeBreadcrumb,
  ANNOTATABLE_SELECTOR,
  computeContentFingerprint,
} from '../api'
import { marked } from 'marked'

// 哈吉语 ruby 工具（懒加载，避免循环依赖）
let _rubyPromise: Promise<any> | null = null
async function getRuby() {
  if (!_rubyPromise) {
    _rubyPromise = import('../ruby')
  }
  return _rubyPromise
}

// 将标记转换为带 ruby 注音的 HTML
async function replaceRubyInHtml(htmlOrText: string): Promise<string> {
  try {
    const mod = await getRuby()
    const { buildSentenceRuby, buildTermRuby } = mod

    // 1) `((((...)))) 段落级混写
    let out = htmlOrText
    if (/\(\(\(\(/.test(out)) {
      out = out.replace(/\(\(\(\(([\s\S]*?)\)\)\)\)/g, (_, inner) => {
        return `<span class="haji-sentence">${buildSentenceRuby(inner)}</span>`
      })
    }
    // 2) `{{ruby: ...}} 逐词
    if (/\{\{ruby:/.test(out)) {
      out = out.replace(/\{\{ruby:([^}]+)\}\}/g, (_, term) => buildTermRuby(term))
    }
    return out
  } catch (e) {
    return htmlOrText
  }
}

const STORAGE_KEY = 'app.changeNotes.v1'
const SOURCE_KEY = 'app.authorName.v1'

// --- Source name（"名字系统"）：用户的代号 / 昵称 ---
// 语义：
//   - localStorage 有 SOURCE_KEY → 用户已命名，创建标注时用这个名字
//   - localStorage 无 SOURCE_KEY → "我是谁" 用户，导出时才被迫命名
//   - 标注的 author 字段：具体某条记录是谁写的
export function getSourceName(): string {
  return localStorage.getItem(SOURCE_KEY) || ''
}

export function setSourceName(name: string): void {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    localStorage.removeItem(SOURCE_KEY)
    return
  }
  localStorage.setItem(SOURCE_KEY, trimmed)
}

function isAnonUpgraded(): boolean {
  return !!localStorage.getItem('anon-upgraded')
}

function authorForNewNote(): string {
  return getSourceName() || (isAnonUpgraded() ? '匿名的人' : '匿名旅人')
}

// 把当前 changes 里所有匿名标注（"匿名旅人"或"匿名的人"）批量更新为某个名字
// 用于"我是谁"用户导出时第一次命名：让他之前写的所有标注都带上他的名字
export function rewriteAnonAuthorTo(newName: string): number {
  let updated = 0
  for (const n of changes) {
    if (n.author === '匿名旅人' || n.author === '匿名的人') {
      n.author = newName
      updated++
    }
  }
  return updated
}

// 作者颜色映射：根据 author 字符串稳定哈希到 0..N-1，对应不同颜色 class
export function authorColorClass(author: string): string {
  if (!author) return 'author-chip-0'
  let h = 0
  for (let i = 0; i < author.length; i++) {
    h = (h * 31 + author.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % 8
  return `author-chip-${idx}`
}

// --- Session state ---
let changes: ChangeNote[] = loadFromStorage().map(ensureTargetKey)
let currentDocPath: string | null = null
let currentSection: string | null = null
let currentTargetEl: HTMLElement | null = null   // 当前 hover 的文本元素
let currentTargetKey: string | null = null      // 对应计算出的 key
let badgeContainer: HTMLElement | null = null   // 最近一次渲染角标的容器
let badgeDocPath: string = ''                   // 最近一次的 docPath
let editingNoteId: string | null = null  // 当前正在编辑的记录 ID

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

const priorityLabels: Record<ChangePriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '紧急',
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
          <div class="annotate-format-toolbar">
            <button type="button" data-fmt="bold" title="粗体">B</button>
            <button type="button" data-fmt="italic" title="斜体"><em>I</em></button>
            <button type="button" data-fmt="link" title="链接">🔗</button>
            <button type="button" data-fmt="list" title="无序列表">•</button>
            <button type="button" data-fmt="quote" title="引用">❝</button>
            <button type="button" data-fmt="code" title="代码块">&lt;/&gt;</button>
          </div>
          <textarea id="annotate-body" rows="5" placeholder="详细内容..."></textarea>
        </div>
        <div class="annotate-field">
          <label>标签（逗号分隔）</label>
          <input type="text" id="annotate-tags" placeholder="颜色, 认知, 语言" />
        </div>
        <div class="annotate-field">
          <label>优先级</label>
          <select id="annotate-priority">
            <option value="">（默认）</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">紧急</option>
          </select>
        </div>
        <div class="annotate-field">
          <label>引用/参考来源</label>
          <input type="text" id="annotate-reference" placeholder="可输入文档名称或外部链接等" />
        </div>
        <div class="annotate-field">
          <label>关联文档（逗号分隔）</label>
          <input type="text" id="annotate-related" placeholder="世界地图与总览, 大年表" />
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
      <button class="btn btn-secondary btn-sm" id="changes-import-btn">导入存档</button>
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

  // 批量下载：已命名 → 直接导出；未命名 → 弹命名对话框
  // 命名由外部模块（main.ts）负责，通过 'identity-ensure' 事件触发
  // 外部命名完成后派发 'author-named' → 我们做批量更新；再派发 'identity-ready' → 我们导出
  function doExport(): void {
    persistAndRefresh() // 确保任何批量更新已写回 localStorage
    downloadAllChanges(changes, getSourceName() || undefined)
  }

  // 命名完成（第一次拥有了名字）：把"匿名旅人"批量更新为新名字
  window.addEventListener('author-named', ((ev: CustomEvent) => {
    const name = (ev.detail?.name as string) || ''
    if (!name) return
    const updated = rewriteAnonAuthorTo(name)
    if (updated > 0) persistAndRefresh()
  }) as EventListener)

  window.addEventListener('identity-ready', (() => {
    doExport()
  }) as EventListener)

  document.getElementById('changes-download-all')!.addEventListener('click', () => {
    const name = getSourceName()
    if (name) {
      doExport()
      return
    }
    // 还没有名字 —— 触发命名流程
    // dispatchEvent 在 handler 调 preventDefault() 后返回 false → 表示有人处理了
    const canceled = !window.dispatchEvent(new CustomEvent('identity-ensure', { cancelable: true }))
    if (!canceled) doExport() // 无人处理（没监听器），降级直接导出
  })

  // 清空记录
  document.getElementById('changes-clear')!.addEventListener('click', () => {
    if (!changes.length) return
    if (confirm(`确认清空全部 ${changes.length} 条变更记录？（不可恢复）`)) {
      changes = []
      persistAndRefresh()
    }
  })

  // 初始化快捷键
  initFmtToolbar()

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
    const existingKeys = new Set(changes.map(c => c.author + '::' + c.id))
    for (const file of Array.from(changesImportInput.files)) {
      try {
        const { notes, source: bundleSource } = await importChangeNotesFromFile(file)
        for (const note of notes) {
          // dedupKey 必须与下面 push 时实际存储的 author 一致，否则旧存档重导会漏掉去重
          const effectiveAuthor = note.author || bundleSource || (isAnonUpgraded() ? '匿名的人' : '匿名旅人')
          const dedupKey = effectiveAuthor + '::' + (note.id || '')
          if (dedupKey && existingKeys.has(dedupKey)) {
            skipped++
            continue
          }
          changes.push({
            id: note.id || generateId(),
            type: note.type || 'annotation',
            author: effectiveAuthor,
            timestamp: note.timestamp || new Date().toISOString(),
            target: note.target || { docPath: '' },
            content: note.content || { summary: '(无标题)', body: '', tags: [] },
            status: note.status || 'pending',
            targetKey: note.targetKey || '',
            contentFingerprint: note.contentFingerprint || undefined,
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
        <div class="badge-popover-title">${esc(n.content.summary)} <span class="author-chip ${authorColorClass(n.author)}" style="font-size:10px; padding:1px 6px; margin-left:4px;">${esc(n.author)}</span></div>
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

  // 手机端（≤600px）：优先显示在下方中央，避免左右空间不足
  const isMobile = viewportW <= 600
  let left: number
  if (isMobile) {
    left = Math.max(8, (viewportW - popRect.width) / 2)
  } else {
    // 水平：优先右边
    left = badgeRect.right + margin
    if (left + popRect.width > viewportW - 8) {
      left = Math.max(8, badgeRect.left - popRect.width - margin)
    }
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

/** 按 status 给角标着色 */
function pickBadgeColorClass(badge: HTMLElement, notes: ChangeNote[]): void {
  const statuses = notes.map(n => n.status)
  if (statuses.every(s => s === 'applied')) {
    badge.classList.add('annotate-badge-applied')
  } else if (statuses.some(s => s === 'pending')) {
    badge.classList.add('annotate-badge-pending')
  } else if (statuses.some(s => s === 'rejected')) {
    badge.classList.add('annotate-badge-rejected')
  } else {
    badge.classList.add('annotate-badge-reviewed')
  }
}

/**
 * 扫描内容区域，给有记录的段落加角标。
 *
 * 策略（多级匹配，避免单一 targetKey 失配导致仅第一条显示）：
 *   1) 先遍历所有候选段落元素，为每个元素收集"属于它"的 note
 *      —— 对每个 note 挑出最佳匹配元素（分数最高者），
 *         这保证旧笔记（section 或 elementText 不同）也能挂上新渲染的段落。
 *   2) 角标使用 position: fixed，放在 body 下，避免被任何父容器 overflow 裁剪。
 *   3) 滚动/尺寸变化时重新定位。
 */
let _badgeRepositionFn: (() => void) | null = null

export function scanAndRenderBadges(container: HTMLElement, docPath: string): void {
  if (!container) return
  badgeContainer = container
  badgeDocPath = docPath

  // 先清理旧角标（body 下 + 旧逻辑残留的容器内）
  document.querySelectorAll('.annotate-badge').forEach(b => b.parentNode?.removeChild(b))

  // 本文档所有变更记录
  const notesForDoc = changes.filter(n => n.target && n.target.docPath === docPath)
  if (!notesForDoc.length) return

  // 步骤 1：为每段元素收集归属 note。
  // 使用 "每个 note 挑最佳元素" → 反向构建 element→notes[] 映射。
  const notesByElement = new Map<HTMLElement, ChangeNote[]>()
  for (const note of notesForDoc) {
    const el = findElementForNote(container, docPath, note)
    if (!el) continue
    const list = notesByElement.get(el) || []
    list.push(note)
    notesByElement.set(el, list)
  }

  if (notesByElement.size === 0) return

  // 步骤 2：为每个有归属 note 的元素渲染角标
  const elements = Array.from(container.querySelectorAll(ANNOTATABLE_SELECTOR) as NodeListOf<HTMLElement>)
  const renderedBadges: { badge: HTMLElement; element: HTMLElement; notes: ChangeNote[] }[] = []

  elements.forEach(el => {
    const matched = notesByElement.get(el)
    if (!matched || !matched.length) return

    const badge = document.createElement('span')
    badge.className = 'annotate-badge annotate-badge-fixed'
    badge.textContent = String(matched.length)
    badge.title = `${matched.length} 条变更记录：点击查看`
    pickBadgeColorClass(badge, matched)

    // contentFingerprint 变更检测：如果任何一条 note 的指纹与当前段落不匹配，加"已变更"类
    const currentFp = computeContentFingerprint(el)
    const hasChangedContent = matched.some(n => n.contentFingerprint && n.contentFingerprint !== currentFp)
    if (hasChangedContent) {
      badge.classList.add('annotate-badge-changed')
      badge.title = `${matched.length} 条变更记录（内容已变更）：点击查看`
    }

    // 点击角标 → 打开气泡（再次点击关闭）
    badge.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      e.preventDefault()
      const currentKey = (popoverEl as any)?._anchorElement
      if (popoverEl && currentKey === el) {
        closeBadgePopover()
      } else {
        if (popoverEl) closeBadgePopover()
        openBadgePopover(badge, matched)
        if (popoverEl) (popoverEl as any)._anchorElement = el
      }
    })

    document.body.appendChild(badge)
    renderedBadges.push({ badge, element: el, notes: matched })
  })

  // 步骤 3：定位（贴在元素右侧 6px，不溢出视口）
  const reposition = () => {
    renderedBadges.forEach(({ badge, element }) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        badge.style.display = 'none'
        return
      }
      badge.style.display = ''
      const badgeW = badge.offsetWidth || 22
      const top = rect.top + 2
      let left = rect.right + 6
      if (left + badgeW > window.innerWidth - 4) {
        left = window.innerWidth - badgeW - 4
      }
      if (left < 2) left = 2
      badge.style.top = `${top}px`
      badge.style.left = `${left}px`
    })
  }
  reposition()

  // 卸载旧监听，挂新监听
  if (_badgeRepositionFn) {
    window.removeEventListener('scroll', _badgeRepositionFn, true)
    window.removeEventListener('resize', _badgeRepositionFn)
  }
  _badgeRepositionFn = reposition
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)

  // MutationObserver：容器内容变化（如字号、布局）时也重定位
  try {
    const mo = new MutationObserver(() => reposition())
    mo.observe(container, { childList: true, subtree: true, characterData: true, attributes: true })
  } catch {
    // 忽略（旧浏览器）
  }
}

/** 从变更面板反向定位：滚动并高亮正文对应段落 */
export function scrollToNoteInContent(noteId: string): void {
  if (!badgeContainer || !badgeDocPath) return
  const note = changes.find(c => c.id === noteId)
  if (!note) return
  const el = findElementForNote(badgeContainer, badgeDocPath, note)
  if (!el) {
    alert('该记录的目标段落未在当前文档中找到。')
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('change-item-highlight')
  window.setTimeout(() => el.classList.remove('change-item-highlight'), 2400)
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
  editingNoteId = null
  annotatePanel.classList.add('open')
  const header = annotatePanel.querySelector('.annotate-panel-header h3') as HTMLElement
  if (header) header.textContent = '添加标注'
  const saveBtn = document.getElementById('annotate-save') as HTMLElement
  if (saveBtn) saveBtn.textContent = '保存到变更记录'
  const docInput = document.getElementById('annotate-doc') as HTMLInputElement
  docInput.value = currentDocPath || ''
  if (currentSection) {
    const summaryInput = document.getElementById('annotate-summary') as HTMLInputElement
    summaryInput.placeholder = `关于“${currentSection}”的标注...`
  }
}

function closeAnnotatePanel(): void {
  annotatePanel.classList.remove('open')
  editingNoteId = null
}

function saveAnnotate(): void {
  const type = (document.getElementById('annotate-type') as HTMLSelectElement).value as ChangeType
  const summary = (document.getElementById('annotate-summary') as HTMLInputElement).value.trim()
  const body = (document.getElementById('annotate-body') as HTMLTextAreaElement).value.trim()
  const tagsStr = (document.getElementById('annotate-tags') as HTMLInputElement).value.trim()
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : []
  const priority = (document.getElementById('annotate-priority') as HTMLSelectElement).value as ChangePriority | ''
  const reference = (document.getElementById('annotate-reference') as HTMLInputElement).value.trim()
  const relatedStr = (document.getElementById('annotate-related') as HTMLInputElement).value.trim()
  const relatedDocs = relatedStr ? relatedStr.split(',').map(p => p.trim()).filter(Boolean) : undefined

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
  const elIndex = currentTargetEl && badgeContainer
    ? computeElementIndex(currentTargetEl)
    : ''
  const breadcrumb = currentTargetEl && badgeContainer
    ? computeBreadcrumb(badgeContainer, currentTargetEl)
    : ''
  const tKey = currentTargetKey
    || (currentDocPath && currentTargetEl && currentTargetEl
      ? computeTargetKey(currentDocPath, currentTargetEl)
      : '')

  if (editingNoteId) {
    // 编辑模式：更新现有记录
    const existing = changes.find(n => n.id === editingNoteId)
    if (existing) {
      existing.type = type
      existing.content.summary = summary
      existing.content.body = body
      existing.content.tags = tags
      existing.content.priority = (priority || undefined) as ChangePriority | undefined
      existing.content.reference = reference || undefined
      existing.content.relatedDocs = relatedDocs || undefined
    }
  } else {
    // 新增模式
    const change: ChangeNote = {
      id: generateId(),
      type,
      author: authorForNewNote(),
      timestamp: new Date().toISOString(),
      target: {
        docPath: currentDocPath || '',
        section: currentSection || undefined,
        elementType: elType || undefined,
        elementText: elText || undefined,
        elementIndex: elIndex || undefined,
        breadcrumb: breadcrumb || undefined,
      },
      content: {
        summary,
        body,
        tags,
        priority: (priority || undefined) as ChangePriority | undefined,
        reference: reference || undefined,
        relatedDocs: relatedDocs || undefined,
      },
      status: 'pending',
      targetKey: tKey || '',
      contentFingerprint: currentTargetEl ? computeContentFingerprint(currentTargetEl) : undefined,
    }
    changes.unshift(change)
  }

  persistAndRefresh()
  closeAnnotatePanel()

  // 清空表单
  ;(document.getElementById('annotate-summary') as HTMLInputElement).value = ''
  ;(document.getElementById('annotate-body') as HTMLTextAreaElement).value = ''
  ;(document.getElementById('annotate-tags') as HTMLInputElement).value = ''
  ;(document.getElementById('annotate-priority') as HTMLSelectElement).value = ''
  ;(document.getElementById('annotate-reference') as HTMLInputElement).value = ''
  ;(document.getElementById('annotate-related') as HTMLInputElement).value = ''
}

function openAnnotatePanelForEdit(note: ChangeNote): void {
  editingNoteId = note.id
  annotatePanel.classList.add('open')
  const header = annotatePanel.querySelector('.annotate-panel-header h3') as HTMLElement
  if (header) header.textContent = '编辑标注'
  const saveBtn = document.getElementById('annotate-save') as HTMLElement
  if (saveBtn) saveBtn.textContent = '更新标注'
  ;(document.getElementById('annotate-doc') as HTMLInputElement).value = note.target.docPath || ''
  ;(document.getElementById('annotate-summary') as HTMLInputElement).value = note.content.summary
  ;(document.getElementById('annotate-body') as HTMLTextAreaElement).value = note.content.body
  ;(document.getElementById('annotate-tags') as HTMLInputElement).value = (note.content.tags || []).join(', ')
  ;(document.getElementById('annotate-priority') as HTMLSelectElement).value = note.content.priority || ''
  ;(document.getElementById('annotate-reference') as HTMLInputElement).value = note.content.reference || ''
  ;(document.getElementById('annotate-related') as HTMLInputElement).value = (note.content.relatedDocs || []).join(', ')
}

// --- Changes panel ---
function toggleChangesPanel(): void {
  changesPanel.classList.toggle('open')
}

function closeChangesPanel(): void {
  changesPanel.classList.remove('open')
}

async function updateChangesList(): Promise<void> {
  if (!changesList) return
  changesCount.textContent = changes.length.toString()

  const visible = changes.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (!filterText) return true
    const haystack = [
      c.content?.summary,
      c.content?.body,
      c.target?.docPath,
      c.target?.section,
      (c.content?.tags || []).join(' '),
      c.content?.reference,
      (c.content?.relatedDocs || []).join(' '),
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
      ? `<div class="changes-empty">暂无变更记录<br/><span style="font-size:11px; opacity:.6;">在文档上点 <strong>+</strong> 添加备注；或从存档导入。</span></div>`
      : `<div class="changes-empty">没有匹配的记录（共 ${changes.length} 条）</div>`
    return
  }

  // 渲染 HTML（同时等待每个 body 的 ruby 处理完成）
  const htmlParts = await Promise.all(visible.map(async (c) => {
    let bodyHtml = ''
    if (c.content.body) {
      const parsedStr = marked.parse(c.content.body) as string
      const rubyRendered = await replaceRubyInHtml(parsedStr)
      bodyHtml = `<div class="change-item-body">${rubyRendered}</div>`
    }
    return `
    <div class="change-item" data-id="${c.id}">
      <div class="change-item-header">
        <span class="change-badge change-badge-${c.type}">${typeLabels[c.type] || c.type}</span>
        <span class="author-chip ${authorColorClass(c.author)}" title="作者：${esc(c.author)}">${esc(c.author)}</span>
        <div class="change-item-actions">
          <button class="change-action" data-act="expand" title="展开/缩合">&#9660;</button>
          <button class="change-action" data-act="edit" title="编辑">&#9998;</button>
          <button class="change-action" data-act="locate" title="定位到相关段落" style="font-weight:700;">&#8631;</button>
          <button class="change-action" data-act="download" title="下载该条">&#8595;</button>
          <button class="change-action change-action-status" data-act="status" title="点击切换状态">${statusLabels[c.status] || c.status}</button>
          <button class="change-action" data-act="delete" title="删除">&times;</button>
        </div>
      </div>
      <div class="change-item-title-row">
        <span class="change-item-title">${esc(c.content.summary)}</span>
        <span class="change-item-title-sep">—</span>
        <span class="change-item-meta">${esc(c.target.docPath)}${c.target.breadcrumb ? ' · ' + esc(c.target.breadcrumb) : ''}${c.target.elementIndex ? ' · ' + esc(c.target.elementIndex) : ''}</span>
      </div>
      <div class="change-item-footer">
        ${c.content.priority ? `<span class="change-priority change-priority-${c.content.priority}">${priorityLabels[c.content.priority]}</span>` : ''}
        <span class="change-item-time">${formatTime(c.timestamp)}</span>
      </div>
      <div class="change-item-collapsible">
        ${bodyHtml}
        ${c.content.tags && c.content.tags.length ? `<div class="change-item-tags">${c.content.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${c.content.reference ? `<div class="change-item-ref">参考：${esc(c.content.reference)}</div>` : ''}
        ${c.content.relatedDocs && c.content.relatedDocs.length ? `<div class="change-item-related">关联：${c.content.relatedDocs.map(d => esc(d)).join(' · ')}</div>` : ''}
      </div>
    </div>
  `;
  }));

  changesList.innerHTML = htmlParts.join('')

  // Bind per-item actions
  changesList.querySelectorAll('.change-item').forEach(el => {
    const id = (el as HTMLElement).dataset.id
    const note = changes.find(n => n.id === id)
    if (!note) return

    // 定位：滚动到文档对应段落
    el.querySelector('[data-act="locate"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      // 如果该记录属于当前打开的文档则直接定位；否则尝试切换到对应文档（若 main.ts 暴露了 API）
      const needDoc = note.target?.docPath
      if (needDoc && needDoc !== badgeDocPath) {
        // 若内容区有同名 docPath，提示用户先切换（这里简单提示，真正的文档切换由 nav 处理）
        // 我们通过事件机制通知外部模块：如果监听者存在就交给它处理。
        const event = new CustomEvent('change-locate-doc', { detail: { docPath: needDoc, noteId: note.id } })
        const handled = window.dispatchEvent(event)
        if (!handled) {
          alert(`该记录属于 ${needDoc}，请先在左侧导航打开该文档。`)
        }
        return
      }
      scrollToNoteInContent(note.id)
      // 通知主模块展开左侧导航
      window.dispatchEvent(new CustomEvent('change-expand-nav', { detail: { docPath: badgeDocPath } }))
    })

    // 展开/缩合
    el.querySelector('[data-act="expand"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      el.classList.toggle('collapsed')
      const btn = el.querySelector('[data-act="expand"]') as HTMLElement
      if (el.classList.contains('collapsed')) {
        btn.innerHTML = '&#9654;'
      } else {
        btn.innerHTML = '&#9660;'
      }
    })

    // 编辑
    el.querySelector('[data-act="edit"]')?.addEventListener('click', (ev) => {
      ev.stopPropagation()
      openAnnotatePanelForEdit(note)
    })

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

// ============================================
// Formatting toolbar (insert Markdown at cursor)
// ============================================

function insertAtCursor(ta: HTMLTextAreaElement, before: string, after = ''): void {
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const sel = ta.value.slice(start, end)
  const insert = before + sel + after
  ta.value = ta.value.slice(0, start) + insert + ta.value.slice(end)
  const newPos = start + insert.length
  ta.selectionStart = ta.selectionEnd = sel ? newPos : start + before.length
  ta.focus()
  ta.dispatchEvent(new Event('input', { bubbles: true }))
}

function initFmtToolbar(): void {
  const toolbar = document.querySelector('.annotate-format-toolbar')
  if (!toolbar) return

  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button')
    if (!btn) return
    const fmt = btn.dataset.fmt
    const ta = document.getElementById('annotate-body') as HTMLTextAreaElement
    if (!ta) return

    switch (fmt) {
      case 'bold':   insertAtCursor(ta, '**', '**'); break
      case 'italic': insertAtCursor(ta, '*', '*'); break
      case 'link':   insertAtCursor(ta, '[', '](url)'); break
      case 'list':   insertAtCursor(ta, '- '); break
      case 'quote':  insertAtCursor(ta, '> '); break
      case 'code':   insertAtCursor(ta, '\n```\n', '\n```\n'); break
    }
  })
}