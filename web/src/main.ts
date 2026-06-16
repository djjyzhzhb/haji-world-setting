import './style.css'
import { marked } from 'marked'
import { initChangesSystem, bindAnnotateZones, scanAndRenderBadges, scrollToNoteInContent, getSourceName, setSourceName, hideAnnotateBtn } from './ui/changes'
import { ANNOTATABLE_SELECTOR } from './api'
import { buildIndex, search } from './search'
import { setHanChoice, getHanOptions } from './ruby'

// ruby 工具：按元素优先级取字 —— 元素自身 data-local-han-<syl> > 全局 userChoices > defaultA
function getHanForElement(el: HTMLElement, syl: string): string {
  const local = el.getAttribute(`data-local-han-${syl}`)
  if (local && local.length > 0) return local
  return toHan(syl)
}

// 清除某个元素上所有音节的局部选择
function clearLocalHan(el: HTMLElement, syls: string[]) {
  for (const s of syls) el.removeAttribute(`data-local-han-${s}`)
}

// --- Types ---
interface NavItem {
  name: string
  path: string
  overview?: string   // 总览文档路径，点击 section header 时加载
  children?: NavItem[]
}

interface DocEntry {
  path: string
  title: string
  content: string
  causalRefs?: string[]     // front matter causal_refs
  refsBy?: string[]         // 被哪些文档引用（运行时反向索引）
  created?: string          // front matter created
  modified?: string         // front matter modified
  tags?: string[]           // front matter tags
  status?: string           // front matter status
}

