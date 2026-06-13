# Tasks

- [x] Task 1: 侧边栏抽屉式导航（CSS + TS）
  - [x] 在 `style.css` 中添加 ≤768px 断点：侧边栏改为 `position: fixed`，`left: -280px`，`transition`，展开时 `left: 0`，添加遮罩层样式
  - [x] 在 `main.ts` 中动态创建汉堡按钮（☰），绑定点击事件切换侧边栏展开/收起
  - [x] 点击遮罩层或选择导航项后自动关闭侧边栏
  - [x] 搜索框在手机端保持可用

- [x] Task 2: 内容区排版自适应（CSS）
  - [x] ≤768px 断点下调整内容区 padding 为 16px，正文 p 字号 15px，h1/h2/h3 字号等比缩小
  - [x] 为 `.content-body table` 添加 `overflow-x: auto` 包裹（通过 CSS `display: block` 或 JS 包裹）
  - [x] 主页 `.home-content h1` 在 ≤600px 下字号 32px，正文 16px，margin-top 调整

- [x] Task 3: 标注面板手机端全屏化（CSS）
  - [x] ≤600px 断点下 `.annotate-panel-card` 改为 `width: 100vw; height: 100dvh; border-radius: 0`
  - [x] 表单字段 input/select/textarea 字号 ≥ 16px（防止 iOS 缩放），按钮最小高度 44px
  - [x] 格式化工具栏按钮调整为 `min-width: 40px; height: 36px`

- [x] Task 4: 变更记录面板手机端全宽化（CSS）
  - [x] ≤600px 断点下 `.changes-panel` 宽度改为 `100vw`，`right: -100vw`
  - [x] 变更条目操作按钮间距增大，最小触控区域 36×36px
  - [x] 面板底部按钮调整，确保不重叠

- [x] Task 5: 角标和气泡弹窗手机端适配（CSS + TS）
  - [x] ≤600px 断点下 `.annotate-badge` 最小尺寸 26×26px，字号 13px
  - [x] ≤600px 断点下 `.badge-popover` 最大宽度 90vw
  - [x] 在 `changes.ts` 的 `openBadgePopover` 定位逻辑中，手机端优先使用下方弹出，避免左右空间不足

# Task Dependencies
- Task 2 可与 Task 1 并行
- Task 3、Task 4、Task 5 可并行，均不互相依赖
- 所有 Task 均只修改 CSS 和少量 TS，无构建配置变更