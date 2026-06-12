import type { ChangeNote, ChangeType } from '../api'
import { generateId, downloadChangeNote, downloadAllChanges } from '../api'

// --- Session state ---
let changes: ChangeNote[] = []
let currentDocPath: string | null = null
let currentSection: string | null = null

// --- DOM elements ---
let annotateBtn: HTMLElement
let annotatePanel: HTMLElement
let changesPanel: HTMLElement
let changesToggle: HTMLElement
let changesCount: HTMLElement

// --- Type labels ---
const typeLabels: Record<ChangeType, string> = {
  annotation: '标注',
  draft: '草稿',
  correction: '修正',
  idea: '灵感',
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
        <button class="btn btn-primary" id="annotate-save">保存并下载</button>
      </div>
    </div>
  `
  document.body.appendChild(annotatePanel)

  // Create changes panel (right sidebar)
  changesPanel = document.createElement('div')
  changesPanel.className = 'changes-panel'
  changesPanel.innerHTML = `
    <div class="changes-panel-header">
      <h3>变更记录</h3>
      <button class="changes-panel-close" id="changes-close">&times;</button>
    </div>
    <div class="changes-panel-body" id="changes-list">
      <div class="changes-empty">暂无变更记录</div>
    </div>
    <div class="changes-panel-footer">
      <button class="btn btn-secondary btn-sm" id="changes-download-all">下载全部</button>
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
  document.getElementById('changes-download-all')!.addEventListener('click', () => {
    downloadAllChanges(changes)
  })

  // Close panels on overlay click
  annotatePanel.querySelector('.annotate-panel-overlay')!.addEventListener('click', closeAnnotatePanel)

  // Bind button self-hover so moving from text → button keeps it visible
  bindAnnotateBtnHover()
}

// --- Show/hide annotate button — 统一显示/隐藏逻辑 ---
// 设计目标：
//   1. 鼠标从文本移动到按钮本身时，按钮不应中途消失
//   2. 离开整个内容区/按钮一小段延迟后才真正隐藏（给鼠标移动留出时间）
//   3. 触屏设备：点击文本元素后按钮常驻，点击按钮或空白处再消失
let hideTimer: number | null = null

function cancelPendingHide(): void {
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function scheduleHide(delayMs: number = 250): void {
  cancelPendingHide()
  hideTimer = window.setTimeout(() => {
    hideAnnotateBtn()
    hideTimer = null
  }, delayMs)
}

export function showAnnotateBtn(docPath: string, section: string | null): void {
  currentDocPath = docPath
  currentSection = section
  cancelPendingHide()
  annotateBtn.classList.add('visible')
}

export function hideAnnotateBtn(): void {
  annotateBtn.classList.remove('visible')
}

export function scheduleHideAnnotateBtn(delayMs: number = 250): void {
  scheduleHide(delayMs)
}

// 按钮自身也要参与 hover 判定：悬停在按钮上时取消隐藏
function bindAnnotateBtnHover(): void {
  annotateBtn.addEventListener('pointerenter', cancelPendingHide)
  annotateBtn.addEventListener('pointerleave', () => scheduleHide(150))
}

// 移动端 / 备用点击逻辑：按钮在 visible 状态下接收 click 即可
// （showAnnotateBtn 已处理 visible 态，这里无需额外绑定）


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

  const change: ChangeNote = {
    id: generateId(),
    type,
    author: 'user',
    timestamp: new Date().toISOString(),
    target: {
      docPath: currentDocPath || '',
      section: currentSection || undefined,
    },
    content: {
      summary,
      body,
      tags,
    },
    status: 'pending',
  }

  changes.push(change)
  downloadChangeNote(change)
  updateChangesList()
  closeAnnotatePanel()

  // Clear form
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
  const list = document.getElementById('changes-list')!
  changesCount.textContent = changes.length.toString()

  if (changes.length === 0) {
    list.innerHTML = '<div class="changes-empty">暂无变更记录</div>'
    return
  }

  list.innerHTML = changes.map((c, i) => `
    <div class="change-item">
      <div class="change-item-header">
        <span class="change-badge change-badge-${c.type}">${typeLabels[c.type]}</span>
        <span class="change-id">${c.id}</span>
        <button class="change-download" data-index="${i}" title="下载">&#8595;</button>
      </div>
      <div class="change-item-title">${esc(c.content.summary)}</div>
      <div class="change-item-meta">${esc(c.target.docPath)}</div>
      ${c.content.tags.length ? `<div class="change-item-tags">${c.content.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('')

  // Bind download buttons
  list.querySelectorAll('.change-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const idx = parseInt((btn as HTMLElement).dataset.index || '0')
      downloadChangeNote(changes[idx])
    })
  })
}

function esc(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}