// --- 自动从目录结构生成导航树 ---
function autoBuildDirectoryTree(): NavItem[] {
  // 收集所有非排除路径
  const paths: string[] = []
  for (const importPath of Object.keys(allMdImports)) {
    const clean = importPath.replace(/^\.\.\/\.\.\//, '')
    // 锚点：只看 00_ 到 99_ 开头的目录下的 .md 文件
    if (!/^\d{2}_/.test(clean)) continue
    paths.push(clean)
  }

  function displayDirName(dir: string): string {
    return dir.replace(/_/g, ' ')
  }

  function displayFileName(file: string): string {
    const noExt = file.replace(/\.md$/, '')
    const noNum = noExt.replace(/^\d{2}_/, '')
    return noNum.replace(/_/g, ' ')
  }

  function buildNode(branchPaths: string[], parentPath: string): NavItem[] {
    const dirs = new Map<string, string[]>()
    const fileSet = new Set<string>()

    for (const p of branchPaths) {
      const slashIdx = p.indexOf('/')
      if (slashIdx === -1) {
        fileSet.add(p)
      } else {
        const dir = p.substring(0, slashIdx)
        const rest = p.substring(slashIdx + 1)
        if (!dirs.has(dir)) dirs.set(dir, [])
        dirs.get(dir)!.push(rest)
      }
    }

    // 收集所有唯一键（目录名 和 文件基本名），排序
    const allKeys = new Set<string>()
    for (const d of dirs.keys()) allKeys.add(d)
    for (const f of fileSet) allKeys.add(f.replace(/\.md$/, ''))

    const result: NavItem[] = []
    const consumedFiles = new Set<string>()

    for (const key of [...allKeys].sort()) {
      const isDir = dirs.has(key)
      const fileName = key + '.md'
      const isFile = fileSet.has(fileName)
      const fullPath = parentPath ? parentPath + '/' + key : key

      if (isDir) {
        const children = buildNode(dirs.get(key)!, fullPath)
        const overview = isFile ? fullPath + '.md' : undefined
        if (isFile) consumedFiles.add(fileName)

        result.push({
          name: displayDirName(key),
          path: fullPath,
          overview,
          children,
        })
      } else if (isFile && !consumedFiles.has(fileName)) {
        result.push({
          name: displayFileName(fileName),
          path: fullPath + '.md',
        })
      }
    }

    return result
  }

  return buildNode(paths, '')
}

// --- Import all markdown files ---
const mdFiles = import.meta.glob('../../*.md', { query: '?raw', import: 'default' })
const mdFilesDeep = import.meta.glob('../../**/*.md', { query: '?raw', import: 'default' })
const allMdImports = { ...mdFiles, ...mdFilesDeep }

const directoryTree: NavItem[] = autoBuildDirectoryTree()

// O(1) 文档查找映射：cleanPath → importer
const docImportMap: Map<string, () => Promise<string>> = new Map()
for (const [importPath, importer] of Object.entries(allMdImports)) {
  const cleanPath = importPath.replace(/^\.\.\/\.\.\//, '')
  docImportMap.set(cleanPath, importer as () => Promise<string>)
}

// --- App state ---
let currentDoc: DocEntry | null = null
let settingsOpen = false
let previousDoc: DocEntry | null = null
let pendingHighlightQuery: string | null = null // 搜索命中后，在文档中高亮的关键词
const docs: Map<string, DocEntry> = new Map()

/** 阅读位置记忆：记录每个文档上次的 scrollTop */
const scrollPositions: Map<string, number> = new Map()

/** 扁平化文档路径列表（用于上一篇/下一篇），按导航顺序 */
let flatDocPaths: string[] = []

function buildFlatDocPaths(): void {
  const result: string[] = []
  function walk(items: NavItem[]) {
    for (const item of items) {
      if (item.overview) result.push(item.overview)
      if (!item.children) {
        result.push(item.path)
      } else {
        walk(item.children)
      }
    }
  }
  walk(directoryTree)
  flatDocPaths = result
}

/** 构建反向引用索引：causalRefs 中引用了谁，谁就被谁引用 */
function buildRefsBy(): void {
  // 清空所有 refsBy
  for (const doc of docs.values()) doc.refsBy = undefined
  for (const doc of docs.values()) {
    if (!doc.causalRefs) continue
    for (const refPath of doc.causalRefs) {
      const target = docs.get(refPath)
      if (target) {
        if (!target.refsBy) target.refsBy = []
        if (!target.refsBy.includes(doc.path)) target.refsBy.push(doc.path)
      }
    }
  }
}

// --- Build DOM ---
const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-title">世界观设定集</h1>
        <div class="search-area">
          <input type="text" id="search-input" class="search-input" placeholder="搜索文档..." aria-label="搜索文档" />
          <div class="search-results" id="search-results" style="display:none"></div>
        </div>
      </div>
      <nav class="nav-tree" id="nav-tree"></nav>
    </aside>
    <main class="content" id="content">
      <div class="content-loading"></div>
    </main>
  </div>
`

// --- 手机端汉堡按钮 + 滑动抽屉 ---
const hamburgerBtn = document.createElement('button')
hamburgerBtn.className = 'hamburger-btn'
hamburgerBtn.innerHTML = '☰'
hamburgerBtn.setAttribute('aria-label', '打开菜单')
hamburgerBtn.title = '菜单'
document.body.appendChild(hamburgerBtn)

const sidebarEl = document.getElementById('sidebar')!

// 拖动把手
const dragHandle = document.createElement('div')
dragHandle.className = 'sidebar-drag-handle'
sidebarEl.appendChild(dragHandle)

function getSidebarWidth(): number {
  return sidebarEl.getBoundingClientRect().width
}

function setSidebarPos(px: number): void {
  sidebarEl.classList.remove('open')
  sidebarEl.style.transition = 'none'
  sidebarEl.style.transform = `translateX(${px}px)`
}

function snapSidebar(open: boolean): void {
  sidebarEl.style.transition = ''
  sidebarEl.style.transform = ''
  if (open) {
    sidebarEl.classList.add('open')
    hamburgerBtn.innerHTML = '✕'
    hamburgerBtn.setAttribute('aria-label', '关闭菜单')
    hamburgerBtn.title = '关闭菜单'
    hamburgerBtn.classList.add('hamburger-close')
  } else {
    sidebarEl.classList.remove('open')
    hamburgerBtn.innerHTML = '☰'
    hamburgerBtn.setAttribute('aria-label', '打开菜单')
    hamburgerBtn.title = '菜单'
    hamburgerBtn.classList.remove('hamburger-close')
  }
}

function openSidebar(): void {
  snapSidebar(true)
}

function closeSidebar(): void {
  snapSidebar(false)
}

// --- 把手拖动逻辑 ---
let dragBaseLeft = 0
let dragActive = false

function handleDragStart(): void {
  const match = sidebarEl.style.transform.match(/translateX\(([-\d.]+)px\)/)
  dragBaseLeft = match ? parseFloat(match[1]) : (sidebarEl.classList.contains('open') ? 0 : -getSidebarWidth())
  dragActive = true
  sidebarEl.classList.remove('open')
  sidebarEl.style.transform = `translateX(${dragBaseLeft}px)`
  sidebarEl.style.transition = 'none'
}

function handleDragMove(clientX: number, startX: number): void {
  if (!dragActive) return
  const delta = clientX - startX
  const sw = getSidebarWidth()
  const newLeft = Math.min(0, Math.max(-sw, dragBaseLeft + delta))
  setSidebarPos(newLeft)
}

function handleDragEnd(): void {
  if (!dragActive) return
  dragActive = false
  const sw = getSidebarWidth()
  const match = sidebarEl.style.transform.match(/translateX\(([-\d.]+)px\)/)
  const finalLeft = match ? parseFloat(match[1]) : dragBaseLeft
  const progress = (finalLeft + sw) / sw
  if (progress <= 0.15) {
    snapSidebar(false)
  } else {
    sidebarEl.style.transition = ''
    sidebarEl.style.transform = `translateX(${finalLeft}px)`
    hamburgerBtn.innerHTML = '✕'
    hamburgerBtn.title = '关闭菜单'
    hamburgerBtn.classList.add('hamburger-close')
  }
}

// 触摸事件（把手）
let touchStartX = 0

dragHandle.addEventListener('touchstart', (e) => {
  e.preventDefault()
  e.stopPropagation()
  touchStartX = e.touches[0].clientX
  handleDragStart()
}, { passive: false })

dragHandle.addEventListener('touchmove', (e) => {
  if (!dragActive) return
  e.preventDefault()
  handleDragMove(e.touches[0].clientX, touchStartX)
}, { passive: false })

dragHandle.addEventListener('touchend', () => {
  handleDragEnd()
})

// 鼠标事件（桌面调试）
dragHandle.addEventListener('mousedown', (e) => {
  e.preventDefault()
  handleDragStart()
  const mouseStartX = e.clientX
  const onMove = (ev: MouseEvent) => handleDragMove(ev.clientX, mouseStartX)
  const onUp = () => {
    handleDragEnd()
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
})

hamburgerBtn.addEventListener('click', () => {
  if (sidebarEl.classList.contains('open')) {
    closeSidebar()
  } else {
    openSidebar()
  }
})

// --- Render sidebar navigation ---
const navTree = document.getElementById('nav-tree')!
const searchInput = document.getElementById('search-input') as HTMLInputElement
const contentArea = document.getElementById('content')!

/**
 * Recursively render nav items. Returns true if any item in this subtree is visible.
 */
function renderNavItems(
  items: NavItem[],
  container: HTMLElement,
  depth: number,
  filter: string
): boolean {
  let anyVisible = false

  for (const item of items) {
    if (item.children) {
      // ---- Section with children ----
      const section = document.createElement('div')
      section.className = 'nav-section'
      section.dataset.depth = String(depth)
      // 所有含子项的分组默认折叠，用户点击展开时自然发现总览
      section.classList.add('collapsed')

      const header = document.createElement('div')
      header.className = 'nav-section-header'
      header.dataset.depth = String(depth)
      header.style.setProperty('--depth', String(depth))

      // 独立箭头按钮：仅控制展开/缩合
      const arrowBtn = document.createElement('button')
      arrowBtn.className = 'nav-arrow-btn'
      arrowBtn.innerHTML = '▶'
      arrowBtn.setAttribute('aria-expanded', 'false')
      arrowBtn.setAttribute('aria-label', '展开分组')
      arrowBtn.title = '展开/缩合'
      arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        section.classList.toggle('collapsed')
        arrowBtn.setAttribute('aria-expanded', String(!section.classList.contains('collapsed')))
      })
      header.appendChild(arrowBtn)

      const headerText = document.createElement('span')
      headerText.className = 'nav-section-text'
      headerText.textContent = item.name
      header.appendChild(headerText)
      header.dataset.name = item.name

      // Highlight header if its overview doc is currently loaded
      if (item.overview && currentDoc && currentDoc.path === item.overview) {
        header.classList.add('active')
        header.classList.add('nav-pulse')
      }
      // Mark headers that have overview content
      if (item.overview) {
        header.classList.add('has-overview')
      }

      // 点击 header 文本区域：加载 overview 文档（不控制展开/缩合）
      header.addEventListener('click', (e) => {
        // 如果点的是箭头按钮，不处理
        if ((e.target as HTMLElement).closest('.nav-arrow-btn')) return
        if (!item.overview) return
        const overviewPath = item.overview
        const matchedPath = Object.keys(allMdImports).find(k => k.includes(overviewPath))
        if (matchedPath) {
          loadDocument(overviewPath)
        }
      })

      const childrenContainer = document.createElement('div')
      childrenContainer.className = 'nav-section-children'

      const childVisible = renderNavItems(item.children, childrenContainer, depth + 1, filter)

      // Visibility: show if no filter, or if own name matches, or any child is visible
      const selfMatches = filter && item.name.toLowerCase().includes(filter.toLowerCase())
      const visible = !filter || selfMatches || childVisible

      if (visible) {
        section.appendChild(header)
        section.appendChild(childrenContainer)
        container.appendChild(section)
      }
      anyVisible = anyVisible || visible
    } else {
      // ---- Leaf item (no children) ----
      if (filter && !item.name.toLowerCase().includes(filter.toLowerCase())) {
        continue
      }
      anyVisible = true

      const link = document.createElement('a')
      link.className = 'nav-link'
      link.dataset.depth = String(depth)
      link.style.setProperty('--depth', String(depth))
      link.textContent = item.name
      link.href = '#'
      link.addEventListener('click', (e) => {
        e.preventDefault()
        loadDocument(item.path)
      })
      if (currentDoc && currentDoc.path === item.path) {
        link.classList.add('active')
        link.classList.add('nav-pulse')
      }
      container.appendChild(link)
    }
  }

  return anyVisible
}

function renderNavTree(items: NavItem[], container: HTMLElement, filter: string = '') {
  container.innerHTML = ''
  renderNavItems(items, container, 0, filter)
}

// --- Load document ---
async function loadDocument(path: string) {
  // 离开设置页（从导航栏点击时）
  settingsOpen = false

  // 切换文档时立即隐藏「+」按钮，防止残留在旧文档位置
  hideAnnotateBtn()

  // 保存当前文档的阅读位置
  if (currentDoc) {
    scrollPositions.set(currentDoc.path, contentArea.scrollTop)
  }

  // Check cache
  if (docs.has(path)) {
    const doc = docs.get(path)!
    currentDoc = doc
    await renderContent(doc)
    updateActiveStates(path)
    // 恢复阅读位置
    const savedPos = scrollPositions.get(path)
    if (savedPos !== undefined) {
      requestAnimationFrame(() => { contentArea.scrollTop = savedPos })
    }
    return
  }

  // Show loading
  contentArea.innerHTML = '<div class="content-loading">加载中...</div>'

  try {
    // O(1) 查找匹配的文档导入
    let rawContent: string | null = null
    const importer = docImportMap.get(path)
    if (importer) {
      rawContent = await importer() as string
    }
    
    if (rawContent === null) {
      throw new Error('File not found: ' + path)
    }

    // Extract title from front matter or first heading
    let title = path.split('/').pop()?.replace('.md', '') || ''
    const fmMatch = rawContent.match(/^\uFEFF?---\s*\ntitle:\s*"([^"]*)"[\s\S]*?---/)
    if (fmMatch) {
      title = fmMatch[1]
    }

    // Parse front matter fields
    const fm = rawContent.match(/^\uFEFF?---\s*\n([\s\S]*?)---/)
    let fmBlock = ''
    if (fm) fmBlock = fm[1]

    const created = fmBlock.match(/created:\s*(.+)/)?.[1]?.trim()
    const modified = fmBlock.match(/modified:\s*(.+)/)?.[1]?.trim()
    const status = fmBlock.match(/status:\s*(.+)/)?.[1]?.trim()
    const tagsMatch = fmBlock.match(/tags:\s*\[([^\]]*)\]/)
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : undefined

    let causalRefs: string[] | undefined
    const causalMatch = fmBlock.match(/causal_refs:\s*\[([^\]]*)\]/)
    if (causalMatch) {
      const raw = causalMatch[1]
      causalRefs = raw.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }

    // Strip YAML front matter for rendering (handle BOM)
    const contentWithoutFM = rawContent.replace(/^\uFEFF?---[\s\S]*?---\n*/, '')
    
    const doc: DocEntry = {
      path,
      title,
      content: contentWithoutFM,
      causalRefs,
      created,
      modified,
      tags,
      status,
    }
    
    docs.set(path, doc)
    buildRefsBy()
    currentDoc = doc
    await renderContent(doc)
    updateActiveStates(path)
  } catch (err) {
    contentArea.innerHTML = `<div class="content-error">
      <h3>无法加载文档</h3>
      <p>${path}</p>
      <p style="color: var(--text-secondary)">该文档可能尚未创建或文件路径不正确。</p>
    </div>`
  }
}

function replaceRubyMarkers(html: string): string | Promise<string> {
  // 两个标记都没出现 → 直接返回，避免无谓的 async 包装
  const hasShort = /\{\{ruby:/.test(html);
  const hasLong = /\(\(\(\(/.test(html);
  if (!hasShort && !hasLong) return html;

  // `((((...))))` 四括号 → 整句/段落级混写（中文 + 哈吉语混排）
  // 内部换行、标点都保留，只有拉丁字母会被当作哈吉语做注音
  return import('./ruby').then(({ buildTermRuby, buildSentenceRuby }) => {
    let out = html;
    if (hasLong) {
      // 用非贪婪的 `((((` 到 `))))` 配对，保留内部空白
      out = out.replace(/\(\(\(\(([\s\S]*?)\)\)\)\)/g, (_, inner) =>
        `<span class="haji-sentence">${buildSentenceRuby(inner)}</span>`
      );
    }
    if (hasShort) {
      out = out.replace(/\{\{ruby:([^}]+)\}\}/g, (_, term) => buildTermRuby(term));
    }
    return out;
  });
}

async function renderContent(doc: DocEntry) {
  let html = (marked.parse(doc.content) as string).replace(/<img /g, '<img loading="lazy" ');
  html = await replaceRubyMarkers(html);

  if (doc.path === 'home.md') {
    contentArea.innerHTML = `<div class="home-content">${html}</div>`
    scanAndRenderBadges(contentArea, doc.path)
    expandAndHighlightNav(doc.path)
    return
  }

  const chClass = chapterClassForPath(doc.path)

  contentArea.innerHTML = `
    <h1 class="content-title ${chClass}">${doc.title}</h1>
    ${renderDocMeta(doc)}
    ${renderCausalBar(doc)}
    <div class="content-body">${html}</div>
    ${renderPrevNext(doc.path)}
  `
  scanAndRenderBadges(contentArea, doc.path)
  expandAndHighlightNav(doc.path)

  // 搜索命中高亮：如果是从搜索结果跳转过来，给第一个命中处加脉冲提示
  if (pendingHighlightQuery) {
    const q = pendingHighlightQuery
    pendingHighlightQuery = null
    requestAnimationFrame(() => highlightSearchHit(contentArea, q))
  }
}

// 关联文档点击委托（绑定在 contentArea 上）
contentArea.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('causal-link')) {
    const path = target.dataset.causalPath
    if (path) loadDocument(path)
    return
  }
  // 上一篇/下一篇点击委托
  const navLink = target.closest('[data-nav-path]') as HTMLElement | null
  if (navLink) {
    const path = navLink.dataset.navPath
    if (path) loadDocument(path)
  }
})

// 全局 ruby-clickable 点击委托（作用于 content-area 和 changes-panel 等所有位置的 ruby 元素）
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (!target) return
  const rubyEl = target.closest('.ruby-clickable') as HTMLElement | null
  if (rubyEl && rubyEl.hasAttribute('data-syl')) {
    e.preventDefault()
    e.stopPropagation()
    showRubyPicker(rubyEl)
    return
  }
})

// --- ruby 选字 Picker ---

let rubyPicker: HTMLElement | null = null

function closeRubyPicker() {
  if (rubyPicker) {
    rubyPicker.remove()
    rubyPicker = null
  }
}

function showRubyPicker(rubyEl: HTMLElement) {
  closeRubyPicker()
  const sylAttr = rubyEl.getAttribute('data-syl') || ''
  const firstSyl = sylAttr.split(' ')[0]
  const options = getHanOptions(firstSyl)
  if (options.length === 0) return

  const syls = sylAttr.split(' ').filter(Boolean)

  const panel = document.createElement('div')
  panel.className = 'haji-picker'

  const title = document.createElement('div')
  title.className = 'haji-picker-title'
  title.textContent = `选字：${sylAttr}`
  panel.appendChild(title)

  // 候选字 — 默认"只改当前元素"
  const row = document.createElement('div')
  row.className = 'haji-picker-row'

  // 当前每个音节的显示字（决定 active 样式）
  const currentDisplay = syls.map(s => getHanForElement(rubyEl, s))
  const firstDisplay = currentDisplay[0] || ''

  options.forEach(ch => {
    const btn = document.createElement('button')
    btn.className = 'haji-picker-char'
    btn.textContent = ch
    if (firstDisplay === ch) btn.classList.add('active')
    btn.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      // 只改当前元素：对每个音节写 data-local-han-<syl>
      syls.forEach(s => {
        rubyEl.setAttribute(`data-local-han-${s}`, ch)
      })
      refreshAllRuby()
      closeRubyPicker()
    })
    row.appendChild(btn)
  })

  panel.appendChild(row)

  // 操作按钮行 — 全改 / 恢复当前 / 全恢复
  const actionRow = document.createElement('div')
  actionRow.className = 'haji-picker-actions'

  const applyAllBtn = document.createElement('button')
  applyAllBtn.className = 'haji-picker-action'
  applyAllBtn.textContent = `✱ 全改「${firstDisplay}」到全局`
  applyAllBtn.title = '把所有相同音节的 ruby 都改成这个字（作为全局默认）'
  applyAllBtn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    syls.forEach(s => setHanChoice(s, firstDisplay))
    // 清理所有元素上这些音节的局部选择
    document.querySelectorAll('.ruby-clickable').forEach(el => {
      for (const s of syls) el.removeAttribute(`data-local-han-${s}`)
    })
    refreshAllRuby()
    closeRubyPicker()
  })
  actionRow.appendChild(applyAllBtn)

  const resetCurBtn = document.createElement('button')
  resetCurBtn.className = 'haji-picker-action'
  resetCurBtn.textContent = '↩ 恢复当前元素默认'
  resetCurBtn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    clearLocalHan(rubyEl, syls)
    refreshAllRuby()
    closeRubyPicker()
  })
  actionRow.appendChild(resetCurBtn)

  panel.appendChild(actionRow)

  document.body.appendChild(panel)
  rubyPicker = panel

  // 定位
  const rect = rubyEl.getBoundingClientRect()
  const top = rect.bottom + window.scrollY + 4
  const left = rect.left + window.scrollX
  panel.style.top = top + 'px'
  panel.style.left = left + 'px'
  requestAnimationFrame(() => {
    const p = rubyPicker
    if (!p) return
    const w = p.offsetWidth
    const h = p.offsetHeight
    if (left + w > window.innerWidth - 8) {
      p.style.left = Math.max(8, window.innerWidth - w - 8) + 'px'
    }
    if (top + h > window.scrollY + window.innerHeight - 8) {
      p.style.top = Math.max(8, rect.top + window.scrollY - h - 4) + 'px'
    }
  })
}

// 懒加载 toHan（与 ruby.ts 的 toHan 行为一致：先查 userChoices，再查 defaultA）
let toHan: (s: string) => string = (s: string) => s
import('./ruby').then(mod => { toHan = mod.toHan })

function refreshAllRuby() {
  document.querySelectorAll('.ruby-clickable').forEach(el => {
    const sylAttr = el.getAttribute('data-syl')
    if (!sylAttr) return
    const syls = sylAttr.split(' ')
    const rubyRoot = el as HTMLElement

    // 清除 ruby 内非 rt 的节点，重新用 getHanForElement 生成汉字
    const toRemove: Node[] = []
    rubyRoot.childNodes.forEach(node => {
      if ((node as HTMLElement).tagName && (node as HTMLElement).tagName.toLowerCase() === 'rt') return
      toRemove.push(node)
    })
    toRemove.forEach(n => rubyRoot.removeChild(n))
    const newHan = syls.map(s => getHanForElement(rubyRoot, s)).join('')
    rubyRoot.insertBefore(document.createTextNode(newHan), rubyRoot.firstChild)
  })
}

// --- Annotate button hover/tap 绑定（只在初始化时调用一次） ---

/** 渲染关联文档横条 */
function renderCausalBar(doc: DocEntry): string {
  const refs = doc.causalRefs
  const refsBy = doc.refsBy
  if (!refs && !refsBy) return ''

  const items: string[] = []
  if (refs && refs.length > 0) {
    const refTitles = refs.map(r => {
      const refDoc = docs.get(r)
      const displayName = refDoc ? refDoc.title : r.split('/').pop()?.replace('.md', '') || r
      return `<a class="causal-link" data-causal-path="${escapeHtml(r)}">${escapeHtml(displayName)}</a>`
    }).join('、')
    items.push(`<span class="causal-label">引用</span> ${refTitles}`)
  }
  if (refsBy && refsBy.length > 0) {
    const refTitles = refsBy.map(r => {
      const refDoc = docs.get(r)
      const displayName = refDoc ? refDoc.title : r.split('/').pop()?.replace('.md', '') || r
      return `<a class="causal-link" data-causal-path="${escapeHtml(r)}">${escapeHtml(displayName)}</a>`
    }).join('、')
    items.push(`<span class="causal-label">被引用</span> ${refTitles}`)
  }

  return `<div class="causal-bar">${items.join(' <span class="causal-sep">|</span> ')}</div>`
}

/** 从文档路径提取章节名 */
function getChapterName(path: string): string {
  const parts = path.split('/')
  if (parts.length >= 1) {
    const first = parts[0]
    const match = first.match(/^\d{2}_(.+)/)
    if (match) return match[1]
    return first
  }
  return '其他'
}

/** 章节色彩映射：14个章节 → 微妙的强调色 */
const chapterColors: Record<string, string> = {
  '00': '163, 140, 190',  // 项目总览 — 淡紫灰
  '01': '100, 140, 200',  // 世界核心 — 蓝
  '02': '80, 160, 120',   // 地理 — 绿
  '03': '190, 140, 80',   // 历史 — 金棕
  '04': '180, 110, 110',  // 种族 — 暖红
  '05': '170, 120, 180',  // 文化 — 紫
  '06': '130, 100, 170',  // 政治 — 深紫
  '07': '100, 150, 180',  // 经济 — 青灰
  '08': '200, 130, 80',   // 力量 — 橙
  '09': '150, 120, 160',  // 角色 — 暗紫
  '10': '120, 150, 130',  // 叙事 — 灰绿
  '11': '160, 120, 100',  // 模组 — 棕
  '12': '140, 140, 140',  // 附录 — 中性灰
  '13': '180, 100, 140',  // 因果律 — 玫红
}

function chapterClassForPath(path: string): string {
  const parts = path.split('/')
  const chNum = parts[0].match(/^(\d{2})_/)?.[1]
  return chNum ? `ch-${chNum}` : ''
}

function chapterColorForPath(path: string): string {
  const parts = path.split('/')
  const chNum = parts[0].match(/^(\d{2})_/)?.[1]
  return chNum && chapterColors[chNum] ? chapterColors[chNum] : chapterColors['00']
}
void chapterColorForPath // 保留以备因果链图等视觉渲染使用

/** 渲染 front matter 信息条 */
function renderDocMeta(doc: DocEntry): string {
  const idx = flatDocPaths.indexOf(doc.path)
  const total = flatDocPaths.length
  const ordinal = idx >= 0 ? `第 ${idx + 1} / ${total} 篇` : ''

  const parts: string[] = []
  if (doc.created) parts.push(`创建于 ${doc.created}`)
  if (doc.modified) parts.push(`已修改 ${doc.modified}`)
  if (doc.tags && doc.tags.length > 0) parts.push(doc.tags.map(t => `#${t}`).join(' '))
  if (doc.status) {
    const statusLabel: Record<string, string> = { draft: '草稿', review: '审阅中', final: '定稿' }
    const label = statusLabel[doc.status] || doc.status
    parts.push(`<span class="meta-status meta-status-${doc.status}">${label}</span>`)
  }

  const meta = parts.length > 0 ? `<div class="doc-meta">${parts.join(' · ')}</div>` : ''
  if (!ordinal) return meta

  return `<div class="doc-ordinal">${ordinal}</div>${meta}`
}

/** 渲染底部上一篇/下一篇导航 */
function renderPrevNext(currentPath: string): string {
  const idx = flatDocPaths.indexOf(currentPath)
  if (idx === -1) return ''

  const prevPath = idx > 0 ? flatDocPaths[idx - 1] : null
  const nextPath = idx < flatDocPaths.length - 1 ? flatDocPaths[idx + 1] : null
  if (!prevPath && !nextPath) return ''

  let prevHtml = ''
  let nextHtml = ''

  if (prevPath) {
    const prevTitle = docs.get(prevPath)?.title || prevPath.split('/').pop()?.replace('.md', '') || prevPath
    prevHtml = `<a class="prevnext-link prevnext-prev" data-nav-path="${escapeHtml(prevPath)}">
      <span class="prevnext-label">← 上一篇</span>
      <span class="prevnext-title">${escapeHtml(prevTitle)}</span>
    </a>`
  }
  if (nextPath) {
    const nextTitle = docs.get(nextPath)?.title || nextPath.split('/').pop()?.replace('.md', '') || nextPath
    nextHtml = `<a class="prevnext-link prevnext-next" data-nav-path="${escapeHtml(nextPath)}">
      <span class="prevnext-label">下一篇 →</span>
      <span class="prevnext-title">${escapeHtml(nextTitle)}</span>
    </a>`
  }

  return `<nav class="prevnext-nav">
    <div class="prevnext-left">${prevHtml}</div>
    <div class="prevnext-right">${nextHtml}</div>
  </nav>`
}

// --- Annotate button hover/tap 绑定（只在初始化时调用一次） ---
// 所有可见性判断、位置计算都在 bindAnnotateZones 内部处理（单一状态源）。
function initAnnotateHoverSystem(): void {
  // 为内容区域绑定 annotate 按钮
  bindAnnotateZones(contentArea, ANNOTATABLE_SELECTOR, () => {
    return currentDoc?.path || ''
  })
}

/**
 * Update active states: highlight matching nav-link AND section-header.
 * Only expand ancestor sections of the loaded doc — never touch other sections.
 */
function updateActiveStates(path: string) {
  // 1. Clear old active states (only on currently active elements — fast)
  document.querySelectorAll('.nav-link.active').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.nav-section-header.active').forEach(el => el.classList.remove('active'))

  // 2. Find and highlight the matching nav-link
  const links = document.querySelectorAll('.nav-link')
  let activeEl: Element | null = null
  for (const link of links) {
    if ((link as HTMLAnchorElement).href.includes(encodeURIComponent(path))) {
      link.classList.add('active')
      activeEl = link
      break
    }
  }

  // 3. If this is an overview doc, also highlight the matching section header
  if (activeEl) {
    // Expand ancestor sections only
    let parent: HTMLElement | null = activeEl.closest('.nav-section')
    while (parent) {
      parent.classList.remove('collapsed')
      parent = (parent.parentElement?.closest('.nav-section') as HTMLElement) || null
    }
  } else {
    // Could be an overview doc — find section header by name
      for (const item of findAllItems(directoryTree)) {
        if (item.overview === path) {
          const headers = document.querySelectorAll('.nav-section-header')
          for (const h of headers) {
            if ((h as HTMLElement).dataset.name === item.name) {
              h.classList.add('active')
              // Expand ancestors, but NOT the section containing this header
              let parent: HTMLElement | null = (h.parentElement?.parentElement?.closest('.nav-section') as HTMLElement) || null
              while (parent) {
                parent.classList.remove('collapsed')
                parent = (parent.parentElement?.closest('.nav-section') as HTMLElement) || null
              }
              break
            }
          }
          break
        }
      }
  }
}

/**
 * Flatten all NavItems (recursively) for lookup.
 */
function findAllItems(items: NavItem[]): NavItem[] {
  const result: NavItem[] = []
  for (const item of items) {
    result.push(item)
    if (item.children) {
      result.push(...findAllItems(item.children))
    }
  }
  return result
}

/**
 * 找到目标 path 对应的项以及它的所有祖先分组（从上到下，根到父）
 */
function findItemAndAncestors(items: NavItem[], targetPath: string): NavItem[] {
  const path: NavItem[] = []
  function dfs(level: NavItem[]): boolean {
    for (const item of level) {
      path.push(item)
      // 是否是目标 leaf？
      if (!item.children && item.path === targetPath) return true
      // 是否是目标 section（overview）？
      if (item.overview === targetPath) return true
      // 向下递归子项
      if (item.children && dfs(item.children)) return true
      // 不是这条路径，回溯
      path.pop()
    }
    return false
  }
  dfs(items)
  return path
}

/**
 * 展开左侧导航到目标 path，并高亮目标项（加脉冲动画），滚动到可见区域
 */
function expandAndHighlightNav(path: string) {
  const navTreeEl = document.getElementById('nav-tree')!
  // 先重新渲染一次（确保 active/高亮能更新），然后处理展开+高亮
  renderNavTree(directoryTree, navTreeEl)

  const allItems = findAllItems(directoryTree)
  const ancestors = findItemAndAncestors(directoryTree, path)
  const sections = navTreeEl.querySelectorAll<HTMLElement>('.nav-section') as NodeListOf<HTMLElement>
  const headers = navTreeEl.querySelectorAll<HTMLElement>('.nav-section-header') as NodeListOf<HTMLElement>
  const links = navTreeEl.querySelectorAll<HTMLElement>('.nav-link') as NodeListOf<HTMLElement>

  // 展开所有祖先分组
  for (const item of ancestors) {
    if (!item.children) continue // leaf，跳过
    // 找对应 section，移除 collapsed
    for (const sec of sections) {
      const h = sec.querySelector('.nav-section-header') as HTMLElement | null
      if (h && h.dataset.name === item.name) {
        sec.classList.remove('collapsed')
        break
      }
    }
  }

  // 找到目标项
  const targetItem = allItems.find(i => i.path === path || i.overview === path)
  if (!targetItem) return

  // 找到目标元素（link 或 section-header）
  let targetEl: HTMLElement | null = null
  for (const link of links) {
    if (link.textContent?.trim() === targetItem.name) {
      targetEl = link
      break
    }
  }
  if (!targetEl && targetItem.overview) {
    for (const header of headers) {
      if (header.dataset.name === targetItem.name) {
        targetEl = header
        break
      }
    }
  }

  if (targetEl) {
    // 滚动到可见区域
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // 加永久高亮（不消失）
    targetEl.classList.add('nav-pulse')
    // 章节色彩：给 active 项加章节 class
    const chClass = chapterClassForPath(path)
    if (chClass) {
      targetEl.classList.add(chClass)
    }
  }
}

// --- 回到顶部按钮 ---
const backToTopBtn = document.createElement('button')
backToTopBtn.className = 'back-to-top'
backToTopBtn.setAttribute('aria-label', '回到顶部')
backToTopBtn.title = '回到顶部'
backToTopBtn.innerHTML = '↑'
document.body.appendChild(backToTopBtn)

let backToTopVisible = false
function updateBackToTop() {
  const show = contentArea.scrollTop > window.innerHeight * 0.6
  if (show !== backToTopVisible) {
    backToTopVisible = show
    backToTopBtn.classList.toggle('visible', show)
  }
}
contentArea.addEventListener('scroll', updateBackToTop, { passive: true })
backToTopBtn.addEventListener('click', () => {
  contentArea.scrollTo({ top: 0, behavior: 'smooth' })
})

// --- Search ---
const searchResultsEl = document.getElementById('search-results')!
let searchIndexReady = false
let selectIdx = -1

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim()
  renderNavTree(directoryTree, navTree, query)

  if (query.length >= 1) {
    doFullTextSearch(query)
  } else {
    hideSearchResults()
  }
})

