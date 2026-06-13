# 移动端 UI 修复与优化 Spec

## Why
当前移动端响应式实现使用 `html { font-size: 8px/9px }` 的全局缩放策略，导致所有 `rem` 单位被严重缩小——正文仅约 7.2px、导航链接约 6px、触控目标远低于 44px 标准，严重影响可读性和可用性。需要彻底修复移动端排版策略，确保在 320px–428px 主流手机视口下可读、可触控、可用。

## What Changes
- 移除 `html { font-size: 8px/9px }` 的破坏性缩放，改为基于合理基础字号（14–16px）的 rem 排版
- 手机端内容区 padding 改为 16px，正文 ≥ 15px，标题逐级缩小
- 侧边栏在 ≤768px 时宽度改为 280px（固定），使用 `left: -280px` 滑入
- 汉堡按钮、帮助按钮、标注按钮等触控目标 ≥ 44px
- 标注面板在 ≤600px 下改为 `width: 100vw; height: 100dvh; border-radius: 0`
- 变更面板在 ≤600px 下改为 `width: 100vw`
- 角标在 ≤600px 下 ≥ 26×26px，字号 ≥ 13px
- 气泡弹窗在 ≤600px 下 max-width: 90vw
- 格式化工具栏按钮在手机端 ≥ 40×36px，一行可见
- 主页标题在 ≤600px 下 h1 为 32px
- 表格横向滚动
- 添加 `safe-area-inset` 支持刘海屏
- 移除 `touch-action: manipulation` 允许用户缩放

## Impact
- Affected specs: `mobile-responsive-ui`（替代其实现）
- Affected code: `web/src/style.css`（主要，重写移动端媒体查询）、`web/src/main.ts`（少量调整）

## MODIFIED Requirements

### Requirement: 移动端基础排版策略
系统 SHALL 在视口宽度 ≤ 768px 时使用合理的基础字号（14–16px），而非通过缩小 `html { font-size }` 来缩放全局。

#### Scenario: 手机端基础字号正常
- **WHEN** 用户在宽度 ≤ 768px 的设备上打开页面
- **THEN** `html` 的 `font-size` 保持 16px（或 ≥ 14px），正文段落字号 ≥ 15px，可正常阅读

### Requirement: 手机端侧边栏抽屉式导航（修复）
系统 SHALL 在视口宽度 ≤ 768px 时将侧边栏改为固定宽度 280px 的覆盖式抽屉，默认隐藏。

#### Scenario: 手机端侧边栏默认隐藏
- **WHEN** 用户在宽度 ≤ 768px 的设备上打开页面
- **THEN** 侧边栏 `position: fixed`，`width: 280px`，`left: -280px`，不占据布局空间

#### Scenario: 点击汉堡按钮展开侧边栏
- **WHEN** 用户点击汉堡按钮（≥ 44×44px 触控区域）
- **THEN** 侧边栏从左侧滑入（`left: 0`），显示半透明遮罩层

#### Scenario: 点击遮罩或导航项关闭侧边栏
- **WHEN** 用户点击遮罩层或选择任意导航项
- **THEN** 侧边栏滑出隐藏，遮罩消失

### Requirement: 手机端内容区自适应（修复）
系统 SHALL 在视口宽度 ≤ 768px 时调整内容区排版，确保可读且不横向溢出。

#### Scenario: 内容区内边距和字号
- **WHEN** 用户在手机端查看文档内容
- **THEN** 内容区左右 padding 为 16px，正文 p 字号 15px，h1 约 22px，h2 约 18px，h3 约 16px

#### Scenario: 表格横向滚动
- **WHEN** 文档内容包含宽表格且视口不足以完整显示
- **THEN** 表格容器出现横向滚动条，表格本身不溢出视口

### Requirement: 手机端标注面板全屏化（修复）
系统 SHALL 在视口宽度 ≤ 600px 时将标注面板改为全屏模态框。

#### Scenario: 手机端打开标注面板
- **WHEN** 用户在手机端点击"+"按钮打开标注面板
- **THEN** 面板 `width: 100vw; height: 100dvh; border-radius: 0`，表单字段字号 ≥ 16px（防 iOS 缩放），按钮最小高度 44px

#### Scenario: 格式化工具栏按钮不换行
- **WHEN** 标注面板在手机端打开
- **THEN** 格式化工具栏按钮 `min-width: 40px; height: 36px`，所有 6 个按钮在一行内可见

### Requirement: 手机端变更记录面板全宽化（修复）
系统 SHALL 在视口宽度 ≤ 600px 时将变更记录面板改为全宽。

#### Scenario: 手机端打开变更记录面板
- **WHEN** 用户在手机端点击右下角编辑图标
- **THEN** 面板 `width: 100vw`，从右侧滑入，操作按钮触控区域 ≥ 36×36px

### Requirement: 手机端角标放大（修复）
系统 SHALL 在视口宽度 ≤ 600px 时将角标放大以适配手指触控。

#### Scenario: 手机端角标尺寸
- **WHEN** 用户在手机端查看有角标的段落
- **THEN** 角标最小尺寸 26×26px，字号 13px，确保手指可点击

### Requirement: 手机端气泡弹窗宽度限制（修复）
系统 SHALL 在视口宽度 ≤ 600px 时限制气泡弹窗最大宽度。

#### Scenario: 手机端气泡弹窗
- **WHEN** 用户在手机端点击角标
- **THEN** 气泡弹窗最大宽度 90vw，内部文字不溢出

### Requirement: 手机端主页标题缩小（修复）
系统 SHALL 在视口宽度 ≤ 600px 时将主页标题字号缩小。

#### Scenario: 手机端主页标题
- **WHEN** 用户在手机端查看主页
- **THEN** h1 字号 32px，正文 16px

### Requirement: 触控目标最小尺寸
系统 SHALL 确保所有交互元素在移动端（≤768px）的触控目标 ≥ 44px（主按钮）或 ≥ 36px（次要按钮）。

#### Scenario: 汉堡按钮触控区域
- **WHEN** 用户在手机端查看页面
- **THEN** 汉堡按钮最小 44×44px，帮助按钮最小 44×44px

### Requirement: 安全区域适配
系统 SHALL 在移动端使用 `env(safe-area-inset-*)` 适配刘海屏和底部指示条。

#### Scenario: iPhone 刘海屏
- **WHEN** 用户在带有刘海/底部指示条的设备上查看
- **THEN** 侧边栏顶部、内容区底部等关键区域不会被系统 UI 遮挡

### Requirement: 允许用户缩放
系统 SHALL 移除 `touch-action: manipulation` 和 `-webkit-touch-callout: none`，允许用户双指缩放页面。

#### Scenario: 用户双指缩放
- **WHEN** 用户在移动端双指缩放
- **THEN** 页面正常缩放，不被阻止

## REMOVED Requirements
无