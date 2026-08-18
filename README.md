# MullenMuse（筹思）

> 一个让多个AI同时回答同一个问题的趣味聊天室。  
> 智谱、OpenRouter……谁的回答更懂你？比一比就知道！

![Vue](https://img.shields.io/badge/Vue-3.0-green.svg)
![Vite](https://img.shields.io/badge/Vite-6.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ 项目亮点

- ⚡ **多AI并行**：一次提问，3~4个AI同时回复，效率拉满，答案对比一目了然。
- 🎨 **极简交互**：勾选你想用的AI，输入问题，坐等各路AI“神仙打架”。
- 🔒 **密钥安全**：前端不暴露真实密钥，通过 `.env` 环境变量管理，放心开源。
- 🚀 **极速部署**：基于 Vite 构建，支持一键部署到 Vercel / Cloudflare Pages。

## 🛠️ 技术栈

- **前端框架**：Vue 3（Composition API + `<script setup>`）
- **构建工具**：Vite
- **API 聚合**：智谱AI / OpenRouter（可自由扩展）
- **部署平台**：Cloudflare Pages

## 🚀 本地运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/STACKOVATE/MullenMuse.git
   cd MullenMuse
   ```
2. **安装依赖**
   ```bash
   cd frontend
   npm install
   ```
3. **创建环境变量**
   - 在 `frontend/.env` 中添加你的 API 密钥：
     ```env
     VITE_ZHIPU_KEY=你的智谱API密钥
     VITE_OPENROUTER_KEY=你的OpenRouter API密钥
     ```
4. **启动开发服务器**
   ```bash
   npm run dev -- --host 0.0.0.0
   ```

## 📘 项目概述

**MullenMuse** 是一个网页软件，用于把多个人工智能同时应用于同一个问题，方便用户对比不同模型的回答。前端采用 **Vue** 构建，支持 **OpenRouter** 和 **智谱** AI 服务，并可部署到 **Cloudflare**。

## 🌟 核心功能

- 多AI并行对话：同一提问同时询问多个 AI
- AI 选择开关：勾选你想启用的 AI 服务
- 实时消息列表：逐条展示 AI 回复，带来源标签
- AI 内容免责声明：提醒用户生成内容需谨慎甄别

## 🧩 技术栈

- 前端：Vue 3 + Vite
- 托管平台：Cloudflare
- 代码托管：GitHub
- AI 提供商：OpenRouter、智谱

## 📁 项目结构

- `frontend/`：Vue 前端应用
- `backend/`：备用后端服务（如有）
- `frontend/src/`：核心界面代码
- `frontend/src/styles/`：样式文件

## 🔧 部署建议

1. 将 `frontend` 部署到 Cloudflare Pages 或任意静态站点托管服务
2. 确保你的环境变量通过 `frontend/.env` 或部署平台的 Secrets/Environment Variables 注入
3. 如果使用后端代理 API，请根据需要调整 `frontend/src/App.vue` 中的请求地址

## 📌 注意事项

- 生产环境不要把真实 API 密钥提交到仓库
- 不同 AI 服务返回结果格式可能不同，项目已做基础兼容
- 生成结果仅供参考，建议在关键场景下人工复核

## 🏆 致谢

- 感谢 **智谱AI**、**OpenRouter** 提供的优质API。

- 感谢 **Vue** 团队带来如此愉悦的开发体验。

- 感谢 **Cloudflare** 团队免费提供的无服务器托管服务。

## 🤝 赞助

[支持这个项目](https://ifidian.net/a/mullenmuse)

## 📝 许可证

MIT License © STACKOVATE