searchInput.addEventListener('focus', () => {
  const query = searchInput.value.trim()
  if (query.length >= 1) {
    doFullTextSearch(query)
  }
})

searchInput.addEventListener('keydown', (e) => {
  const items = searchResultsEl.querySelectorAll<HTMLElement>('.search-result-item')
  if (items.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectIdx = Math.min(selectIdx + 1, items.length - 1)
    updateSearchSelection(items)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectIdx = Math.max(selectIdx - 1, 0)
    updateSearchSelection(items)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectIdx >= 0 && selectIdx < items.length) {
      const path = items[selectIdx].dataset.path
      if (path) {
        pendingHighlightQuery = searchInput.value.trim()
        hideSearchResults()
        loadDocument(path)
      }
    }
  } else if (e.key === 'Escape') {
    hideSearchResults()
  }
})

// 点击 picker 外部关闭
document.addEventListener('mousedown', (e) => {
  if (!rubyPicker) return
  const target = e.target as Node
  if (!rubyPicker.contains(target) && !(target as HTMLElement).closest('.ruby-clickable')) {
    closeRubyPicker()
  }
})

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (!target.closest('.search-area')) {
    hideSearchResults()
  }
})

async function doFullTextSearch(query: string) {
  if (!searchIndexReady) {
    searchResultsEl.style.display = 'block'
    searchResultsEl.innerHTML = '<div class="search-result-empty">正在建立搜索索引…</div>'
    await buildIndex(docs, allMdImports)
    searchIndexReady = true
  }

  const results = search(query, 10)
  selectIdx = -1

  if (results.length === 0) {
    searchResultsEl.style.display = 'block'
    searchResultsEl.innerHTML = '<div class="search-result-empty">未找到匹配的文档</div>'
    return
  }

  searchResultsEl.style.display = 'block'
  
  // 按章节分组
  const grouped: Map<string, typeof results> = new Map()
  for (const r of results) {
    const ch = getChapterName(r.path)
    if (!grouped.has(ch)) grouped.set(ch, [])
    grouped.get(ch)!.push(r)
  }

  let html = ''
  for (const [chapter, items] of grouped) {
    html += `<div class="search-group-header">${escapeHtml(chapter)}（${items.length} 条结果）</div>`
    html += items.map((r, i) => `
    <div class="search-result-item" data-path="${escapeHtml(r.path)}" data-idx="${i}">
      <div class="search-result-title">${escapeHtml(r.title)}</div>
      <div class="search-result-snippet">${highlightMatch(r.snippet, query)}</div>
    </div>`).join('')
  }
  
  searchResultsEl.innerHTML = html

  searchResultsEl.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const path = (el as HTMLElement).dataset.path
      if (path) {
        pendingHighlightQuery = searchInput.value.trim() // 记下当前关键词，给 renderContent 用
        hideSearchResults()
        loadDocument(path)
      }
    })
  })
}

