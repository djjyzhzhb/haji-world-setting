import './style.css'
import { marked } from 'marked'
import { initChangesSystem, bindAnnotateZones, scanAndRenderBadges, scrollToNoteInContent } from './ui/changes'

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
}

// --- Directory structure definition (recursive nesting) ---
const directoryTree: NavItem[] = [
  {
    name: '00 项目总览',
    path: '00_项目总览',
    children: [
      { name: '项目宪章', path: '00_项目总览/00_项目宪章.md' },
      { name: '创作进度', path: '00_项目总览/01_创作进度.md' },
      { name: '版本日志', path: '00_项目总览/02_版本日志.md' },
      { name: '灵感来源与参考', path: '00_项目总览/03_灵感来源与参考.md' },
    ]
  },
  {
    name: '01 世界核心',
    path: '01_世界核心',
    children: [
      { name: '宇宙结构', path: '01_世界核心/01_宇宙结构.md' },
      { name: '创世神话', path: '01_世界核心/02_创世神话.md' },
      { name: '根本法则', path: '01_世界核心/03_根本法则.md' },
      { name: '时间体系', path: '01_世界核心/04_时间体系.md' },
      { name: '维度与位面', path: '01_世界核心/05_维度与位面.md' },
    ]
  },
  {
    name: '02 地理',
    path: '02_地理',
    children: [
      { name: '世界地图与总览', path: '02_地理/01_世界地图与总览.md' },
      { name: '气候带与生态区', path: '02_地理/02_气候带与生态区.md' },
      { name: '自然资源分布', path: '02_地理/03_自然资源分布.md' },
      { name: '交通与贸易路线', path: '02_地理/04_交通与贸易路线.md' },
      {
        name: '大陆A',
        path: '02_地理/05_大陆A',
        overview: '02_地理/05_大陆A/00_大陆A总览.md',
        children: [
          { name: '区域A1', path: '02_地理/05_大陆A/01_区域A1.md' },
          { name: '城市与据点索引', path: '02_地理/05_大陆A/03_城市与据点索引.md' },
        ]
      },
    ]
  },
  {
    name: '03 历史与年表',
    path: '03_历史与年表',
    children: [
      { name: '大年表', path: '03_历史与年表/01_大年表.md' },
      { name: '纪元划分', path: '03_历史与年表/02_纪元划分.md' },
      { name: '因果链图谱', path: '03_历史与年表/04_因果链图谱.md' },
      { name: '未解之谜与空白', path: '03_历史与年表/05_未解之谜与空白.md' },
    ]
  },
  {
    name: '04 种族与生物',
    path: '04_种族与生物',
    children: [
      { name: '智慧种族总览', path: '04_种族与生物/01_智慧种族总览.md' },
      {
        name: '种族A',
        path: '04_种族与生物/02_种族A',
        overview: '04_种族与生物/02_种族A/00_种族A总览.md',
        children: [
          { name: '生理与特性', path: '04_种族与生物/02_种族A/01_生理与特性.md' },
          { name: '文化与习俗', path: '04_种族与生物/02_种族A/02_文化与习俗.md' },
          { name: '历史与起源', path: '04_种族与生物/02_种族A/03_历史与起源.md' },
          { name: '种族关系', path: '04_种族与生物/02_种族A/04_与其他种族的关系.md' },
        ]
      },
      {
        name: '生物图鉴',
        path: '04_种族与生物/04_生物图鉴',
        children: [
          { name: '普通生物', path: '04_种族与生物/04_生物图鉴/01_普通生物.md' },
          { name: '幻想生物', path: '04_种族与生物/04_生物图鉴/02_幻想生物.md' },
          { name: '传说级存在', path: '04_种族与生物/04_生物图鉴/03_传说级存在.md' },
        ]
      },
    ]
  },
  {
    name: '05 文化与社会',
    path: '05_文化与社会',
    children: [
      { name: '语言文化桥梁', path: '05_文化与社会/01_语言文化桥梁.md' },
      { name: '禁忌与伦理', path: '05_文化与社会/06_禁忌与伦理.md' },
    ]
  },
  {
    name: '06 政治与势力',
    path: '06_政治与势力',
    children: [
      { name: '势力总览与关系图', path: '06_政治与势力/01_势力总览与关系图.md' },
    ]
  },
  {
    name: '07 经济与技术',
    path: '07_经济与技术',
    children: [
      { name: '经济体系', path: '07_经济与技术/01_经济体系.md' },
      { name: '产业与生产', path: '07_经济与技术/02_产业与生产.md' },
      { name: '科技与工艺', path: '07_经济与技术/03_科技与工艺.md' },
    ]
  },
  {
    name: '08 力量体系',
    path: '08_力量体系',
    children: [
      { name: '力量体系总论', path: '08_力量体系/01_力量体系总论.md' },
      {
        name: '体系A',
        path: '08_力量体系/02_体系A',
        children: [
          { name: '原理与来源', path: '08_力量体系/02_体系A/01_原理与来源.md' },
          { name: '规则与限制', path: '08_力量体系/02_体系A/02_规则与限制.md' },
          { name: '分类与层级', path: '08_力量体系/02_体系A/03_分类与层级.md' },
          { name: '能力列表', path: '08_力量体系/02_体系A/04_代表性能力列表.md' },
        ]
      },
      { name: '禁忌知识与危险力量', path: '08_力量体系/04_禁忌知识与危险力量.md' },
      { name: '力量与社会', path: '08_力量体系/05_力量与社会.md' },
    ]
  },
  {
    name: '09 角色',
    path: '09_角色',
    children: [
      { name: '角色总索引', path: '09_角色/01_角色总索引.md' },
      { name: '角色关系图谱', path: '09_角色/06_角色关系图谱.md' },
    ]
  },
  {
    name: '10 叙事',
    path: '10_叙事',
    children: [
      { name: '叙事框架', path: '10_叙事/01_叙事框架.md' },
      { name: '潜在叙事种子', path: '10_叙事/04_潜在叙事种子.md' },
      { name: '叙事时间线', path: '10_叙事/06_叙事时间线.md' },
    ]
  },
  {
    name: '11 模组与冒险',
    path: '11_模组与冒险',
    children: [
      { name: '模组总览', path: '11_模组与冒险/01_模组总览.md' },
      { name: '随机遭遇表', path: '11_模组与冒险/05_随机遭遇表.md' },
      { name: '冒险种子库', path: '11_模组与冒险/06_冒险种子库.md' },
    ]
  },
  {
    name: '12 附录与参考',
    path: '12_附录与参考',
    children: [
      { name: '命名规则总表', path: '12_附录与参考/01_命名规则总表.md' },
      { name: '度量衡体系', path: '12_附录与参考/02_度量衡体系.md' },
      { name: '历法换算表', path: '12_附录与参考/03_历法换算表.md' },
      { name: '常用短语与谚语', path: '12_附录与参考/04_常用短语与谚语.md' },
      { name: '参考资料', path: '12_附录与参考/05_参考资料.md' },
      { name: '创作工具推荐', path: '12_附录与参考/06_创作工具推荐.md' },
    ]
  },
  {
    name: '13 因果律与一致性',
    path: '13_因果律与一致性',
    children: [
      { name: '因果律总则', path: '13_因果律与一致性/01_因果律总则.md' },
      { name: '物质条件决定论', path: '13_因果律与一致性/02_物质条件决定论.md' },
      { name: '力量体系与社会的互动', path: '13_因果律与一致性/03_力量体系与社会的互动.md' },
      { name: '历史事件因果分析', path: '13_因果律与一致性/04_历史事件因果分析.md' },
      { name: '一致性检查清单', path: '13_因果律与一致性/05_一致性检查清单.md' },
      { name: '矛盾记录与修正', path: '13_因果律与一致性/06_矛盾记录与修正.md' },
    ]
  },
]

