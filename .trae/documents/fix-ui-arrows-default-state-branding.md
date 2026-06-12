# 修复：箭头方向、默认折叠状态、项目品牌独立化

## 摘要

本次修复三个问题：
1. 树形导航的展开/折叠箭头方向反了
2. 目录默认应该是折叠状态，引导用户点击发现总览内容
3. 移除 UI 中所有"哈吉语"字样，使项目作为独立世界观呈现

---

## 当前状态分析

### 问题 1：箭头方向反了

**CSS 定义**（`style.css` 第 127-137 行）：
- `::before` 默认是一个 **右指三角形 ▶**（`border-left: 4px solid` + 上下透明边框）
- 第 166-168 行：`.nav-section.collapsed .nav-section-header::before { transform: rotate(90deg); }` — 折叠时顺时针旋转 90°，变成 **▼**

**当前行为**：展开 = ▶，折叠 = ▼

**标准约定**：展开 = ▼，折叠 = ▶（与文件管理器、IDE 树形面板一致）

**修复**：把 `rotate(90deg)` 移到默认状态（非折叠），即 `.nav-section-header::before` 默认显示 ▶（折叠态），`.nav-section:not(.collapsed) .nav-section-header::before` 旋转 90° 变 ▼（展开态）。

### 问题 2：默认折叠状态

**当前**：`renderNavItems()` 中创建的 `section` 元素默认没有 `collapsed` class，意味着所有分组默认展开。用户一打开网站看到所有子项，不会主动去点击分组标题，也就发现不了总览文档。

**修复**：在 `renderNavItems()` 中，有 `overview` 的分组默认添加 `collapsed` class。同时调整 CSS 让折叠态默认的 ▶ 箭头正常显示。

### 问题 3：移除"哈吉语"字样

**涉及文件**：
| 文件 | 行号 | 内容 |
|------|------|------|
| `index.html` | 6 | `<title>哈吉语世界观设定集</title>` |
| `main.ts` | 209 | `<h1>哈吉语<br>世界观设定集</h1>` |
| `main.ts` | 216 | `<h2>哈吉语世界观设定集</h2>` |
| `main.ts` | 219 | `本项目是...（哈吉语）的子项目` |
| `main.ts` | 220 | `旨在为哈吉语提供文化背景与文明土壤` |

---

## 修改方案

### 文件 1：`web/src/style.css`

**修改 A**：反转箭头方向逻辑

将第 166-168 行：
```css
.nav-section.collapsed .nav-section-header::before {
  transform: rotate(90deg);
}
```
改为：
```css
.nav-section-header::before {
  /* 默认 ▶ 指向右 = 折叠态 */
  transform: rotate(0deg);
}
.nav-section:not(.collapsed) .nav-section-header::before {
  /* 展开时旋转 90° 变成 ▼ */
  transform: rotate(90deg);
}
```

同时删除第 127-137 行中原有的 `::before` 块中不必要的重复（或保留基础样式，只改旋转逻辑）。

### 文件 2：`web/src/main.ts`

**修改 A**：有 `overview` 的分组默认折叠

在 `renderNavItems()` 中，第 247 行 `section.className = 'nav-section'` 之后，添加：
```typescript
// 有 overview 的分组默认折叠，引导用户点击发现总览
if (item.overview) {
  section.classList.add('collapsed')
}
```

**修改 B**：移除"哈吉语"字样

- 第 209 行：`<h1 class="sidebar-title">世界观设定集</h1>`（去掉"哈吉语"和换行 `<br>`）
- 第 216 行：`<h2>世界观设定集</h2>`（去掉"哈吉语"）
- 第 218-221 行：替换整段占位文案为中性描述，例如：
  ```html
  <p>从左侧导航选择文档，或使用搜索功能查找设定。</p>
  <p style="margin-top: 1rem; color: var(--text-secondary)">
    本设定集是一个独立的世界观构建项目，<br>
    涵盖地理、历史、种族、文化、力量体系等诸多元宇宙模块。
  </p>
  ```

### 文件 3：`web/index.html`

**修改**：第 6 行 `<title>世界观设定集</title>`

---

## 验证步骤

1. `npm run dev` 启动本地开发服务器
2. 打开 `http://localhost:5173/`
3. 确认左侧导航中"大陆A""种族A"等有子项的分组默认折叠，箭头为 ▶
4. 点击"大陆A" → 展开，箭头变为 ▼，右侧加载总览文档
5. 再次点击"大陆A" → 折叠，箭头变回 ▶，右侧内容不变
6. 确认页面标题、侧栏标题、占位文案中不再出现"哈吉语"
7. `npm run build` 构建成功，推送到 gh-pages