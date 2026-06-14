var e=`# 变更文档系统

## 目录结构

| 目录 | 用途 |
|------|------|
| \`pending/\` | 待处理的变更（AI 下次会话时读取） |
| \`reviewed/\` | 已审阅，待决定是否应用 |
| \`applied/\` | 已应用到正式文档中 |
| \`rejected/\` | 已拒绝的变更 |

## 变更文档格式

每条变更一个 JSON 文件，命名格式：\`CHG-YYYYMMDD-NNN.json\`

\`\`\`json
{
  "id": "CHG-20260612-001",
  "type": "annotation",
  "author": "user",
  "timestamp": "2026-06-12T14:30:00+08:00",
  "target": {
    "docPath": "05_文化与社会/01_语言文化桥梁.md",
    "section": "## 语言与世界观"
  },
  "content": {
    "summary": "简短标题",
    "body": "详细内容",
    "tags": ["标签1", "标签2"]
  },
  "status": "pending"
}
\`\`\`

## 变更类型

| 类型 | 含义 |
|------|------|
| \`annotation\` | 标注/注释 |
| \`draft\` | 草稿/灵感片段 |
| \`correction\` | 修正建议 |
| \`idea\` | 灵感笔记 |

## 使用方式

1. 在网页端浏览文档，点击段落旁的 + 标注
2. 填写内容后点击下载，保存 JSON 文件
3. 将 JSON 文件放入 \`pending/\` 目录
4. AI 下次会话时读取并处理`;export{e as default};