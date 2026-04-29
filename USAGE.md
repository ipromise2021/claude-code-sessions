# claude-code-sessions 使用文档

一套管理 Claude Code 会话的工具集，支持 MCP Server、Web UI、VSCode 扩展三种使用方式。

## 目录

- [前置条件](#前置条件)
- [数据存储结构](#数据存储结构)
- [方式一：MCP Server](#方式一mcp-server)
  - [安装](#安装)
  - [所有 MCP 工具详解](#所有-mcp-工具详解)
  - [典型对话示例](#典型对话示例)
- [方式二：Web UI](#方式二web-ui)
  - [独立运行](#独立运行)
  - [界面功能](#界面功能)
- [方式三：VSCode 扩展](#方式三vscode-扩展)
- [常见工作流](#常见工作流)
- [FAQ](#faq)

---

## 前置条件

- **Node.js** >= 20.19.0 或 >= 22.12.0
- **Claude Code** 已安装并使用过（产生会话数据）
- 会话数据存放在 `~/.claude/projects/` 目录下

验证你是否有会话数据：

```bash
ls ~/.claude/projects/
# 示例输出：
# -Users-yy0812024-prv-dev-myproject
# -Users-yy0812024-work-otherproject
```

每个目录对应一个 Claude Code 使用过的项目。

---

## 数据存储结构

理解底层数据布局有助于更好地使用工具：

```
~/.claude/
├── projects/                          # 会话目录
│   └── -Users-yy0812024-prv-dev-myproject/   # 项目文件夹（路径中非字母数字字符替换为 -）
│       ├── abc12345-1234-1234-1234-123456789abc.jsonl    # 主会话文件
│       ├── def67890-1234-1234-1234-123456789def.jsonl    # 另一个会话
│       ├── agent-xxx11111-1111-1111-1111-111111111xxx.jsonl  # 子 agent 会话
│       ├── .tree-cache.json           # 缓存文件（性能优化）
│       ├── sessions-index.json        # 官方扩展索引文件
│       └── .bak/                      # 备份目录（删除的会话移到这里）
│           └── -Users-yy0812024-prv-dev-myproject_abc12345-....jsonl
├── todos/                             # Todo 记录
│   └── abc12345-....json              # 按会话 ID 存储的 todo
└── file-history/                      # 文件历史快照
    └── abc12345-..../
        └── <backup-file>
```

**关键概念**：

- **sessionId**：会话的唯一标识，即 JSONL 文件名去掉 `.jsonl` 后缀（UUID 格式）
- **projectName**：项目文件夹名，由工作目录路径转换而来（如 `/Users/me/work` → `-Users-me-work`）
- **删除 = 软删除**：`delete_session` 把文件移到 `.bak/` 目录，可以通过 `restoreSession` 恢复
- **跨会话引用**：`summary` 类型的消息通过 `leafUuid` 引用其他会话的消息

---

## 方式一：MCP Server

MCP Server 让 Claude Code 能够**自己管理自己的会话**。安装后，你可以在对话中直接让 Claude 搜索、查看、清理历史会话。

### 安装

```bash
# 添加 MCP Server
claude mcp add claude-sessions -- npx claude-sessions-mcp

# 或使用 beta 版本（最新功能）
claude mcp add claude-sessions-beta -- npx claude-sessions-mcp@beta
```

也可以手动编辑 `~/.claude.json`：

```json
{
  "mcpServers": {
    "claude-sessions": {
      "command": "npx",
      "args": ["-y", "claude-sessions-mcp"]
    }
  }
}
```

**重启 Claude Code** 后生效。

验证安装：在 Claude Code 对话中输入 `list_projects` 看看是否返回项目列表。

### 所有 MCP 工具详解

#### `list_projects` — 列出所有项目

列出你使用过 Claude Code 的所有项目及其会话数。

```
你：列出我的所有 Claude Code 项目

Claude 会调用 list_projects，返回：
[
  {
    "name": "-Users-me-work-myapp",
    "displayName": "/Users/me/work/myapp",
    "path": "~/work/myapp",
    "sessionCount": 14,
    "lastModified": 1712345678000
  },
  {
    "name": "-Users-me-prv-lib",
    "displayName": "/Users/me/prv/lib",
    "path": "~/prv/lib",
    "sessionCount": 3,
    "lastModified": 1712300000000
  }
]
```

注意 `name` 是内部标识（用于后续 API 调用的 `project_name` 参数），`displayName` 和 `path` 是人类可读的。

#### `list_sessions` — 列出项目中的所有会话

**参数**：

- `project_name`（必填）：项目文件夹名，来自 `list_projects` 返回的 `name` 字段

```
你：列出 myapp 项目的所有会话

Claude 调用 list_sessions，返回：
[
  {
    "id": "abc12345-1234-1234-1234-123456789abc",
    "projectName": "-Users-me-work-myapp",
    "title": "帮我实现用户登录功能",
    "agentName": "Login Feature",
    "customTitle": "用户登录模块开发",
    "currentSummary": "实现了基于 JWT 的用户登录...",
    "messageCount": 42,
    "createdAt": "2026-04-20T10:30:00.000Z",
    "updatedAt": "2026-04-20T14:22:00.000Z"
  }
]
```

#### `search_sessions` — 搜索会话（MCP 内部使用 `searchSessions` 实现）

按标题或内容搜索会话。适用于跨项目模糊查找。

```
你：帮我搜索所有和 "JWT" 相关的会话

Claude 会搜索所有项目的会话标题和内容。
```

#### `rename_session` — 重命名会话

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID
- `new_title`：新标题

```
你：把会话 abc12345 重命名为 "JWT 认证重构"

Claude 调用 rename_session → { "success": true }
```

> 注意：重命名会同时修改会话文件中的 `custom-title` 和 `agent-name` 记录，并更新其他会话中指向该会话的 summary。

#### `delete_session` — 删除会话

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID

```
你：删除会话 abc12345

Claude 调用 delete_session → {
  "success": true,
  "backupPath": "/Users/me/.claude/projects/.bak/-Users-me-work-myapp_abc12345-....jsonl",
  "deletedAgents": 2,
  "deletedTodos": 3
}
```

> 会话文件被移到 `.bak/` 目录而非永久删除。如有误删，可以通过 `restoreSession` 恢复。

#### `delete_message` — 删除会话中的某条消息

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID
- `message_uuid`：要删除的消息 UUID

删除后会自动修复消息链（`parentUuid` 指向关系）。

#### `split_session` — 拆分会话

将会话在指定消息处一分为二。从该消息开始的内容移入新会话，之前的留在原会话。

**参数**：

- `project_name`：项目名
- `session_id`：原会话 ID
- `message_uuid`：拆分点消息的 UUID

```
你：在消息 xyz789 处把会话 abc123 拆分成两个

Claude 调用 split_session → {
  "success": true,
  "newSessionId": "new-uuid-here",
  "movedMessageCount": 15
}
```

> 适用场景：一个会话做了太多事，想拆成独立主题的多个会话方便回顾。

#### `preview_cleanup` — 预览可清理的会话

**参数**：

- `project_name`（可选）：限定某个项目，不传则检查所有项目

```
你：看看有哪些可以清理的空会话

Claude 调用 preview_cleanup → [
  {
    "project": "-Users-me-work-myapp",
    "emptySessions": [
      { "id": "empty-session-1", "title": "", "messageCount": 0 }
    ],
    "invalidSessions": [],
    "orphanAgentCount": 3,
    "orphanTodoCount": 1
  }
]
```

返回内容：

- `emptySessions`：无实质消息的空会话
- `invalidSessions`：标题包含 "Invalid API key" 的错误会话
- `orphanAgentCount`：主会话已不存在但 agent 文件残留的数量
- `orphanTodoCount`：没有对应会话的孤立 todo 数量

#### `clear_sessions` — 执行清理

**参数**：

- `project_name`（可选）：限定项目范围
- `clear_empty`（默认 true）：删除空会话
- `clear_invalid`（默认 true）：删除包含无效 API key 消息的记录
- `clear_orphan_agents`（默认 true）：删除孤立 agent 文件

```
你：执行清理，移除所有空会话和无效会话

Claude 调用 clear_sessions → {
  "success": true,
  "deletedCount": 5,
  "deletedOrphanAgentCount": 3,
  "deletedOrphanTodoCount": 1
}
```

> **强烈建议先 `preview_cleanup` 再 `clear_sessions`**，确认要删除的内容。

#### `get_session_files` — 获取会话中修改的文件列表

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID

```
你：会话 abc123 修改了哪些文件

Claude 调用 get_session_files → {
  "sessionId": "abc123",
  "files": [
    { "path": "src/auth/login.ts", "action": "modified" },
    { "path": "src/auth/middleware.ts", "action": "created" }
  ],
  "totalChanges": 2
}
```

#### `analyze_session` — 分析会话

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID

返回统计信息：消息数、工具使用频率、时长、识别的模式等。

```
你：分析一下会话 abc123

Claude 返回：
{
  "sessionId": "abc123",
  "durationMinutes": 45,
  "stats": {
    "totalMessages": 85,
    "userMessages": 22,
    "assistantMessages": 42,
    "summaryCount": 3,
    "snapshotCount": 2
  },
  "toolUsage": [
    { "name": "Read", "count": 25, "errorCount": 0 },
    { "name": "Write", "count": 12, "errorCount": 1 },
    { "name": "Bash", "count": 15, "errorCount": 2 }
  ],
  "filesChanged": ["src/auth/login.ts", "src/auth/middleware.ts"],
  "patterns": [
    { "type": "test_failure", "description": "Repeated test failures on login flow", "count": 3 }
  ]
}
```

#### `summarize_session` — 生成会话摘要

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID
- `limit`（默认 50）：最多包含的消息数
- `max_length`（默认 100）：每条消息内容的最大长度

以时间线格式输出整个会话的 user/assistant 对话。

#### `compress_session` — 压缩会话文件

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID
- `keep_snapshots`：`first_last`（默认，保留首尾）/ `all`（全部保留） / `none`（全部移除）
- `max_tool_output_length`（默认 0-不限制）：工具输出截断长度

减少会话文件大小。对于长期项目很有用。

#### `repair_chain` — 修复会话消息链

**参数**：

- `project_name`：项目名
- `session_id`：会话 ID

消息通过 `uuid`/`parentUuid` 形成链表。如果链断裂（如手动编辑或 bug 导致），此工具会按时间戳重新链接。

#### `start_gui` / `stop_gui` — 启动/停止 Web UI

**参数（start_gui）**：

- `port`（默认 5173）
- `open_browser`（默认 true）：是否自动打开浏览器
- `restart`（默认 false）：已在运行时是否重启
- `editor`（可选）：打开文件的编辑器命令，如 `code`、`cursor`
- `home`（可选）：`~` 展开的目标目录
- `project`（可选）：当前项目名，影响项目列表排序

```
你：启动 Web UI

Claude 调用 start_gui → {
  "success": true,
  "message": "Web GUI started successfully",
  "url": "http://localhost:5173"
}

// 浏览器自动打开 http://localhost:5173
```

```
你：关闭 Web UI

Claude 调用 stop_gui → { "success": true }
```

### 典型对话示例

**场景 1：回顾今天做了什么**

```
你：我今天做了哪些工作？列出所有项目今天的会话。

Claude：[调用 list_projects → list_sessions]
今天在 myapp 项目有 3 个会话：
- "修复登录超时问题"（14:30, 38 条消息）
- "添加用户头像上传"（11:00, 25 条消息）
- "重构数据库查询"（09:00, 52 条消息）
```

**场景 2：搜索之前的知识**

```
你：上次那个 JWT refresh token 的实现是怎么做的？搜索一下。

Claude：[搜索所有项目，找到相关会话]
在 myapp 项目的会话 "JWT 认证重构" 中（4月20日），实现方式是：
[调用 summarize_session 获取摘要]
...展示关键实现步骤...
```

**场景 3：清理旧会话**

```
你：帮我清理一下空会话

Claude：
1. [调用 preview_cleanup] 发现 5 个空会话和 3 个孤立 agent
2. [向你展示详情]
3. 你确认后 [调用 clear_sessions] 清理完成
```

---

## 方式二：Web UI

### 独立运行

```bash
# 直接运行
npx @claude-sessions/web

# 指定端口
npx @claude-sessions/web --port 3000

# 配置编辑器（点击文件名时用 cursor 打开）
npx @claude-sessions/web --editor cursor

# 指定 home 目录（Docker 等场景）
npx @claude-sessions/web --home /custom/home

# 指定当前项目（影响排序优先级）
npx @claude-sessions/web --project -Users-me-work-myapp
```

启动后访问 `http://localhost:5173`。

**所有 CLI 选项**：

| 选项                  | 说明                   | 默认值                                      |
| --------------------- | ---------------------- | ------------------------------------------- |
| `-p, --port <number>` | 服务器端口             | `5173`                                      |
| `--editor <cmd>`      | 打开文件的编辑器命令   | 环境变量 `CLAUDE_SESSIONS_EDITOR` 或 `code` |
| `--home <path>`       | `~` 展开目录           | 系统 `homedir()`                            |
| `--project <name>`    | 当前项目名（优先排序） | 无                                          |
| `-V, --version`       | 显示版本               | -                                           |
| `-h, --help`          | 帮助信息               | -                                           |

**环境变量**（不通过 CLI 时可用）：

| 变量                      | 说明       |
| ------------------------- | ---------- |
| `CLAUDE_SESSIONS_EDITOR`  | 编辑器命令 |
| `CLAUDE_SESSIONS_HOME`    | Home 目录  |
| `CLAUDE_SESSIONS_PROJECT` | 当前项目名 |
| `PORT`                    | 服务端口   |

### 界面功能

Web UI 启动后，页面结构从左到右分为三栏：

#### 左侧栏 — 项目树

- 展开/折叠项目文件夹
- 每个项目下列出所有会话
- 会话按时间或标题排序（可切换）
- 悬停显示会话详情（tooltip）：消息数、agent 数、todo 数

**排序选项**：

- **Summary**：按 summary 时间排序（默认）
- **Modified**：按文件修改时间
- **Created**：按创建时间
- **Updated**：按最后消息时间
- **Message Count**：按消息数
- **Title**：按标题字母序

#### 中间栏 — 会话详情 / 消息查看

点击会话后显示：

- **Messages 标签页**：完整对话历史，支持搜索和过滤
  - 过滤 user / assistant / summary / tool 等消息类型
  - 工具调用展开显示详细输入/输出
  - thinking 块可折叠
- **Files 标签页**：该会话修改过的文件列表
- **Analysis 标签页**：会话统计分析（时长、工具使用频率等）

**消息类型过滤**：

| 类型                          | 说明                              |
| ----------------------------- | --------------------------------- |
| `user`                        | 用户输入                          |
| `assistant`                   | 助手回复（含 thinking、tool_use） |
| `summary`                     | 上下文压缩摘要                    |
| `system`                      | 系统通知                          |
| `file-history-snapshot`       | 文件变更快照                      |
| `custom-title` / `agent-name` | 标题相关元数据                    |

#### 右侧操作区

- **Rename**：重命名会话（弹窗输入新标题）
- **Delete Session**：删除会话（确认后移到 .bak）
- **Delete Message**：删除单条消息
- **Split**：在指定消息处拆分会话
- **Move**：把会话移到另一个项目
- **Repair Chain**：修复断链
- **Compress**：压缩会话文件

#### Toast 通知

所有操作（重命名、删除等）的结果会通过底部 Toast 通知显示。

---

## 方式三：VSCode 扩展

### 安装

从 VSIX 文件本地安装：

```bash
cd packages/vscode-extension
pnpm install
pnpm build
pnpm package

# 安装生成的 .vsix 文件
code --install-extension claude-sessions-vscode-0.1.0.vsix
```

或从 Marketplace 搜索 `Claude Code Sessions`。

### 使用

1. 点击 Activity Bar（左侧边栏）中的 Claude Code Sessions 图标
2. 侧边栏出现项目/会话树视图
3. 点击会话查看消息详情（Webview 面板中）
4. 右键菜单提供重命名、删除等操作
5. 工具栏按钮：刷新、打开 Web UI、清理

### 命令列表

| 命令                                          | 说明                         |
| --------------------------------------------- | ---------------------------- |
| `Claude Code Sessions: Refresh`               | 刷新会话列表                 |
| `Claude Code Sessions: Open Web UI`           | 打开 Web 界面                |
| `Claude Code Sessions: Cleanup`               | 一键清理空/无效会话          |
| `Claude Code Sessions: Resume Session`        | 在终端中恢复会话（继续对话） |
| `Claude Code Sessions: Resume Session (YOLO)` | 恢复会话并跳过权限确认       |

### 配置

在 VSCode `settings.json` 中：

```json
{
  "claudeSessions.sortField": "updated",
  "claudeSessions.sortOrder": "desc",
  "claudeSessions.webServerPath": "npx",
  "claudeSessions.webServerArgs": ["-y", "@claude-sessions/web"]
}
```

---

## 常见工作流

### 1. 日常回顾

```
# CLI 中
claude mcp add claude-sessions -- npx claude-sessions-mcp
# 然后在对话中：
"我今天做了哪些工作？"
```

在 Claude Code 对话中，Claude 会调用 MCP 工具列出当天的会话、简要内容。

### 2. 搜索知识 / 找回历史上下文

```
"上次那个 Redis 缓存的实现是怎么做的？搜一下历史会话"
```

Claude 会跨项目搜索，找到相关会话后调用 `summarize_session` 获取关键内容。

### 3. 拆分超长会话

当一个会话做了太多不相关的事时：

1. 打开 Web UI 或 VSCode 扩展
2. 找到会话，浏览消息找到拆分点
3. 点击 Split，输入拆分点消息的 UUID
4. 原会话保留后半部分（更新），前半部分移入新会话
5. 可对新会话单独重命名

### 4. 定期清理

```
"帮我清理空的会话和孤立文件"

# Claude 先预览：
[preview_cleanup] → 5 个空会话、3 个孤立 agent

# 确认后执行：
[clear_sessions] → 清理完成
```

建议每 1-2 周清理一次。注意：有 Todo 的会话默认不会被清理。

### 5. 跨项目移动会话

在 Web UI 中：

1. 选择会话 → Move
2. 选择目标项目
3. 会话文件和关联的 agent/todo 会被一起移动

适用场景：会话操作的是项目 A 的文件，但实际上是为项目 B 做的调研。

### 6. 分析会话效率

```
"分析一下会话 abc123"

[analyze_session] →
- 时长 52 分钟
- 工具调用 89 次，其中 Read 占 60%（可能需要更多上下文）
- 3 次重复错误（相同 bug 反复出现）
```

帮助发现可优化的模式。

---

## FAQ

### Q: 删除的会话能恢复吗？

能。`delete_session` 是软删除，文件被移到 `~/.claude/projects/.bak/` 目录。格式为 `{projectName}_{sessionId}.jsonl`。

在 Web UI 中可以通过 Backup 功能查看和恢复已删除的会话。也可以通过代码调用 `restoreSession`。

### Q: MCP Server 和 Web UI 有什么区别？

| 对比维度 | MCP Server                | Web UI                         |
| -------- | ------------------------- | ------------------------------ |
| 访问方式 | 在 Claude Code 对话中操作 | 浏览器 `http://localhost:5173` |
| 交互模式 | 自然语言                  | 图形界面（鼠标点击）           |
| 适合场景 | 搜索、清理、自动处理      | 浏览、查看消息详情、手动操作   |
| 依赖     | 需要 Claude Code          | 可独立运行                     |

两者可以同时使用。MCP Server 的 `start_gui` 工具也能启动 Web UI。

### Q: 项目名（project_name）怎么获取？

`list_projects` 返回的 `name` 字段。或者直接查看 `~/.claude/projects/` 目录下的文件夹名。

### Q: 会话 ID（session_id）怎么获取？

`list_sessions` 返回的 `id` 字段。或者在 Web UI 中会话标题旁边显示。

### Q: 支持 Windows 吗？

核心库跨平台（处理了 Windows 路径 `C:\` 和 `C--` 格式的转换）。MCP Server 和 Web UI 在 Windows 上可正常运行。

VSCode 扩展的 Resume Session 功能在 Windows 上通过 `cmd.exe` 启动终端，Linux 上检测 gnome-terminal/konsole/xterm，macOS 上使用 AppleScript 调起 Terminal.app。

### Q: 多个机器之间能同步会话吗？

目前不能。会话数据是纯本地文件。但可以通过 `~/.claude/projects/` 目录的 Git 管理或 rsync 等做到手动同步。需注意 `.tree-cache.json` 等缓存文件不应同步。

### Q: 安全吗？

所有操作都是纯本地的，不联网。会话文件只读/写入 `~/.claude/` 目录。删除操作是软删除（移到 `.bak`）。

如果使用 Web UI，服务仅监听 localhost，外部无法访问（除非你主动暴露端口）。