function updateSearchSelection(items: NodeListOf<HTMLElement>) {
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === selectIdx)
    if (i === selectIdx) el.scrollIntoView({ block: 'nearest' })
  })
}

function hideSearchResults() {
  searchResultsEl.style.display = 'none'
  selectIdx = -1
}

function escapeHtml(text: string): string {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

function highlightMatch(text: string, query: string): string {
  const escaped = escapeHtml(text)
  const escapedQ = escapeHtml(query)
  const regex = new RegExp(`(${escapedQ.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi')
  return escaped.replace(regex, '<mark>$1</mark>')
}

/**
 * 在当前文档中，为搜索关键词的第一个命中处添加脉冲高亮（类似变更记录的视觉反馈）
 * 1. 找到包含关键词的最深层块级元素（p / li / td / div.content-body 等）
 * 2. 平滑滚动到它的可视区
 * 3. 加 CSS 动画脉冲高亮
 */
function highlightSearchHit(root: HTMLElement, query: string): void {
  if (!query) return
  const norm = query.toLowerCase()

  // 候选容器：正文段落中包含关键词的元素
  const selectors = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, div.content-body > *'
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(selectors))

  let hit: HTMLElement | null = null
  for (const el of candidates) {
    // 忽略嵌套：如果子元素也在候选里，优先匹配更内层的元素
    const text = el.textContent || ''
    if (text.toLowerCase().includes(norm)) {
      const hasInnerMatch = Array.from(el.querySelectorAll<HTMLElement>(selectors)).some((child) => {
        return (child.textContent || '').toLowerCase().includes(norm)
      })
      if (!hasInnerMatch) {
        hit = el
        break
      }
    }
  }

  // 回退：找不到段落级元素，就把整个内容区作为高亮容器
  if (!hit) {
    const fallback = root.querySelector<HTMLElement>('div.content-body, div.home-content')
    if (fallback) hit = fallback
  }

  if (!hit) return

  hit.scrollIntoView({ behavior: 'smooth', block: 'center' })
  hit.classList.add('search-hit-highlight')
  window.setTimeout(() => hit?.classList.remove('search-hit-highlight'), 2800)
}

// --- 跨文档定位：当变更面板「定位」按钮按下且目标文档不在当前显示时，自动切换文档
window.addEventListener('change-locate-doc', ((ev: CustomEvent) => {
  const { docPath, noteId } = (ev.detail || {}) as { docPath: string; noteId?: string }
  if (!docPath) return
  // 如果当前已渲染这个文档则忽略
  if (currentDoc && currentDoc.path === docPath) {
    if (noteId) scrollToNoteInContent(noteId)
    // 展开并高亮左侧导航（防止之前被折叠）
    expandAndHighlightNav(docPath)
    return
  }
  // 尝试按 path 匹配并加载
  loadDocument(docPath)
  // 文档加载是异步的（import.meta.glob），等一次 render 之后再滚动并高亮
  setTimeout(() => {
    if (noteId && currentDoc && currentDoc.path === docPath) {
      scrollToNoteInContent(noteId)
    }
  }, 200)
  ev.preventDefault()
}) as EventListener)

// --- 同文档定位时展开左侧导航（监听 change-expand-nav 事件）---
window.addEventListener('change-expand-nav', ((ev: CustomEvent) => {
  const { docPath } = (ev.detail || {}) as { docPath?: string }
  if (!docPath) return
  expandAndHighlightNav(docPath)
}) as EventListener)

// --- Init ---
buildFlatDocPaths()
renderNavTree(directoryTree, navTree)
initChangesSystem()
initAnnotateHoverSystem()
// 初始自动加载主页
loadDocument('home.md')

// --- 屏蔽浏览器返回手势（含 iOS Safari 左滑返回） ---
history.pushState(null, '', location.href)
window.addEventListener('popstate', () => {
  history.pushState(null, '', location.href)
})

// --- Sidebar Title Click: Return to Home Page ---
const sidebarTitle = document.querySelector('.sidebar-title') as HTMLElement
if (sidebarTitle) {
  sidebarTitle.addEventListener('click', () => {
    loadDocument('home.md')
  })
}

// ============================================================
// 名字系统：你还记得你的名字吗？
// ============================================================
// 设计思路：
//   - "当然记得" → 用户立刻输入名字 → 存 localStorage → 仪式感反馈
//   - "我是谁" → 不强迫命名 → 标注 author 暂用"匿名旅人"
//   - "我是谁"用户导出时 → 弹"命运已至"命名对话框 → 第一次拥有名字
// 为什么导出时才命名？因为导出意味着"把自己的思考发出去"——那一刻需要一个身份。
// 同时，用户的名字会写进导出的 JSON 文件。以后就算缓存被清，他发给别人的文件里有他的名字。

function randomPoeticName(): string {
  const words = ['森林', '星辰', '夜风', '月光', '潮汐', '旅人', '萤火', '晨雾', '残雪', '远山', '微光', '潮汐', '流浪', '追梦者', '星尘', '孤舟']
  const nums = Math.floor(Math.random() * 90) + 10
  return words[Math.floor(Math.random() * words.length)] + nums
}

// 通用：显示"启示性文字"——一行神秘/仪式感的文字，慢慢淡出
function showRevelation(text: string, onDone?: () => void): void {
  const existing = document.querySelector('.revelation-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'revelation-overlay'
  overlay.innerHTML = `<div class="revelation-text">${text}</div>`
  document.body.appendChild(overlay)

  // 强制触发 reflow 以启动动画
  requestAnimationFrame(() => overlay.classList.add('show'))

  setTimeout(() => {
    overlay.classList.add('fade-out')
    setTimeout(() => {
      overlay.remove()
      onDone?.()
    }, 800)
  }, 1600)
}

// 阶段 A：首次进入——"请问……你还记得你的名字吗？"
function showIdentityDialog(onFinished?: () => void): void {
  const existing = document.querySelector('.identity-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'identity-overlay'

  let currentStage: 'ask' | 'named' | 'anon' = 'ask'

  function render(): void {
    if (currentStage === 'ask') {
      overlay.innerHTML = `
        <div class="identity-dialog identity-dialog-ask">
          <div class="identity-title">请问……你还记得你的名字吗？</div>
          <div class="identity-buttons">
            <button class="identity-btn identity-btn-primary" data-choice="named">当然记得！</button>
            <button class="identity-btn" data-choice="anon">我是……谁？</button>
          </div>
        </div>`
      const btns = overlay.querySelectorAll('[data-choice]')
      btns.forEach(b => b.addEventListener('click', () => {
        const choice = (b as HTMLElement).dataset.choice
        if (choice === 'named') {
          currentStage = 'named'
          render()
        } else {
          // "我是谁" → 直接给一句诗，然后结束
          currentStage = 'anon'
          setSourceName('') // 清空
          render()
        }
      }))
    } else if (currentStage === 'named') {
      overlay.innerHTML = `
        <div class="identity-dialog">
          <div class="identity-title">告诉我你的名字</div>
          <div class="identity-input-row">
            <input type="text" id="identity-name-input" placeholder="你的名字……" maxlength="20" />
            <button class="identity-btn identity-btn-primary" id="identity-confirm">确定</button>
          </div>
          <div class="identity-hint">这个名字会写进你导出的存档，帮你在多份标注中被识别。</div>
          <div class="identity-buttons" style="margin-top:10px;">
            <button class="identity-btn" id="identity-back-to-anon">算了，我不记得了</button>
          </div>
        </div>`
      const input = overlay.querySelector('#identity-name-input') as HTMLInputElement
      const confirm = overlay.querySelector('#identity-confirm') as HTMLElement
      const backBtn = overlay.querySelector('#identity-back-to-anon') as HTMLElement
      input.focus()
      backBtn.addEventListener('click', () => {
        currentStage = 'anon'
        setSourceName('')
        render()
      })
      const doConfirm = () => {
        const name = input.value.trim()
        if (!name) {
          input.classList.add('shake')
          setTimeout(() => input.classList.remove('shake'), 600)
          return
        }
        setSourceName(name)
        localStorage.setItem('identity-asked', '1')
        overlay.classList.add('fade-out')
        setTimeout(() => overlay.remove(), 280)
        showRevelation('你拥有坚韧的灵魂！', onFinished)
      }
      confirm.addEventListener('click', doConfirm)
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doConfirm()
      })
    } else {
      // anon → 显示一句启示性文字后结束
      overlay.innerHTML = `
        <div class="identity-dialog identity-dialog-revelation">
          <div class="identity-title identity-title-soft">
            没关系，命运到来之时，<br/>它必将再度示现。
          </div>
          <div class="identity-buttons">
            <button class="identity-btn identity-btn-primary" id="identity-anon-close">好的</button>
          </div>
        </div>`
      overlay.querySelector('#identity-anon-close')!.addEventListener('click', () => {
        dismiss()
      })
    }
  }

  function dismiss(): void {
    localStorage.setItem('identity-asked', '1')
    overlay.classList.add('fade-out')
    setTimeout(() => {
      overlay.remove()
      onFinished?.()
    }, 280)
  }

  render()
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))
}

// 阶段 B："我是谁"用户导出时——"命运已至！他名即为——"
// 触发时机：changes.ts 中点击批量下载但还没名字时
// 派发 'author-named'（让 changes.ts 批量更新"匿名旅人"为新名字）
// 再派发 'identity-ready'（让 changes.ts 执行导出）
// 返回用户（已匿名导出过）标题变为"你找回你的名字了吗？"
// 并多一个勾选框"我早已不再迷茫。"
function showNameForExportDialog(): void {
  const existing = document.querySelector('.identity-overlay')
  if (existing) existing.remove()

  const hasExportedAnon = !!localStorage.getItem('anon-export-count') &&
    parseInt(localStorage.getItem('anon-export-count') || '0', 10) > 0

  const overlay = document.createElement('div')
  overlay.className = 'identity-overlay'

  function dismiss(): void {
    localStorage.setItem('identity-asked', '1')
    overlay.classList.add('fade-out')
    setTimeout(() => overlay.remove(), 280)
  }

  overlay.innerHTML = `
    <div class="identity-dialog">
      <div class="identity-title identity-title-mystic">${hasExportedAnon ? '你找回你的名字了吗？' : '命运已至！他名即为——'}</div>
      <div class="identity-input-row">
        <input type="text" id="identity-export-input" placeholder="输入名字……" maxlength="20" />
        <button class="identity-btn" id="identity-export-random" title="随机生成一个">?</button>
        <button class="identity-btn identity-btn-primary" id="identity-export-confirm">就是他</button>
      </div>
      <div class="identity-hint">命名后，你所写的每一条标注都会拥有这个名字。它将写进你即将导出的存档。</div>
      ${hasExportedAnon ? `<label style="display:flex; align-items:center; gap:8px; margin-top:12px; justify-content:center; font-size:12px; color:#6b5a80; cursor:pointer;">
        <input type="checkbox" id="identity-found-check" />
        我早已不再迷茫。
      </label>` : ''}
      <div class="identity-buttons" style="margin-top:14px;">
        <button class="identity-btn" id="identity-export-anon">不，那不是我</button>
      </div>
    </div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))

  const input = overlay.querySelector('#identity-export-input') as HTMLInputElement
  const randomBtn = overlay.querySelector('#identity-export-random') as HTMLElement
  const confirmBtn = overlay.querySelector('#identity-export-confirm') as HTMLElement
  const anonBtn = overlay.querySelector('#identity-export-anon') as HTMLElement
  input.focus()

  randomBtn.addEventListener('click', () => {
    input.value = randomPoeticName()
    input.focus()
    input.select()
  })

  function doConfirm(): void {
    const name = input.value.trim()
    if (!name) {
      input.classList.add('shake')
      setTimeout(() => input.classList.remove('shake'), 600)
      return
    }
    setSourceName(name)
    const checkEl = document.getElementById('identity-found-check') as HTMLInputElement | null
    const checkOn = hasExportedAnon && checkEl?.checked
    dismiss()
    window.dispatchEvent(new CustomEvent('author-named', { detail: { name } }))
    setTimeout(() => {
      showRevelation(checkOn ? `这是你的命运，亦是你的第一份契约，名叫${name}的人` : '这是你的命运，亦是你的第一份契约', () => {
        window.dispatchEvent(new CustomEvent('identity-ready'))
      })
    }, 320)
  }

  function doAnon(): void {
    const neverAgain = hasExportedAnon && (document.getElementById('identity-found-check') as HTMLInputElement)?.checked
    if (neverAgain) {
      localStorage.setItem('anon-export-never-ask', '1')
      localStorage.setItem('anon-upgraded', '1')
    }
    const count = parseInt(localStorage.getItem('anon-export-count') || '0', 10) + 1
    localStorage.setItem('anon-export-count', String(count))
    dismiss()
    setTimeout(() => {
      showRevelation(neverAgain ? '现在，你既是你的方向，不会迷失的人' : '你的命运果然在自己手中', () => {
        window.dispatchEvent(new CustomEvent('identity-ready'))
      })
    }, 320)
  }

  confirmBtn.addEventListener('click', doConfirm)
  anonBtn.addEventListener('click', doAnon)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doConfirm()
  })
}

