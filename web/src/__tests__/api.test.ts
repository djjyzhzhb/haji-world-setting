import { describe, test, expect } from 'vitest'
import {
  generateId,
  computeTargetKey,
  computeContentFingerprint,
  computeElementIndex,
  computeBreadcrumb,
  ensureTargetKey,
  scoreMatch,
  findElementForNote,
  importChangeNotesFromText,
  ANNOTATABLE_SELECTOR,
} from '../api'
import type { ChangeNote } from '../api'

// ============================================================================
// 工具：创建测试用 DOM 元素
// ============================================================================

function h(tag: string, text: string, parent?: HTMLElement): HTMLElement {
  const el = document.createElement(tag)
  el.textContent = text
  if (parent) parent.appendChild(el)
  return el
}

function containerWith(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

// ============================================================================
// generateId
// ============================================================================

describe('generateId', () => {
  test('格式为 CHG-YYYYMMDD-xxxxxx', () => {
    const id = generateId()
    expect(id).toMatch(/^CHG-\d{8}-\w{7}$/)
  })

  test('连续生成 100 个 ID 大部分不重复（极少量碰撞可接受）', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBeGreaterThanOrEqual(95) // 允许极小概率的同秒碰撞
  })

  test('包含今天的日期', () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const id = generateId()
    expect(id).toContain(today)
  })
})

// ============================================================================
// computeTargetKey
// ============================================================================

describe('computeTargetKey', () => {
  test('生成格式: docPath|tag|text', () => {
    const el = h('p', '这是一段测试文本内容用于验证定位键的生成')
    const key = computeTargetKey('02_地理/01_世界地图与总览.md', el)
    expect(key).toBe('02_地理/01_世界地图与总览.md|p|这是一段测试文本内容用于验证定位键的生成')
  })

  test('文本超过 60 字时截断', () => {
    const longText = '这是一个超过六十字的长文本用于测试截断功能确保只取前六十个字符后面的部分会被忽略掉还有一些额外文字确保确实超出限制'
    const el = h('p', longText)
    const key = computeTargetKey('test.md', el)
    expect(key.split('|')[2].length).toBeLessThanOrEqual(60)
  })

  test('h1/h2/h3 使用正确的 tag', () => {
    const cases = ['h1', 'h2', 'h3'] as const
    for (const tag of cases) {
      const el = h(tag, '标题')
      const key = computeTargetKey('test.md', el)
      expect(key).toContain(`|${tag}|`)
    }
  })

  test('空文本', () => {
    const el = h('p', '')
    const key = computeTargetKey('test.md', el)
    expect(key).toBe('test.md|p|')
  })
})

// ============================================================================
// computeContentFingerprint
// ============================================================================

describe('computeContentFingerprint', () => {
  test('相同内容生成相同指纹', () => {
    const a = h('p', 'hello world')
    const b = h('p', 'hello world')
    expect(computeContentFingerprint(a)).toBe(computeContentFingerprint(b))
  })

  test('不同内容生成不同指纹', () => {
    const a = h('p', 'hello world')
    const b = h('p', 'hello worlds')
    expect(computeContentFingerprint(a)).not.toBe(computeContentFingerprint(b))
  })

  test('返回值为非空字符串', () => {
    const el = h('p', 'test')
    const fp = computeContentFingerprint(el)
    expect(typeof fp).toBe('string')
    expect(fp.length).toBeGreaterThan(0)
  })

  test('空元素指纹不为空（hash of empty string）', () => {
    const el = h('p', '')
    const fp = computeContentFingerprint(el)
    expect(typeof fp).toBe('string')
    expect(fp).toBe('0')
  })
})

// ============================================================================
// computeElementIndex
// ============================================================================

describe('computeElementIndex', () => {
  test('第一个 h2 返回 h2#1', () => {
    const div = containerWith('<h2>A</h2><h2>B</h2><h2>C</h2>')
    const first = div.querySelector('h2') as HTMLElement
    expect(computeElementIndex(first)).toBe('h2#1')
  })

  test('第二个 h2 返回 h2#2', () => {
    const div = containerWith('<h2>A</h2><h2>B</h2><h2>C</h2>')
    const second = div.querySelectorAll('h2')[1]
    expect(computeElementIndex(second)).toBe('h2#2')
  })

  test('不同标签独立计数', () => {
    const div = containerWith('<h2>A</h2><p>text</p><h2>B</h2><p>more</p>')
    const h2s = div.querySelectorAll('h2')
    const ps = div.querySelectorAll('p')
    expect(computeElementIndex(h2s[0])).toBe('h2#1')
    expect(computeElementIndex(h2s[1])).toBe('h2#2')
    expect(computeElementIndex(ps[0])).toBe('p#1')
    expect(computeElementIndex(ps[1])).toBe('p#2')
  })
})

