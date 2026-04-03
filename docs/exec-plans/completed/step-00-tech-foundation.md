# 步骤 00：技术底座与仓库骨架

状态：Done  
目标版本：V0 / MVP

## 目标

在写任何业务代码前，先锁定不会频繁返工的基础决策：

- Windows 桌面壳技术栈
- provider 适配层策略
- 本地历史归档存储方案
- 仓库目录结构与配置方式

## 已拍板的技术决策

### 1. 桌面壳：Tauri 2

- 后台常驻场景内存占用远小于 Electron
- 打包体积小（~10MB vs Electron ~80MB）
- 系统托盘、全局快捷键、透明覆盖窗均通过插件支持
- 前端使用 React + TypeScript + Vite，Tauri 对 TS 生态完全兼容
- Rust 后续可用于截图、本地操作等高性能模块

### 2. Provider 适配层：统一 OpenAI-compatible 接口

- Qwen/DashScope 官方提供 OpenAI-compatible 端点（chat/completions）
- 上层业务通过 `UnifiedLLMClient` 调用，不感知具体 provider
- 每个 provider 封装为 `ProviderAdapter` 实现，支持 chat 和 chatStream
- 新增 provider 只需实现 `ProviderAdapter` 接口并注册

### 3. 本地归档：文件制 + 轻量索引

- 每条会话一个目录：`meta.json` + `messages.json` + `attachments/`
- 根目录维护 `conversations-index.json` 加速历史列表加载
- 删除操作直接 `rm -rf` 目录，天然级联删除
- 通过 Tauri Rust 后端执行文件系统操作

## 目录结构

```
Desktop-Teacher/
├── src/                        # 前端源码 (React + TS)
│   ├── services/
│   │   ├── llm/                # Provider 适配层
│   │   │   ├── types.ts        # 统一类型定义
│   │   │   ├── adapter.ts      # ProviderAdapter 接口
│   │   │   ├── openai.ts       # OpenAI 适配器
│   │   │   ├── qwen.ts         # Qwen/DashScope 适配器
│   │   │   ├── client.ts       # UnifiedLLMClient 统一入口
│   │   │   └── index.ts        # 公共导出
│   │   └── storage/            # 本地会话存储
│   │       ├── types.ts        # 存储类型定义
│   │       ├── conversation.ts # 会话 CRUD（通过 Tauri invoke）
│   │       └── index.ts        # 公共导出
│   ├── components/             # React 组件
│   ├── hooks/                  # React hooks
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                  # Tauri Rust 后端
│   ├── src/
│   │   ├── lib.rs              # 存储命令 + 应用入口
│   │   └── main.rs             # Windows 入口
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/                       # 项目文档
│   ├── prd-v0.md
│   ├── srs-v0.md
│   └── exec-plans/
├── .env.example                # 环境变量模板
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 配置约定

- 环境变量通过 `.env` 文件管理，以 `VITE_` 前缀暴露给前端
- Provider 配置包括 API Key、Base URL、默认模型
- Tauri Rust 后端通过 `app_data_dir()` 定位存储根目录

## 完成标准

- ✓ 三个关键技术问题都有明确结论
- ✓ 仓库骨架已搭建，目录结构已创建
- ✓ Provider 适配层骨架已实现（TypeScript 编译通过）
- ✓ 本地存储模块骨架已实现（前端 TS + Rust 命令）
- ✓ 配置文件约定已定义（.env.example）
- ✓ 后续步骤可以基于该结构继续实现
