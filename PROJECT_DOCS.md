# PWA Todo 项目文档

## 概述

PWA Todo 是一个功能丰富的离线优先待办事项应用，基于 PWA（Progressive Web App）技术构建。它不仅是简单的 Todo 列表，还集成了专注倒计时、BGM 白噪音、每日总结评分、重复任务规则、贡献热力图、后悔币系统、每日结算以及基于 Supabase 的云端同步等高级功能。应用版本：v0.1.3。

## 技术栈

- **前端**：原生 HTML、CSS、JavaScript（ES Modules）
- **本地存储**：IndexedDB（通过 `app/db.js` 封装）
- **离线支持**：Service Worker（Cache First 策略）
- **云同步**：Supabase REST API + PostgreSQL
- **PWA 能力**：Web App Manifest、可安装到主屏幕
- **音频**：Web Audio / HTML5 Audio（BGM 背景音乐 + 闹钟）
- **主题**：CSS 自定义属性实现深色/浅色主题切换

## 核心功能

### 1. 待办事项管理
- 按分类组织：Work、Life、Health、Social、Growth、Leisure、Plan
- 为每项任务设置预计时长（分钟）
- 切换完成状态、删除（软删除）、支持行内编辑
- 最多同时进行 2 个任务（进行中限制），任务进行时跟踪已用时间
- 前一天未完成任务自动顺延到当天

### 2. 专注倒计时
- 可设置倒计时分钟数，默认 90 分钟
- 开始/结束、暂停/恢复、重置
- 圆环进度条实时展示剩余时间
- 计时会话自动记录为工作时间段（timer timeline），按分钟分组
- 跨 tab 租约机制，防止多窗口同时运行倒计时
- 倒计时归零时播放闹钟提示

### 3. BGM 背景音乐
- 内置 pink noise 白噪音音频
- 支持用户上传自定义音频文件
- 音量控制（BGM 音量 + 铃声音量独立调节）
- 播放状态管理（playing / paused / stopped / loading）
- 自动恢复：处理浏览器自动播放拦截、后台暂停等异常场景

### 4. 日期导航
- 按日期隔离查看待办事项和总结
- 日期选择器 + 前一天/后一天/回到今日按钮
- 显示当天是星期几

### 5. 重复任务规则
- 支持多种频率：每天、每周、每月、每年、每个工作日、自定义间隔
- 每周可指定具体星期几、每月可指定具体日期
- 自定义间隔可设置周期（如每 3 天）和单位（天/周/月/年）
- 可对特定日期跳过某条重复规则
- 在对应日期自动根据规则生成待办事项

### 6. 每日总结
- 文本总结自由输入
- 1-5 星评分
- "你今天累吗"每日疲劳度调研
- 总结数据保存到 IndexedDB，可同步到云端

### 7. 贡献图与数据可视化
- **2026 上半年热力图**：根据每日评分渲染类似 GitHub 贡献图的色块，支持 H1/H2 半年度切换
- **当日工作时间段图**：以时间轴形式展示当天的计时会话，支持编辑时间段（手动修改/增删）
- **2026 上半年任务完成图**：展示每天任务完成情况

### 8. 后悔币系统
- 通过每日专注结算奖励获得后悔币
- 专注评分等级决定奖励数量
- 消耗后悔币功能，用于自我激励和约束
- 后悔币账本存储在 IndexedDB，可同步到云端

### 9. 每日结算
- 在检测到新的一天时自动弹出每日结算弹窗
- 展示昨日总结、评分等级、专注统计
- 根据评分等级（学废/摸鱼/浪/沉淀/成长）发放后悔币奖励
- 根据昨日未完成任务给出今日任务延续提示

### 10. 云端同步
- 三种同步模式：双向同步、仅拉取、仅上传
- 基于 UUID 和时间戳的增量同步策略
- 同步范围：待办事项、总结、重复规则、后悔币账本、每日结算数据
- 使用 Supabase KV 表作为存储后端
- 自动去重：防止云端重复条目累积

### 11. 深色/浅色主题
- 默认深色主题
- 点击按钮一键切换，偏好保存到 localStorage

## 目录结构

```
pwa-todo/
├── index.html                          # PWA 主入口页面
├── style.css                           # 全局样式（含深色/浅色主题变量）
├── sw.js                               # Service Worker 离线缓存
├── supabase_timer_timeline.sql         # Supabase 数据库建表 SQL
├── app/                                # PWA 网页版
│   ├── app.js                          # 主应用逻辑（约 3700 行）
│   ├── db.js                           # IndexedDB 封装（CRUD 操作）
│   ├── sync.js                         # Supabase 云端同步逻辑
│   ├── bgm.js                          # BGM 背景音乐播放管理
│   ├── storage-scope.js                # 存储作用域（多实例隔离）
│   ├── manifest.json                   # PWA 清单文件
│   └── icon.svg                        # PWA 图标
├── assets/
│   └── bgm/
│       └── pinknoise.m4a               # 内置白噪音音频
└── native/                             # Rust 原生桌面版
    ├── Cargo.toml                      # Rust 项目配置
    ├── src/
    │   ├── main.rs                     # 应用入口
    │   ├── db/                         # SQLite 数据层
    │   │   ├── mod.rs                  # 模块导出
    │   │   ├── database.rs             # SQLite CRUD + 迁移
    │   │   ├── models.rs               # 数据模型（Todo, Summary, RecurrenceRule 等）
    │   │   ├── recurrence.rs           # 重复规则引擎
    │   │   ├── summary.rs              # 每日总结辅助
    │   │   └── filesystem.rs           # 备份/导出/导入（JSON + CSV）
    │   ├── system/                     # 系统集成
    │   │   ├── mod.rs                  # 模块导出
    │   │   ├── timer.rs                # 专注计时器 + 辅助计时器
    │   │   ├── tray.rs                 # 系统托盘
    │   │   ├── notifications.rs        # 桌面通知
    │   │   └── hotkeys.rs              # 全局快捷键
    │   ├── audio/                      # 音频服务（闹钟/提示音）
    │   ├── platform/                   # 平台路径（数据目录）
    │   ├── sync/                       # 云端同步（规划中）
    │   ├── view/                       # UI 视图（开发中）
    │   └── widget/                     # 自定义组件（开发中）
    └── migrations/                     # 数据库迁移脚本（预留）
```