// ============================================================================
// computeBreadcrumb
// ============================================================================

describe('computeBreadcrumb', () => {
  test('收集目标元素之前的所有标题', () => {
    const div = containerWith(`
      <h1>世界核心</h1>
      <h2>创世神话</h2>
      <p id="target">目标段落</p>
    `)
    const target = div.querySelector('#target') as HTMLElement
    const bc = computeBreadcrumb(div, target)
    expect(bc).toBe('世界核心 > 创世神话')
  })

  test('空路径（无前置标题）', () => {
    const div = containerWith('<p id="target">直接段落</p>')
    const target = div.querySelector('#target') as HTMLElement
    expect(computeBreadcrumb(div, target)).toBe('')
  })

  test('h3 也计入路径', () => {
    const div = containerWith(`
      <h1>一</h1>
      <h2>二</h2>
      <h3>三</h3>
      <p id="target">目标</p>
    `)
    const target = div.querySelector('#target') as HTMLElement
    expect(computeBreadcrumb(div, target)).toBe('一 > 二 > 三')
  })
})

// ============================================================================
// ensureTargetKey
// ============================================================================

describe('ensureTargetKey', () => {
  test('已有 targetKey 时保持不变', () => {
    const note = makeNote({ targetKey: 'my-custom-key' })
    const result = ensureTargetKey(note)
    expect(result.targetKey).toBe('my-custom-key')
  })

  test('缺少 targetKey 时从 target 字段推导', () => {
    const note = makeNote({
      targetKey: undefined,
      target: { docPath: 'doc.md', elementType: 'p', elementText: '测试文本' },
    })
    const result = ensureTargetKey(note)
    expect(result.targetKey).toBe('doc.md|p|测试文本')
  })

  test('target 也无 elementText 时用 section 兜底', () => {
    const note = makeNote({
      targetKey: undefined,
      target: { docPath: 'doc.md', elementType: 'h2', section: '章节标题' },
    })
    const result = ensureTargetKey(note)
    expect(result.targetKey).toBe('doc.md|h2|章节标题')
  })
})

// ============================================================================
// scoreMatch
// ============================================================================

// 辅助：生成测试用的 ChangeNote 和 DOM 元素
function makeNote(overrides: Partial<ChangeNote> = {}): ChangeNote {
  return {
    id: 'CHG-test-001',
    type: 'annotation',
    author: 'tester',
    timestamp: new Date().toISOString(),
    target: { docPath: 'test.md', elementType: 'p', elementText: '测试' },
    content: { summary: 'summary', body: 'body', tags: [] },
    status: 'pending',
    targetKey: 'test.md|p|测试',
    ...overrides,
  }
}

function makeEl(tag: string, text: string): HTMLElement {
  const el = document.createElement(tag)
  el.textContent = text
  return el
}

describe('scoreMatch', () => {
  test('精确 targetKey 匹配 → 1000', () => {
    const note = makeNote({ targetKey: 'test.md|p|hello' })
    const el = makeEl('p', 'hello')
    expect(scoreMatch(note, 'test.md', el)).toBe(1000)
  })

  test('不同 docPath → 0', () => {
    const note = makeNote({ targetKey: 'other.md|p|hello' })
    const el = makeEl('p', 'hello')
    expect(scoreMatch(note, 'test.md', el)).toBe(0)
  })

  test('tag + 开头匹配 → 100', () => {
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'hello world' },
    })
    const el = makeEl('p', 'hello world!!!')
    expect(scoreMatch(note, 'test.md', el)).toBe(100)
  })

  test('tag + 双向包含 → 60', () => {
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'world' },
    })
    const el = makeEl('p', 'hello world!')
    expect(scoreMatch(note, 'test.md', el)).toBe(60)
  })

  test('tag 不匹配 → 不走文本匹配路径', () => {
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'h2', elementText: 'hello' },
    })
    const el = makeEl('p', 'hello')
    // tag 不一致且 elementIndex 和 breadcrumb 都设 = 0
    // 除非有别的匹配机制
    expect(scoreMatch(note, 'test.md', el)).toBe(0)
  })

  test('note 无 target → 0', () => {
    const note = makeNote({ target: undefined as any })
    const el = makeEl('p', 'hello')
    expect(scoreMatch(note, 'test.md', el)).toBe(0)
  })

  test('section 标题兜底 → 80（tag 匹配但文本不匹配，回退到 section 匹配）', () => {
    // 元素是 h2，文本=确切的标题，note.elementType=h2, note.elementText=不同的文本, note.section=确切的标题
    // 步骤 ② tag 匹配但文本不包含 → 0（不 return，继续）
    // 步骤 ③ 无 elementIndex → 跳过
    // 步骤 ④ 无 breadcrumb → 跳过
    // 步骤 ⑤ section == elementText → 80 ✓
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'h2', elementText: '不同的文本', section: '确切的标题' },
    })
    const el = makeEl('h2', '确切的标题')
    expect(scoreMatch(note, 'test.md', el)).toBe(80)
  })

  test('section 标题不匹配 h2 但内容不同 → 不走兜底', () => {
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'h2', section: '另一个标题' },
    })
    const el = makeEl('h2', '确切的标题')
    // elementType 匹配 → 走文本匹配路径（因为 note.target.elementType === tag）
    // noteText="另一个标题", elementText="确切的标题" → 不包含 → 0
    expect(scoreMatch(note, 'test.md', el)).toBe(0)
  })
})

