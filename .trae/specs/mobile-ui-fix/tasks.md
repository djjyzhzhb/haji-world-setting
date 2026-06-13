# Tasks

- [x] Task 1: 修复移动端基础排版（CSS）
  - [x] 移除 `html { font-size: 8px/9px }` 的破坏性缩放，在媒体查询中不对 `html` 设置 `font-size`
  - [x] 重写 `@media (max-width: 768px)` 中所有 `rem` 值为合理的 `px` 值：正文 15px，h1 22px，h2 18px，h3 16px
  - [x] 内容区 `padding: 16px`，`max-width: 100%`，侧边栏内部间距用 px 重新设定
  - [x] 移除 `body` 上的 `touch-action: manipulation` 和 `-webkit-touch-callout: none`，允许用户缩放
  - [x] 添加 `padding-top: env(safe-area-inset-top)` 和 `padding-bottom: env(safe-area-inset-bottom)` 到关键区域

- [x] Task 2: 修复侧边栏抽屉式导航（CSS + TS）
  - [x] ≤768px 断点下侧边栏改为 `width: 280px; left: -280px`（固定 px 宽度，不用 vw）
  - [x] 汉堡按钮改为 `width: 44px; height: 44px`，字体 24px
  - [x] 帮助按钮改为 `width: 44px; height: 44px`，字体 24px
  - [x] 侧边栏导航项字体调至 13–14px，section header 调至 11–12px，确保可读
  - [x] 遮罩层样式保持不变
  - [x] 在 `main.ts` 中汉堡按钮使用 CSS 类控制 44px 最小触控区域（已有 CSS 定义）

- [x] Task 3: 修复标注面板全屏化（CSS）
  - [x] ≤600px 断点下 `.annotate-panel-card` 改为 `width: 100vw; height: 100dvh; border-radius: 0; max-width: 100vw; max-height: 100dvh`
  - [x] 表单字段 `input, select, textarea` 字号 ≥ 16px（防 iOS 缩放），按钮最小高度 44px
  - [x] 格式化工具栏按钮 `min-width: 40px; height: 36px; font-size: 14px`，父容器 `flex-wrap: nowrap`
  - [x] 面板内边距、标签字号用 px 合理设定

- [x] Task 4: 修复变更记录面板全宽化（CSS）
  - [x] ≤600px 断点下 `.changes-panel` 改为 `width: 100vw; right: -100vw`
  - [x] 变更条目操作按钮最小触控区域 36×36px，字体 14px
  - [x] 面板底部按钮最小高度 44px，字号 14px
  - [x] 面板内搜索框、状态筛选等表单元素字号 ≥ 16px

- [x] Task 5: 修复角标和气泡弹窗（CSS）
  - [x] ≤600px 断点下 `.annotate-badge` 最小尺寸 26×26px，字号 13px，`line-height: 26px`
  - [x] ≤600px 断点下 `.badge-popover` 最大宽度 90vw
  - [x] 气泡弹窗内部文字字号 ≥ 13px

- [x] Task 6: 修复主页和欢迎弹窗（CSS）
  - [x] ≤600px 断点下 `.home-content h1` 字号 32px，正文 16px
  - [x] 欢迎弹窗在 ≤600px 下字号合理（≥ 14px），按钮高度 ≥ 44px

- [x] Task 7: 合并 600px 和 768px 断点，消除重复
  - [x] 审查 600px 和 768px 两个断点中的重复样式，合并到 768px 断点
  - [x] 600px 断点仅保留与 768px 有差异的覆盖样式

# Task Dependencies
- Task 1 是基础，必须先完成
- Task 2–6 可并行，均依赖 Task 1
- Task 7 在 Task 2–6 全部完成后进行