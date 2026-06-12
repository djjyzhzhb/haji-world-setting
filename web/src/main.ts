import './style.css'
import { marked } from 'marked'
import { initChangesSystem, showAnnotateBtn, hideAnnotateBtn, scheduleHideAnnotateBtn } from './ui/changes'

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
      <div class="content-placeholder">
        <h2>世界观设定集</h2>
        <p>从左侧导航选择文档，或使用搜索功能查找设定。</p>
        <p style="margin-top: 1rem; color: var(--text-secondary)">
          本设定集是一个独立的世界观构建项目，<br>
          涵盖地理、历史、种族、文化、力量体系等多元模块。
        </p>
      </div>
    </main>
  </div>
`

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

      // 单一箭头元素，通过 CSS transform: rotate(90deg) 切换展开态
      const arrow = document.createElement('span')
      arrow.className = 'nav-arrow'
      arrow.textContent = '▶'
      header.appendChild(arrow)
      header.appendChild(document.createTextNode(item.name))
      header.dataset.name = item.name

      // Highlight header if its overview doc is currently loaded
      if (item.overview && currentDoc && currentDoc.path === item.overview) {
        header.classList.add('active')
      }
      // Mark headers that have overview content
      if (item.overview) {
        header.classList.add('has-overview')
      }

      header.addEventListener('click', () => {
        const wasCollapsed = section.classList.contains('collapsed')
        section.classList.toggle('collapsed')
        // Only load overview when EXPANDING (was collapsed → now open)
        if (item.overview && wasCollapsed) {
          loadDocument(item.overview)
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
  contentArea.innerHTML = `
    <h1 class="content-title">${doc.title}</h1>
    <div class="content-body">${html}</div>
  `
}

// --- Annotate hover & tap system — 绑定一次，复用在所有文档 ---
// 原逻辑缺陷：每个 h2/h3/p 各自绑 mouseenter/mouseleave
//   1. 鼠标从文本移动到按钮时触发 mouseleave → 按钮消失
//   2. 每次加载文档都重新绑一批监听器 → 泄漏
//   3. 完全不支持触屏
//
// 新逻辑：
//   - 在 contentArea 根节点上用 pointerover/pointerout 委托事件（只需绑一次）
//   - 按钮自身也参与 hover 判定：悬停按钮时取消隐藏
//   - 离开内容区 + 离开按钮 → 250ms 延迟隐藏，给指针移动留时间
//   - 触屏设备：点击文本元素 → 按钮常驻；再点空白处隐藏
function initAnnotateHoverSystem(): void {
  const btn = document.querySelector('.annotate-btn') as HTMLElement | null
  let activeTextEl: HTMLElement | null = null

  function positionBtnFor(targetEl: HTMLElement): void {
    if (!btn) return
    const rect = targetEl.getBoundingClientRect()
    const btnSize = btn.offsetWidth || 32
    btn.style.top = `${rect.top + window.scrollY + 2}px`
    btn.style.left = `${Math.max(8, rect.left - btnSize - 6 + window.scrollX)}px`
  }

  contentArea.addEventListener('pointerover', (ev) => {
    const targetEl = (ev.target as HTMLElement | null)?.closest('h2, h3, p') as HTMLElement | null
    if (!targetEl) return
    if (activeTextEl === targetEl) return
    activeTextEl = targetEl

    const headingText = targetEl.tagName.match(/H[23]/) ? targetEl.textContent?.trim() || null : null
    const section = headingText ? `${targetEl.tagName.toLowerCase()} ${headingText}` : null
    showAnnotateBtn(currentDoc?.path || '', section)
    positionBtnFor(targetEl)
  })

  contentArea.addEventListener('pointerout', (ev) => {
    const related = ev.relatedTarget as Node | null
    const stillInContent = related && contentArea.contains(related)
    const stillOnBtn = related && btn && (btn === related || btn.contains(related))
    if (!stillInContent && !stillOnBtn) {
      activeTextEl = null
      scheduleHideAnnotateBtn(250)
    }
  })

  // --- 移动端 / 触屏设备：点击文本 → 按钮常驻；点击空白 → 隐藏 ---
  contentArea.addEventListener('click', (ev) => {
    const targetEl = (ev.target as HTMLElement | null)?.closest('h2, h3, p') as HTMLElement | null

    // 忽略超链接/按钮等可交互元素
    if ((ev.target as HTMLElement).closest('a, button, input, textarea, .annotate-btn')) return

    if (!targetEl) {
      // 点击空白区域 → 隐藏
      activeTextEl = null
      hideAnnotateBtn()
      return
    }

    // 点到同一段 → 切换隐藏（给触屏用户一个取消方式）
    if (activeTextEl === targetEl) {
      activeTextEl = null
      hideAnnotateBtn()
      return
    }

    activeTextEl = targetEl
    const headingText = targetEl.tagName.match(/H[23]/) ? targetEl.textContent?.trim() || null : null
    const section = headingText ? `${targetEl.tagName.toLowerCase()} ${headingText}` : null
    showAnnotateBtn(currentDoc?.path || '', section)
    positionBtnFor(targetEl)
    ev.stopPropagation()
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

// --- Search ---
searchInput.addEventListener('input', () => {
  renderNavTree(directoryTree, navTree, searchInput.value.trim())
})

// --- Init ---
renderNavTree(directoryTree, navTree)
initChangesSystem()
initAnnotateHoverSystem()