# AIFA Publisher（静态版）

一键发布工具，支持发布到**知乎**和**小红书**等平台。

## 功能特性

### 1. Markdown 编辑支持
- ✅ 内置 TinyMCE 富文本编辑器
- ✅ 支持 Markdown/HTML 模式切换
- ✅ Markdown 与 HTML 双向转换
- ✅ 实时预览和编辑

### 2. 多平台发布
- ✅ **知乎**：通过 Chrome 扩展自动填充内容（HTML格式）
- ✅ **小红书**：通过本地 Node.js 服务 + Playwright 自动化发布（纯文本格式）

### 3. 登录管理
- ✅ 知乎：扫码登录（通过 Supabase）
- ✅ 小红书：扫码登录（Cookie 存储在本地 JSON）

## 项目架构

```
aifa-publisher/
├── editor/                    # 前端编辑器
│   ├── index.html            # 主页面（含 Markdown 支持）
│   ├── session-service.js    # 服务函数（知乎 + 小红书）
│   └── assets/               # 静态资源
├── aifa-extension/           # Chrome 扩展（知乎）
│   ├── manifest.json
│   └── content-zhihu.js
├── server/                   # 本地 Node.js 服务（小红书）
│   ├── xiaohongshu-server.js      # Express 服务器
│   ├── playwright/
│   │   └── xiaohongshu-publish.js # Playwright 自动化
│   └── package.json
├── data/                     # 本地数据存储
│   ├── xiaohongshu-cookies.json   # Cookie 存储
│   └── xiaohongshu-accounts.json  # 账号配置
├── README.md
└── LOCAL_DEV.md             # 本地开发指南
```

## 快速开始

### 一、环境准备

1. **安装 Node.js**（18+ 版本）
2. **安装 Chrome 浏览器**
3. **安装依赖**

```bash
# 安装小红书服务依赖
cd server
npm install
```

### 二、启动服务

#### 1. 启动小红书本地服务

```bash
cd server
npm start
```

服务将在 `http://localhost:3001` 运行。

#### 2. 启动前端编辑器

```bash
cd editor
npx live-server --port=8080 --open=/index.html
```

#### 3. 加载 Chrome 扩展（知乎发布需要）

- 打开 Chrome：`chrome://extensions/`
- 开启"开发者模式"
- 点击"加载已解压的扩展程序"
- 选择 `aifa-extension/` 目录

### 三、使用流程

#### 发布到知乎

1. 访问 `http://localhost:8080/index.html`
2. 填写标题和内容（支持 HTML 或 Markdown）
3. 选中"知乎"通道
4. 点击"一键发布"
5. 扩展会自动在知乎页面填充内容

#### 发布到小红书

1. **首次使用：登录小红书**
   - 选中"小红书"通道
   - 点击"刷新配置"
   - 点击"去重新登录"
   - 扫码登录（Cookie 会自动保存到 `data/xiaohongshu-cookies.json`）

2. **发布内容**
   - 填写标题和内容（支持 HTML 或 Markdown）
   - 添加标签（可选，用逗号分隔）
   - 选中"小红书"通道
   - 点击"一键发布"
   - Playwright 会自动打开浏览器并填充内容

## 技术栈

### 前端
- **HTML/CSS/JavaScript**
- **TinyMCE** - 富文本编辑器
- **marked.js** - Markdown 解析器

### 后端（小红书）
- **Node.js + Express** - HTTP 服务器
- **Playwright** - 浏览器自动化
- **本地 JSON** - Cookie 和配置存储

### 知乎
- **Chrome Extension** - 内容自动填充
- **Supabase** - 登录状态管理

## API 文档

### 小红书服务 API

#### 获取账号列表
```http
GET /api/accounts
Response: { "success": true, "accounts": [...] }
```

#### 查询登录状态
```http
GET /api/login/status?accountId=account_1
Response: { "success": true, "status": "active", "accountId": "..." }
```

#### 启动扫码登录
```http
POST /api/login/start
Body: { "accountId": "account_1" }
Response: { "success": true, "sessionToken": "...", "message": "..." }
```

#### 发布内容
```http
POST /api/publish
Body: {
  "type": "AIFA_TASK",
  "platform": "xiaohongshu",
  "taskId": "...",
  "payload": {
    "title": "标题",
    "content": "纯文本内容",
    "tags": ["标签1", "标签2"],
    "accountId": "account_1"
  }
}
Response: { "success": true, "message": "...", "url": "..." }
```

## 配置文件

### data/xiaohongshu-accounts.json
```json
[
  {
    "account_id": "account_1",
    "account_name": "主账号"
  }
]
```

### data/xiaohongshu-cookies.json
```json
{
  "account_1": {
    "cookies": [...],
    "updated_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-01-08T00:00:00Z"
  }
}
```

## 注意事项

1. **小红书服务必须在本地运行**：Playwright 需要本地环境
2. **Cookie 安全**：Cookie 存储在本地，不上传到云端
3. **登录有效期**：Cookie 默认 7 天有效期，过期需重新登录
4. **自动化风险**：频繁使用自动化可能触发平台风控，请适度使用
5. **内容格式**：
   - 知乎：支持 HTML 富文本
   - 小红书：仅支持纯文本（自动转换）

## 常见问题

### 1. 小红书服务启动失败？
- 检查 Node.js 版本（需要 18+）
- 运行 `npm install` 安装依赖
- 检查端口 3001 是否被占用

### 2. 登录失败？
- 确保小红书服务正在运行
- 检查浏览器是否能正常打开小红书网站
- 尝试手动登录小红书网页版

### 3. 发布失败？
- 检查登录状态是否有效
- 查看服务器控制台日志
- 确认内容格式是否正确

## 开发指南

详细的本地开发和调试指南请参考：[LOCAL_DEV.md](./LOCAL_DEV.md)

## 更新日志

### v2.0.0 (2024-01-XX)
- ✅ 新增 Markdown 编辑模式
- ✅ 新增小红书发布支持
- ✅ 新增本地 Node.js 服务
- ✅ 新增 Playwright 自动化
- ✅ 优化发布流程

### v1.0.0 (2023-XX-XX)
- ✅ 初始版本
- ✅ 知乎发布支持
- ✅ Chrome 扩展集成

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**注意**：本工具仅供学习和个人使用，请遵守各平台的服务条款和使用规范。
