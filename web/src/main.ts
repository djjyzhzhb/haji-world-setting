import './style.css'
import { marked } from 'marked'
import { initChangesSystem, bindAnnotateZones, scanAndRenderBadges, scrollToNoteInContent, getSourceName, setSourceName, hideAnnotateBtn } from './ui/changes'
import { ANNOTATABLE_SELECTOR } from './api'

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
    hamburgerBtn.title = '关闭菜单'
    hamburgerBtn.classList.add('hamburger-close')
  } else {
    sidebarEl.classList.remove('open')
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
  // 切换文档时立即隐藏「+」按钮，防止残留在旧文档位置
  hideAnnotateBtn()

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