// ============================================================
// 名字系统：事件入口
// ============================================================
// 首次进入逻辑内联在初始化流程中（见 main.ts 底部的 showIdentityDialog 调用）
// 这里处理运行时的命名请求："我是谁"用户点导出时命名
// 监听"我是谁"用户导出时的命名请求
window.addEventListener('identity-ensure', ((ev: Event) => {
  if (getSourceName()) {
    window.dispatchEvent(new CustomEvent('identity-ready'))
    ev.preventDefault()
    return
  }
  // 勾选了"我早已不再迷茫"后不再询问
  if (localStorage.getItem('anon-export-never-ask')) {
    window.dispatchEvent(new CustomEvent('identity-ready'))
    ev.preventDefault()
    return
  }
  showNameForExportDialog()
  ev.preventDefault()
}) as EventListener)

// --- 欢迎弹窗（首次自动弹出，之后可通过右上角问号按钮切换）---
function showWelcomeDialog(): void {
  const existing = document.querySelector('.welcome-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'welcome-overlay'

  function dismiss(): void {
    overlay.classList.add('fade-out')
    setTimeout(() => overlay.remove(), 300)
  }

  overlay.innerHTML = `<div class="welcome-dialog">
    <div class="welcome-header">ようこそ (◕‿◕✿)</div>
    <div class="welcome-body">
      <p>在这个世界观设定集中，你可以：</p>
      <ul>
        <li><b>浏览</b> — 左侧导航探索地理、历史、种族、力量体系等设定文档</li>
        <li><b>标注</b> — 悬停任意段落，点击出现的 <strong class="welcome-plus">「+」</strong> 按钮，为段落添加你的笔记、批注和标记</li>
        <li><b>搜索</b> — 顶部搜索框快速定位任何设定内容</li>
        <li><b>追踪变更</b> — 点击右下角的笔形图标，随时记录修改思路、设定演变和待办事项</li>
        <li><b>移动端</b> — 左上角菜单按钮打开导航，拖拽侧边栏右侧把手自由调整宽度</li>
      </ul>
      <div class="welcome-section">
        <p><b>关于「导出存档」</b></p>
        <ul>
          <li><b>本地保存</b> — 将所有标注和变更记录导出为存档，作为你创作数据的备份</li>
          <li><b>为创作者提供内容</b> — 导出的存档可交给维护者，帮助了解读者反馈、改进设定</li>
          <li><b>养成习惯</b> — 每隔一段时间顺手点一下「批量下载」，存档在手，数据不愁</li>
        </ul>
      </div>
      <p class="welcome-disclaimer">（这个网页以及这条弹窗几乎全是 AI 做的，请多包涵他时不时抽风 (￣▽￣*)ゞ）</p>
      <p>希望这里成为你创作旅程的可靠伙伴 (´･ω･\`)ﾉ</p>
      <label class="welcome-never-again">
        <input type="checkbox" id="welcome-never-again" ${localStorage.getItem('welcome-dismissed') ? 'checked' : ''} />
        以后不再自动弹出
      </label>
    </div>
    <div class="welcome-footer">
      <button class="welcome-btn" id="welcome-dismiss">好的，开始探索</button>
    </div>
  </div>`
  document.body.appendChild(overlay)

  // 点遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss()
  })
  // 点按钮关闭
  document.getElementById('welcome-dismiss')!.addEventListener('click', () => {
    const neverAgain = (document.getElementById('welcome-never-again') as HTMLInputElement)?.checked
    if (neverAgain) {
      localStorage.setItem('welcome-dismissed', '1')
    } else {
      localStorage.removeItem('welcome-dismissed')
    }
    dismiss()
  })
}