## 架构设计

### 数据层（db.js）

应用使用 IndexedDB 作为本地持久化存储，数据库名为 `todo-db`，版本 7，包含以下 Object Store：

| Store 名称 | 用途 | 索引 |
|-----------|------|------|
| `todos` | 待办事项 | date, recurrenceRuleId, uuid, updatedAt |
| `summaries` | 每日总结 | date, uuid, updatedAt |
| `meta` | 键值对元数据 | key (主键) |
| `recurrence_rules` | 重复规则 | uuid, updatedAt |

所有数据模型均使用 UUID 作为云端同步标识，`updatedAt` 时间戳用于增量同步比对。

### 同步层（sync.js）

同步流程：
1. 应用启动时初始化，从 IndexedDB 读取 `lastSyncAt`
2. 增量上传：将本地 `updatedAt > lastSyncAt` 的数据推送到 Supabase
3. 增量拉取：从 Supabase 拉取 `updated_at > lastSyncAt` 的远端数据
4. 冲突解决：以最新 `updatedAt` 为准，合并时避免重复 UUID
5. 同步自动去重：当云端 Key-Value 条目超过阈值时自动清理旧版本

### 离线层（sw.js）

Service Worker 缓存策略：
- **安装阶段**：预缓存所有核心资源（HTML、CSS、JS、字体、音频等）
- **导航请求**（页面加载）：Network First，成功后更新缓存，失败时回退缓存
- **静态资源**：Cache First（优先缓存），后台静默更新
- **范围请求**（Range，如音频 seek）：直接走网络，不缓存
- 新版本 SW 通过 `postMessage` 通知页面刷新

### 状态管理

应用状态分散管理，主要包括：
- `todos[]`：当前日期待办事项列表
- `inProgressTodos`（Map）：当前进行中的任务状态
- `timerTimelineByDate{}`：按日期组织的计时会话数据
- `regretCoinLedger[]`：后悔币交易账本
- 持久化通过 IndexedDB + localStorage 双重机制
- 跨 Tab 状态通过 localStorage + 租约（lease）协调

## 数据模型

### Todo（待办事项）
```
{
  id: number (自增主键),
  uuid: string (全局唯一标识),
  date: string (YYYY-MM-DD),
  text: string,
  category: string (Work/Life/Health/Social/Growth/Leisure/Plan),
  completed: boolean,
  dueMinutes: number (预计时长),
  recurrenceRuleId: number | null,
  createdAt: string (ISO 8601),
  updatedAt: string (ISO 8601),
  deletedAt: string | null (软删除标记)
}
```

### Summary（每日总结）
```
{
  id: number (自增主键),
  uuid: string,
  date: string (YYYY-MM-DD),
  text: string,
  rating: number (1-5),
  createdAt: string,
  updatedAt: string,
  deletedAt: string | null
}
```

### RecurrenceRule（重复规则）
```
{
  id: number (自增主键),
  uuid: string,
  text: string,
  category: string,
  type: string (daily/weekly/monthly/yearly/workday/custom),
  weekdays: number[] | null,
  day: number | null,
  month: number | null,
  interval: number | null,
  unit: string | null (day/week/month/year),
  createdAt: string,
  updatedAt: string,
  deletedAt: string | null
}
```

## 开发与调试

### 环境要求
- 现代浏览器（Chrome / Edge / Firefox），需要支持 Service Worker 和 IndexedDB
- 本地开发可使用任意静态文件服务器（如 VS Code Live Server）

### 启动步骤
1. 用 VS Code 打开项目根目录
2. 安装 Live Server 扩展
3. 右键 `index.html` → Open with Live Server
4. 打开浏览器 DevTools → Application 面板查看 IndexedDB 和 Service Worker 状态

### 部署 Supabase 后端（如需云同步）
1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中执行 `supabase_timer_timeline.sql` 创建 `timer_timeline` 表和策略
3. 修改 `app/sync.js` 中的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
4. 如需完整同步，还需在 Supabase 中创建对应的 K-V 存储表

### 调试
- 应用状态日志可通过控制台查看（sync 模块开启 DEBUG 模式）
- IndexedDB 数据在 DevTools → Application → IndexedDB → todo-db
- Service Worker 在 DevTools → Application → Service Workers
- 离线测试：DevTools → Network → 勾选 Offline

## 本地存储键值参考

应用使用 `localStorage` 存储以下运行时状态：

| 键名 | 用途 |
|------|------|
| `pwaTodo.timerState` | 倒计时当前状态 |
| `pwaTodo.timerTimelineByDate` | 本地计时会话数据 |
| `pwaTodo.timerTimelineActive` | 活跃计时会话 |
| `pwaTodo.timerLease` | 跨 Tab 租约 |
| `pwaTodo.todoInProgress` | 进行中任务列表 |
| `lastKnownNaturalDate` | 上次检测到的自然日期 |
| `theme` | 主题偏好（dark/light） |

## 待开发特性

- 通知提醒功能
- 更完善的用户认证
- 多设备实时同步（WebSocket）
- 数据统计与分析面板
- 任务标签和优先级