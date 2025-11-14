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

### 4. 发布历史管理
- ✅ 自动记录所有发布历史（成功和失败）
- ✅ 支持查看发布历史记录（平台、标题、时间、状态等）
- ✅ 支持删除单条历史记录
- ✅ 支持清空所有历史记录
- ✅ 历史记录存储在浏览器本地（localStorage）
- ✅ 最多保存100条历史记录

## 项目架构

```
aifa-publisher/
├── editor/                    # 前端编辑器
│   ├── index.html            # 主页面（含 Markdown 支持）
│   ├── history.html          # 发布历史查看页面
│   ├── session-service.js    # 服务函数（知乎 + 小红书 + 发布历史）
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
npx live-server --port=8080 --open=/
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
   - Playwright 会自动执行以下完整流程：
     1. 打开小红书创作服务平台
     2. 点击"发布笔记"按钮
     3. 点击"写长文"标签
     4. 点击"新的创作"按钮
     5. 自动填写标题和内容
     6. **点击"一键排版"按钮**（自动排版内容）
     7. **点击"下一步"按钮**（进入发布确认页面）
     8. **点击"发布"按钮**（完成发布）
   - 整个发布流程已完全自动化，无需手动操作

#### 查看发布历史

1. **访问发布历史页面**
   - 在编辑页面顶部点击"📋 发布历史"按钮
   - 或直接访问 `http://localhost:8080/history.html`

2. **查看历史记录**
   - 查看所有发布记录（包括成功和失败）
   - 每条记录显示：平台、标题、内容预览、发布时间、账号、状态、发布链接等
   - 支持点击链接跳转到发布后的页面

3. **管理历史记录**
   - 点击单条记录的删除按钮可删除该记录
   - 点击"清空历史"按钮可清空所有记录
   - 历史记录最多保存100条，超出会自动删除最旧的记录

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
- **选择器超时错误**：如果出现 `page.waitForSelector: Timeout exceeded` 错误
  - 检查登录状态是否有效（Cookie可能已过期，需要重新登录）
  - 查看服务器控制台日志，会显示尝试的选择器和当前页面URL
  - 检查 `data/debug-screenshot-*.png` 文件，查看错误时的页面截图
  - 小红书页面结构可能已更新，需要更新选择器
- **其他发布失败**
  - 检查登录状态是否有效
  - 查看服务器控制台日志
  - 确认内容格式是否正确
  - 确保小红书服务正在运行（http://localhost:3001）

## 开发指南

详细的本地开发和调试指南请参考：[LOCAL_DEV.md](./LOCAL_DEV.md)

## 更新日志

### v2.4.0 (2024-01-XX)
- ✅ 新增发布历史管理功能
- ✅ 自动记录所有发布历史（成功和失败）
- ✅ 新增发布历史查看页面（history.html）
- ✅ 支持删除单条历史记录
- ✅ 支持清空所有历史记录
- ✅ 历史记录存储在浏览器本地（localStorage）
- ✅ 在编辑页面顶部添加"发布历史"入口按钮
- ✅ 发布成功后自动保存历史记录

### v2.3.0 (2024-01-XX)
- ✅ 新增完整的自动化发布流程
- ✅ 自动执行"一键排版" → "下一步" → "发布"三个步骤
- ✅ 自动处理发布确认弹窗
- ✅ 添加发布成功状态检测
- ✅ 优化页面跳转和等待逻辑
- ✅ 改进错误处理和调试信息

### v2.2.0 (2024-01-XX)
- ✅ 重构发布流程，按照正确的页面导航步骤操作
- ✅ 实现完整的发布流程：点击"发布笔记" → "写长文" → "新的创作" → 填写内容
- ✅ 优化选择器匹配，支持"输入标题"和"粘贴到这里或输入文字"等placeholder
- ✅ 改进内容输入方式，支持contenteditable和textarea元素

### v2.1.0 (2024-01-XX)
- ✅ 修复发布时选择器超时问题
- ✅ 改进选择器匹配逻辑，支持多个备选选择器
- ✅ 增加页面加载等待时间，确保动态内容加载完成
- ✅ 添加页面URL检查，防止Cookie过期导致的页面跳转
- ✅ 添加自动关闭弹窗功能
- ✅ 改进错误处理，保存调试截图和详细日志
- ✅ 优化错误信息显示，提供更友好的错误提示

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
