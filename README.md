# PWA Todo

一个支持离线使用的待办事项 PWA 应用，使用 IndexedDB 持久化数据，并具备可安装能力。

## 功能
- 新增待办事项（空输入会提示）
- 点击切换完成状态
- 删除待办事项
- IndexedDB 本地持久化
- Service Worker 缓存核心资源，离线可用

## 目录结构
```
pwa-todo/
├── index.html
├── style.css
├── sw.js
├── app/
│   ├── app.js
│   ├── db.js
│   ├── manifest.json
│   └── icon.svg
```

## 开发与调试
1. 用 VS Code 打开项目。
2. 安装并使用 Live Server 运行 `index.html`。
3. 在浏览器 DevTools 中查看 IndexedDB 和 Application/PWA。

## 说明
- 离线缓存策略为 Cache First。
- 未来可扩展云同步与通知功能。