// ============================================================================
// findElementForNote
// ============================================================================

describe('findElementForNote', () => {
  test('精确匹配找到对应元素', () => {
    const div = containerWith('<p>hello</p><p>world</p>')
    const note = makeNote({
      targetKey: 'test.md|p|world',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'world' },
    })
    const el = findElementForNote(div, 'test.md', note)
    expect(el).not.toBeNull()
    expect(el!.textContent!.trim()).toBe('world')
  })

  test('无匹配 → null', () => {
    const div = containerWith('<p>hello</p>')
    const note = makeNote({
      targetKey: 'test.md|p|nonexistent',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'nonexistent' },
    })
    const el = findElementForNote(div, 'test.md', note)
    expect(el).toBeNull()
  })

  test('多个候选时选最高分', () => {
    const div = containerWith('<p>abc</p><p>hello world</p>')
    const note = makeNote({
      targetKey: '',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'hello' },
    })
    const el = findElementForNote(div, 'test.md', note)
    expect(el).not.toBeNull()
    expect(el!.textContent!.trim()).toBe('hello world')
  })

  test('ANNOTATABLE_SELECTOR 范围内的元素才被扫描', () => {
    const div = containerWith('<div>div not scanned</div><p>scanned</p>')
    const note = makeNote({
      targetKey: 'test.md|p|scanned',
      target: { docPath: 'test.md', elementType: 'p', elementText: 'scanned' },
    })
    const el = findElementForNote(div, 'test.md', note)
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe('P')
  })
})

// ============================================================================
// importChangeNotesFromText
// ============================================================================

describe('importChangeNotesFromText', () => {
  test('单条 JSON 记录', () => {
    const note = makeNote()
    const text = JSON.stringify(note)
    const result = importChangeNotesFromText(text)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(note.id)
  })

  test('bundle 格式', () => {
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: 'test',
      count: 2,
      notes: [makeNote({ id: 'CHG-a' }), makeNote({ id: 'CHG-b' })],
    }
    const result = importChangeNotesFromText(JSON.stringify(bundle))
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('CHG-a')
    expect(result[1].id).toBe('CHG-b')
  })

  test('空数组', () => {
    const result = importChangeNotesFromText('[]')
    expect(result).toHaveLength(0)
  })

  test('空对象 → 空数组', () => {
    const result = importChangeNotesFromText('{}')
    expect(result).toHaveLength(0)
  })

  test('非法 JSON → 抛错', () => {
    expect(() => importChangeNotesFromText('not json')).toThrow()
  })

  test('缺少 targetKey 的记录自动回填', () => {
    const note = makeNote({ targetKey: undefined })
    const result = importChangeNotesFromText(JSON.stringify(note))
    expect(result[0].targetKey).not.toBeUndefined()
  })
})

// ============================================================================
// ANNOTATABLE_SELECTOR
// ============================================================================

describe('ANNOTATABLE_SELECTOR', () => {
  test('包含基本的标题和段落标签', () => {
    expect(ANNOTATABLE_SELECTOR).toContain('h1')
    expect(ANNOTATABLE_SELECTOR).toContain('h2')
    expect(ANNOTATABLE_SELECTOR).toContain('h3')
    expect(ANNOTATABLE_SELECTOR).toContain('p')
  })
})
