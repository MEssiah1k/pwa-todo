# PWA Todo

一个支持离线使用的待办事项应用，提供 PWA 网页版和原生桌面版。

## 功能
- 新增待办事项（空输入会提示）
- 点击切换完成状态
- 删除待办事项
- IndexedDB 本地持久化（网页版）/ SQLite 持久化（桌面版）
- Service Worker 缓存核心资源，离线可用
- 专注倒计时、BGM 白噪音、每日总结评分
- 重复任务规则、贡献热力图、后悔币系统
- Supabase 云端同步

## 目录结构
```
pwa-todo/
├── index.html              # PWA 主入口
├── style.css               # 全局样式
├── sw.js                   # Service Worker
├── app/                    # PWA 网页版
│   ├── app.js              # 主应用逻辑
│   ├── db.js               # IndexedDB 封装
│   ├── sync.js             # Supabase 云端同步
│   ├── bgm.js              # BGM 播放管理
│   ├── storage-scope.js    # 存储作用域
│   ├── manifest.json       # PWA 清单
│   └── icon.svg            # PWA 图标
├── assets/
│   └── bgm/
│       └── pinknoise.m4a   # 内置白噪音
├── native/                 # Rust 原生桌面版
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── db/             # SQLite 数据层
│   │   ├── system/         # 托盘、通知、快捷键、计时器
│   │   ├── audio/          # 音频播放
│   │   ├── platform/       # 平台路径
│   │   ├── sync/           # 云端同步（规划中）
│   │   ├── view/           # UI 视图
│   │   └── widget/         # 自定义组件
│   └── migrations/
└── supabase_timer_timeline.sql
```

## 开发与调试

### 网页版
1. 用 VS Code 打开项目。
2. 安装并使用 Live Server 运行 `index.html`。
3. 在浏览器 DevTools 中查看 IndexedDB 和 Application/PWA。

### 原生桌面版
1. 安装 Rust：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. 安装系统依赖（Linux）：`sudo apt install libasound2-dev libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev`
3. `cd native && cargo run`

## 说明
- 离线缓存策略为 Cache First。
- 两个版本共享相同的数据模型定义。
