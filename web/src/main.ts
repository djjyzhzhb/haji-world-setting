import './style.css'
import { marked } from 'marked'
import { initChangesSystem, showAnnotateBtn, hideAnnotateBtn } from './ui/changes'

// --- Types ---
interface NavItem {
  name: string
  path: string
  children?: NavItem[]
}

interface DocEntry {
  path: string
  title: string
  content: string
}

// --- Directory structure definition ---
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
      { name: '大陆A总览', path: '02_地理/05_大陆A/00_大陆A总览.md' },
      { name: '区域A1', path: '02_地理/05_大陆A/01_区域A1.md' },
      { name: '城市与据点索引', path: '02_地理/05_大陆A/03_城市与据点索引.md' },
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
      { name: '种族A总览', path: '04_种族与生物/02_种族A/00_种族A总览.md' },
      { name: '种族A生理与特性', path: '04_种族与生物/02_种族A/01_生理与特性.md' },
      { name: '种族A文化与习俗', path: '04_种族与生物/02_种族A/02_文化与习俗.md' },
      { name: '种族A历史与起源', path: '04_种族与生物/02_种族A/03_历史与起源.md' },
      { name: '种族A种族关系', path: '04_种族与生物/02_种族A/04_与其他种族的关系.md' },
      { name: '普通生物', path: '04_种族与生物/04_生物图鉴/01_普通生物.md' },
      { name: '幻想生物', path: '04_种族与生物/04_生物图鉴/02_幻想生物.md' },
      { name: '传说级存在', path: '04_种族与生物/04_生物图鉴/03_传说级存在.md' },
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
      { name: '体系A原理与来源', path: '08_力量体系/02_体系A/01_原理与来源.md' },
      { name: '体系A规则与限制', path: '08_力量体系/02_体系A/02_规则与限制.md' },
      { name: '体系A分类与层级', path: '08_力量体系/02_体系A/03_分类与层级.md' },
      { name: '体系A能力列表', path: '08_力量体系/02_体系A/04_代表性能力列表.md' },
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
        <h1 class="sidebar-title">哈吉语<br>世界观设定集</h1>
        <input type="text" id="search-input" class="search-input" placeholder="搜索文档..." />
      </div>
      <nav class="nav-tree" id="nav-tree"></nav>
    </aside>
    <main class="content" id="content">
      <div class="content-placeholder">
        <h2>哈吉语世界观设定集</h2>
        <p>从左侧导航选择文档，或使用搜索功能查找设定。</p>
        <p style="margin-top: 1rem; color: var(--text-secondary)">
          本项目是 <strong>人造语言创制计划</strong>（哈吉语）的子项目，<br>
          旨在为哈吉语提供文化背景与文明土壤。
        </p>
      </div>
    </main>
  </div>
`

// --- Render sidebar navigation ---
const navTree = document.getElementById('nav-tree')!
const searchInput = document.getElementById('search-input') as HTMLInputElement
const contentArea = document.getElementById('content')!

function renderNavTree(items: NavItem[], container: HTMLElement, filter: string = '') {
  container.innerHTML = ''
  for (const item of items) {
    if (item.children) {
      const section = document.createElement('div')
      section.className = 'nav-section'
      
      const header = document.createElement('div')
      header.className = 'nav-section-header'
      header.textContent = item.name
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed')
      })
      
      const childrenContainer = document.createElement('div')
      childrenContainer.className = 'nav-section-children'
      
      let hasVisible = false
      for (const child of item.children) {
        if (filter && !child.name.toLowerCase().includes(filter.toLowerCase())) {
          continue
        }
        hasVisible = true
        const link = document.createElement('a')
        link.className = 'nav-link'
        link.textContent = child.name
        link.href = '#'
        link.addEventListener('click', (e) => {
          e.preventDefault()
          loadDocument(child.path)
        })
        if (currentDoc && child.path === findCurrentPath()) {
          link.classList.add('active')
        }
        childrenContainer.appendChild(link)
      }
      
      if (hasVisible || !filter) {
        section.appendChild(header)
        section.appendChild(childrenContainer)
        container.appendChild(section)
      }
    } else {
      if (filter && !item.name.toLowerCase().includes(filter.toLowerCase())) {
        continue
      }
      const link = document.createElement('a')
      link.className = 'nav-link top-level'
      link.textContent = item.name
      link.href = '#'
      link.addEventListener('click', (e) => {
        e.preventDefault()
        loadDocument(item.path)
      })
      container.appendChild(link)
    }
  }
}

function findCurrentPath(): string {
  // Find which document is currently loaded
  for (const [p] of docs) {
    if (docs.get(p) === currentDoc) return p
  }
  return ''
}

// --- Load document ---
async function loadDocument(path: string) {
  // Check cache
  if (docs.has(path)) {
    const doc = docs.get(path)!
    currentDoc = doc
    renderContent(doc)
    updateActiveLink(path)
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
    const fmMatch = rawContent.match(/^---\s*\ntitle:\s*"([^"]*)"[\s\S]*?---/)
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
    updateActiveLink(path)
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
  
  // Add annotate hover for headings and paragraphs
  const body = contentArea.querySelector('.content-body')!
  body.querySelectorAll('h2, h3, p').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const rect = el.getBoundingClientRect()
      const headingText = el.tagName.match(/H[23]/) ? el.textContent?.trim() || null : null
      const section = headingText ? `${el.tagName.toLowerCase()} ${headingText}` : null
      showAnnotateBtn(doc.path, section)
      const btn = document.querySelector('.annotate-btn') as HTMLElement
      if (btn) {
        btn.style.top = `${rect.top + window.scrollY}px`
        btn.style.left = `${rect.left - 36}px`
      }
    })
    el.addEventListener('mouseleave', () => {
      hideAnnotateBtn()
    })
  })
}

function updateActiveLink(path: string) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('active')
    const href = (el as HTMLAnchorElement).href
    if (href.includes(encodeURIComponent(path))) {
      el.classList.add('active')
    }
  })
  // Expand the parent section
  document.querySelectorAll('.nav-section').forEach(el => {
    el.classList.remove('collapsed')
  })
}

// --- Search ---
searchInput.addEventListener('input', () => {
  renderNavTree(directoryTree, navTree, searchInput.value.trim())
})

// --- Init ---
renderNavTree(directoryTree, navTree)
initChangesSystem()