# Desktop Teacher

一个面向 Windows 学习者的桌面 AI 老师助手。

## 抋术栈

| 层面 | 选型 |
|------|------|
| 桌面壳 | Tauri 2 (Rust + WebView) |
| 前端 | React 19 + TypeScript + Vite |
| LLM 接入 | 统一 OpenAI-compatible 适配层 |
| Provider | OpenAI / Qwen (DashScope) |
| 本地存储 | 文件制 + 轻量索引 |

## 项目结构

```
src/
  services/
    llm/          # Provider 适配层 (types, adapter, openai, qwen, client, init, prompt)
    storage/      # 本地会话存储 (types, conversation)
  components/     # React 组件
  hooks/          # React hooks
src-tauri/         # Tauri Rust 后端
  src/
    lib.rs         # 存储命令 + 应用入口
    main.rs        # Windows 入口
  Cargo.toml
  tauri.conf.json
docs/              # 产品文档
  prd-v0.md
  srs-v0.md
  exec-plans/
.env.example       # 环境变量模板
```

## 文档入口

- 产品需求：[docs/prd-v0.md](docs/prd-v0.md)
- 系统规格：[docs/srs-v0.md](docs/srs-v0.md)
- 执行计划索引：[docs/exec-plans/index.md](docs/exec-plans/index.md)

## V0 关键约束

- 平台：仅 Windows
- 用户：学习者 / 自学者
- 入口：右下角角色图标 + 全局快捷键截图
- 回答：默认老师式讲解
- 历史：本地归档，可续聊，不做跨会话长期记忆
- 输入：V0 不包含语音
- provider：暂定兼容 OpenAI 与 Qwen

## 执行进度

| 步骤 | 状态 |
|------|------|
| step-00 技术底座与仓库骨架 | Done |
| step-01 桌面壳与角色图标 | Done |
| step-02 截图与提交 | Done |
| step-03 本地会话与归档 | Done |
| step-04 模型适配与回答 | Done |

## 开发

### 1. 安装依赖

```bash
npm install
```

需要安装 [Rust](https://rustup.rs/) 工具链。

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入至少一个 LLM provider 的 API Key：

```env
# 选择默认 provider（openai 或 qwen）
VITE_LLM_DEFAULT_PROVIDER=openai

# OpenAI
VITE_OPENAI_API_KEY=sk-your-openai-key

# Qwen / DashScope（可选，两个配一个即可）
VITE_QWEN_API_KEY=sk-your-dashscope-key
```

详细配置项见 `.env.example` 和 `docs/architecture.md` §5.3。

### 3. 启动开发服务器

```bash
npm run tauri dev
```

## 注意

代码和文档应以仓库中的文件为准，不保证从聊天上下文中获取的信息是最新或准确的。