// 名字系统：启示文字与欢迎弹窗分离
// 启示文字（"我还没忘记你" / "你会去往何方"）每次访问都显示
// 欢迎弹窗仅在被勾选"不再自动弹出"时跳过
if (!localStorage.getItem('identity-asked')) {
  showIdentityDialog(() => {
    if (!localStorage.getItem('welcome-dismissed')) {
      setTimeout(showWelcomeDialog, 300)
    }
  })
} else {
  const name = getSourceName()
  const upgraded = !!localStorage.getItem('anon-upgraded')
  const revelationText = name
    ? `我还没忘记你，${name}`
    : upgraded
      ? '我曾见过你，匿名的人'
      : '你会去往何方？无名的旅人'
  showRevelation(revelationText, () => {
    if (!localStorage.getItem('welcome-dismissed')) {
      setTimeout(showWelcomeDialog, 300)
    }
  })
}

// ============================================================
// 右上角工具栏：一个切换按钮 + 展开后的多个功能按钮
// 新工具 → toolsCatalog 数组里加一行
// ============================================================
function initToolIndex(): void {
  const wrap = document.createElement('div')
  wrap.className = 'tool-bar-wrap'

  // 切换按钮
  const toggle = document.createElement('button')
  toggle.className = 'tool-bar-toggle'
  toggle.innerHTML = '◈'
  toggle.setAttribute('aria-label', '工具栏')
  toggle.title = '工具栏'

  // 按钮列表（从上到下：功能说明 → 哈吉文工具 → 设置）
  const buttons = [
    {
      id: 'help',
      icon: '?',
      name: '功能说明',
      action: () => {
        const existing = document.querySelector('.welcome-overlay')
        if (existing) {
          existing.classList.add('fade-out')
          setTimeout(() => existing.remove(), 300)
        } else {
          showWelcomeDialog()
        }
      }
    },
    {
      id: 'ruby',
      icon: '\uE4CB', // HaJi 字体 PUA 字符 → 哈吉文工具
      name: '哈吉文工具',
      action: () => window.open('./ruby-demo.html', '_blank')
    },
    {
      id: 'settings',
      icon: '⚙',
      name: '设置',
      action: () => loadSettingsPage()
    }
  ]

  const panel = document.createElement('div')
  panel.className = 'tool-bar-panel'

  buttons.forEach(b => {
    const btn = document.createElement('button')
    btn.className = 'tool-bar-btn tool-bar-btn-' + b.id
    btn.innerHTML = b.icon
    btn.setAttribute('aria-label', b.name)
    btn.title = b.name
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      b.action()
    })
    panel.appendChild(btn)
  })

  wrap.appendChild(toggle)
  wrap.appendChild(panel)
  document.body.appendChild(wrap)

  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = panel.classList.toggle('open')
    toggle.classList.toggle('open', open)
  })

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node)) {
      panel.classList.remove('open')
      toggle.classList.remove('open')
    }
  })
}
initToolIndex()