// --- Import all markdown files ---
const mdFiles = import.meta.glob('../../*.md', { query: '?raw', import: 'default' })
const mdFilesDeep = import.meta.glob('../../**/*.md', { query: '?raw', import: 'default' })
const allMdImports = { ...mdFiles, ...mdFilesDeep }

// --- App state ---
let currentDoc: DocEntry | null = null
const docs: Map<string, DocEntry> = new Map()

// --- Build DOM ---
const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-title">世界观设定集</h1>
        <input type="text" id="search-input" class="search-input" placeholder="搜索文档..." />
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
hamburgerBtn.title = '菜单'
document.body.appendChild(hamburgerBtn)

// 遮罩层
const sidebarOverlay = document.createElement('div')
sidebarOverlay.className = 'sidebar-overlay'
document.body.appendChild(sidebarOverlay)

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
  sidebarEl.style.left = px + 'px'
  sidebarOverlay.style.transition = 'none'
  const ratio = Math.max(0, Math.min(1, (px + getSidebarWidth()) / getSidebarWidth()))
  sidebarOverlay.style.opacity = String(ratio * 0.4)
  sidebarOverlay.classList.toggle('visible', ratio > 0)
}

function snapSidebar(open: boolean): void {
  sidebarEl.style.transition = ''
  sidebarEl.style.left = ''
  sidebarOverlay.style.transition = ''
  sidebarOverlay.style.opacity = ''
  if (open) {
    sidebarEl.classList.add('open')
    sidebarOverlay.classList.add('visible')
    hamburgerBtn.innerHTML = '✕'
    hamburgerBtn.title = '关闭菜单'
    hamburgerBtn.classList.add('hamburger-close')
  } else {
    sidebarEl.classList.remove('open')
    sidebarOverlay.classList.remove('visible')
    hamburgerBtn.innerHTML = '☰'
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
  dragBaseLeft = parseFloat(sidebarEl.style.left)
  if (isNaN(dragBaseLeft)) {
    dragBaseLeft = sidebarEl.classList.contains('open') ? 0 : -getSidebarWidth()
  }
  dragActive = true
  sidebarEl.classList.remove('open')
  sidebarEl.style.left = dragBaseLeft + 'px'
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
  const currentLeft = parseFloat(sidebarEl.style.left)
  const finalLeft = isNaN(currentLeft) ? dragBaseLeft : currentLeft
  const progress = (finalLeft + sw) / sw
  if (progress <= 0.15) {
    snapSidebar(false)
  } else {
    sidebarEl.style.transition = ''
    sidebarEl.style.left = finalLeft + 'px'
    sidebarOverlay.style.transition = ''
    sidebarOverlay.style.opacity = String(progress * 0.4)
    sidebarOverlay.classList.toggle('visible', progress > 0)
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
sidebarOverlay.addEventListener('click', closeSidebar)

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
      arrowBtn.title = '展开/缩合'
      arrowBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        section.classList.toggle('collapsed')
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

  // Check cache
  if (docs.has(path)) {
    const doc = docs.get(path)!
    currentDoc = doc
    renderContent(doc)
    updateActiveStates(path)
    return
  }

  // Show loading
  contentArea.innerHTML = '<div class="content-loading">加载中...</div>'

  try {
    // Try to find the matching import
    let rawContent: string | null = null
    for (const [importPath, importer] of Object.entries(allMdImports)) {
      if (importPath.includes(path)) {
        const imported = await importer() as string
        rawContent = imported
        break
      }
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

    // Strip YAML front matter for rendering (handle BOM)
    const contentWithoutFM = rawContent.replace(/^\uFEFF?---[\s\S]*?---\n*/, '')
    
    const doc: DocEntry = {
      path,
      title,
      content: contentWithoutFM,
    }
    
    docs.set(path, doc)
    currentDoc = doc
    renderContent(doc)
    updateActiveStates(path)
  } catch (err) {
    contentArea.innerHTML = `<div class="content-error">
      <h3>无法加载文档</h3>
      <p>${path}</p>
      <p style="color: var(--text-secondary)">该文档可能尚未创建或文件路径不正确。</p>
    </div>`
  }
}

function renderContent(doc: DocEntry) {
  const html = marked.parse(doc.content) as string

  if (doc.path === 'home.md') {
    // 主页特殊渲染：居中、无标题栏，但 badge/导航仍统一处理
    contentArea.innerHTML = `<div class="home-content">${html}</div>`
    scanAndRenderBadges(contentArea, doc.path)
    expandAndHighlightNav(doc.path)
    return
  }

  contentArea.innerHTML = `
    <h1 class="content-title">${doc.title}</h1>
    <div class="content-body">${html}</div>
  `
  // 扫描内容，给有记录的段落加角标
  scanAndRenderBadges(contentArea, doc.path)
  // 展开并高亮左侧导航对应项
  expandAndHighlightNav(doc.path)
}

// --- Annotate button hover/tap 绑定（只在初始化时调用一次） ---
// 所有可见性判断、位置计算都在 bindAnnotateZones 内部处理（单一状态源）。
function initAnnotateHoverSystem(): void {
  // 为内容区域绑定 annotate 按钮（含 h1 以支持 home.md 标题）
  bindAnnotateZones(contentArea, 'h1, h2, h3, p', () => {
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
  }
}

// --- Search ---
searchInput.addEventListener('input', () => {
  renderNavTree(directoryTree, navTree, searchInput.value.trim())
})

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
renderNavTree(directoryTree, navTree)
initChangesSystem()
initAnnotateHoverSystem()
// 初始自动加载主页
loadDocument('home.md')

// --- Sidebar Title Click: Return to Home Page ---
const sidebarTitle = document.querySelector('.sidebar-title') as HTMLElement
if (sidebarTitle) {
  sidebarTitle.addEventListener('click', () => {
    loadDocument('home.md')
  })
}

// --- 欢迎弹窗（首次自动弹出，之后可通过右上角问号按钮切换）---
function showWelcomeDialog(): void {
  const existing = document.querySelector('.welcome-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.className = 'welcome-overlay'

  function dismiss(): void {
    overlay.classList.add('fade-out')
    setTimeout(() => overlay.remove(), 300)
    localStorage.setItem('welcome-dismissed', '1')
  }

  overlay.innerHTML = `<div class="welcome-dialog">
    <div class="welcome-header">ようこそ (◕‿◕✿)</div>
    <div class="welcome-body">
      <p>在这个世界观设定集中，你可以：</p>
      <ul>
        <li><b>浏览</b> — 左侧导航探索地理、历史、种族、力量体系等设定文档</li>
        <li><b>标注</b> — 悬停任意段落，点击出现的「+」按钮，为段落添加你的笔记、批注和标记</li>
        <li><b>搜索</b> — 顶部搜索框快速定位任何设定内容</li>
        <li><b>追踪变更</b> — 点击右下角编辑图标，随时记录修改思路、设定演变和待办事项</li>
        <li><b>移动端</b> — 左上角菜单按钮打开导航，拖拽侧边栏右侧把手自由调整宽度</li>
      </ul>
      <div class="welcome-section">
        <p><b>关于「导出 JSON」</b></p>
        <ul>
          <li><b>本地保存</b> — 将所有标注和变更记录导出为 JSON，作为你创作数据的备份</li>
          <li><b>为创作者提供内容</b> — 导出的 JSON 可交给维护者，帮助了解读者反馈、改进设定</li>
        </ul>
      </div>
      <p class="welcome-disclaimer">（这个网页以及这条弹窗几乎全是 AI 做的，请多包涵他时不时抽风 (￣▽￣*)ゞ）</p>
      <p>希望这里成为你创作旅程的可靠伙伴 (´･ω･\`)ﾉ</p>
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
  document.getElementById('welcome-dismiss')!.addEventListener('click', dismiss)
}

// 首次访问自动弹出
if (!localStorage.getItem('welcome-dismissed')) {
  showWelcomeDialog()
}

// 右上角帮助按钮：切换弹窗
const helpBtn = document.createElement('button')
helpBtn.className = 'help-btn'
helpBtn.innerHTML = '?'
helpBtn.title = '功能说明'
document.body.appendChild(helpBtn)
helpBtn.addEventListener('click', () => {
  const existing = document.querySelector('.welcome-overlay')
  if (existing) {
    existing.classList.add('fade-out')
    setTimeout(() => existing.remove(), 300)
  } else {
    showWelcomeDialog()
  }
})