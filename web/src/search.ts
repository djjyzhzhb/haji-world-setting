import Fuse from 'fuse.js'

export interface SearchResult {
  path: string
  title: string
  snippet: string
}

interface IndexEntry {
  path: string
  title: string
  body: string
}

let fuse: Fuse<IndexEntry> | null = null

/**
 * 从 glob import path 中提取干净的文档路径
 * 例如 "../../02_地理/01_世界地图与总览.md" → "02_地理/01_世界地图与总览.md"
 */
function findDocPath(importPath: string): string {
  return importPath.replace(/^\.\.\/\.\.\//, '')
}

/**
 * 惰性构建全文搜索索引（仅在首次搜索时执行一次）
 */
export async function buildIndex(
  docs: Map<string, { path: string; title: string; content: string }>,
  allMdImports: Record<string, () => Promise<string>>
): Promise<void> {
  if (fuse) return // 已构建

  const entries: IndexEntry[] = []

  for (const [importPath, importer] of Object.entries(allMdImports)) {
    const cleanPath = findDocPath(importPath)

    // 先查缓存
    const cached = docs.get(cleanPath)
    if (cached) {
      entries.push({
        path: cleanPath,
        title: cached.title,
        body: stripMarkdown(cached.content),
      })
      continue
    }

    // 加载未缓存的文档
    try {
      const raw = (await importer()) as string
      const title = extractTitle(raw, cleanPath)
      const contentWithoutFM = raw.replace(/^\uFEFF?---[\s\S]*?---\n*/, '')
      entries.push({
        path: cleanPath,
        title,
        body: stripMarkdown(contentWithoutFM),
      })
    } catch {
      // 跳过加载失败的文档
    }
  }

  fuse = new Fuse(entries, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'body', weight: 0.4 },
    ],
    threshold: 0.5,
    includeMatches: true,
    minMatchCharLength: 1,
    ignoreLocation: true,
  })
}

/**
 * 执行全文搜索
 */
export function search(query: string, limit: number = 10): SearchResult[] {
  if (!fuse) return []

  const results = fuse.search(query, { limit })
  return results.map((r) => {
    const match = r.matches?.find((m) => m.key === 'body')
    const snippet = match
      ? extractSnippet(r.item.body, match.indices, query)
      : r.item.body.slice(0, 80) + '…'

    return {
      path: r.item.path,
      title: r.item.title,
      snippet,
    }
  })
}

function extractTitle(raw: string, fallbackPath: string): string {
  const fmMatch = raw.match(/^\uFEFF?---\s*\ntitle:\s*"([^"]*)"/)
  if (fmMatch) return fmMatch[1]
  return fallbackPath.split('/').pop()?.replace('.md', '') || fallbackPath
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/\|/g, ' ')
    .replace(/-{3,}/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function extractSnippet(
  body: string,
  indices: readonly [number, number][],
  query: string
): string {
  if (!indices || indices.length === 0) return body.slice(0, 80) + '…'

  const [start] = indices[0]
  const contextLen = 40
  const snippetStart = Math.max(0, start - contextLen)
  const snippetEnd = Math.min(body.length, start + query.length + contextLen)

  let snippet = body.slice(snippetStart, snippetEnd).replace(/\n/g, ' ')
  if (snippetStart > 0) snippet = '…' + snippet
  if (snippetEnd < body.length) snippet += '…'

  return snippet
}