// 设置页面：在主内容区渲染（类似 home 的独立页面）
function loadSettingsPage(): void {
  if (settingsOpen) {
    if (previousDoc) {
      loadDocument(previousDoc.path)
    }
    settingsOpen = false
    return
  }

  if (currentDoc) {
    scrollPositions.set(currentDoc.path, contentArea.scrollTop)
    previousDoc = currentDoc
  }

  document.querySelectorAll('.nav-link.active').forEach(el => el.classList.remove('active'))
  document.querySelectorAll('.nav-section-header.active').forEach(el => el.classList.remove('active'))

  currentDoc = null
  settingsOpen = true
  contentArea.scrollTop = 0

  const html = `
<div class="settings-page">
  <h1 class="content-title">设置</h1>
  <p class="settings-page-subtitle">世界观阅读器的外观与行为</p>

  <section class="settings-page-section">
    <h2 class="settings-page-section-title">显示</h2>
    <div class="settings-page-row">
      <div class="settings-page-main">
        <label>
          <input type="checkbox" id="setting-lazy-images" checked>
          <span>图片懒加载</span>
        </label>
      </div>
      <div class="settings-page-hint">减少页面初次加载的数据量</div>
    </div>
  </section>

  <section class="settings-page-section">
    <h2 class="settings-page-section-title">搜索</h2>
    <div class="settings-page-row">
      <div class="settings-page-main">
        <label>
          <input type="checkbox" id="setting-fuzzy-search" checked>
          <span>模糊搜索（Fuse.js）</span>
        </label>
      </div>
      <div class="settings-page-hint">启用后支持拼写相近的匹配，关闭时退化为精确子串匹配</div>
    </div>
  </section>

  <section class="settings-page-section">
    <h2 class="settings-page-section-title">字体</h2>
    <div class="settings-page-row">
      <div class="settings-page-main"><strong>哈吉文字体</strong></div>
      <div class="settings-page-hint" id="haji-font-status">检测中...</div>
    </div>
  </section>

  <section class="settings-page-section">
    <h2 class="settings-page-section-title">关于</h2>
    <div class="settings-page-row">
      <div class="settings-page-main"><strong>哈吉语创制计划 · 世界观阅读器</strong></div>
      <div class="settings-page-hint">静态网站 · 无外部依赖 · 所有文档本地加载</div>
    </div>
  </section>
</div>
`
  contentArea.innerHTML = html

  // 哈吉文字体检测（简化版：HajiWen 在 @font-face 中已定义）
  const probe = document.createElement('span')
  probe.style.fontFamily = 'HajiWen, monospace'
  probe.style.fontSize = '72px'
  probe.style.visibility = 'hidden'
  probe.style.position = 'absolute'
  probe.textContent = '\uE000'
  document.body.appendChild(probe)

  setTimeout(() => {
    const fontEl = document.getElementById('haji-font-status')
    if (fontEl) {
      fontEl.textContent = '已加载'
    }
    probe.remove()
  }, 150)
}


// ============================================================
