# 本地开发联调指南

本文档说明如何在本地环境开发和调试 AIFA 发布助手项目。

## 📋 前置要求

1. **Chrome 浏览器**（推荐最新版本）
2. **Node.js**（可选，用于启动本地服务器）
3. **Supabase 账号**（用于登录状态管理）

---

## 🚀 快速开始

### 方式一：使用本地静态服务器（推荐）

#### 1. 启动本地服务器

在项目根目录执行以下任一命令：

```bash
# 方式1: 使用 Python（如果已安装）
cd editor
python3 -m http.server 8080

# 方式2: 使用 Node.js 的 http-server
npx http-server editor -p 8080 -c-1

# 方式3: 使用 live-server（支持热重载）
npx live-server editor --port=8080 --open=/
```

#### 2. 访问本地地址

打开浏览器访问：`http://localhost:8080/index.html`

---

### 方式二：直接打开文件（简单但不推荐）

直接双击 `editor/index.html` 文件，但这种方式可能遇到以下问题：
- ES6 模块导入可能失败（`import` 语句）
- 跨域问题
- 某些功能可能无法正常工作

---

## 🔧 Chrome 扩展配置

### 1. 加载扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目中的 `aifa-extension/` 目录

### 2. 验证扩展加载成功

- 扩展列表中应该显示 "Aifa Simple Publisher"
- 状态为 "已启用"
- 没有错误提示

### 3. 扩展更新

修改 `aifa-extension/` 目录下的代码后：
1. 在 `chrome://extensions/` 页面
2. 点击扩展卡片上的 **🔄 刷新图标**
3. 扩展会自动重新加载最新代码

---

## 🧪 本地联调步骤

### 完整联调流程

#### 步骤 1：启动本地服务器

```bash
# 在项目根目录
cd editor
npx live-server --port=8080 --open=/
```

#### 步骤 2：加载 Chrome 扩展

1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 加载 `aifa-extension/` 目录

#### 步骤 3：测试发布流程

1. 在浏览器中打开 `http://localhost:8080/index.html`
2. 在编辑器中输入标题和正文
3. 点击 **"一键发布"** 按钮
4. 浏览器会自动打开知乎写作页面
5. 扩展脚本会自动填充标题和正文

---

## 🔍 调试技巧

### 1. 调试发布面板（网页端）

#### 使用 Chrome DevTools

1. 在发布面板页面按 `F12` 打开开发者工具
2. 查看 **Console** 标签页，可以看到：
   - 编辑器初始化日志
   - Supabase 连接状态
   - 登录状态查询结果
   - 任务创建和发送日志

#### 查看网络请求

在 **Network** 标签页可以查看：
- Supabase API 调用
- 云函数调用（`channel-session-start`、`channel-session-status`）

### 2. 调试 Chrome 扩展

#### 查看扩展日志

1. 在知乎写作页面按 `F12` 打开开发者工具
2. 查看 **Console** 标签页
3. 扩展脚本的日志会显示在这里（注意：部分日志可能被禁用）

#### 调试 Content Script

1. 打开知乎写作页面：`https://zhuanlan.zhihu.com/write`
2. 按 `F12` 打开开发者工具
3. 在 **Sources** 标签页可以找到：
   - `content-zhihu.js` 文件
   - 可以设置断点调试

#### 查看扩展后台

- 扩展使用 Content Script，没有独立的后台页面
- 所有逻辑都在 `content-zhihu.js` 中

### 3. 调试消息通信

#### 查看 postMessage

在发布面板和知乎页面的 Console 中，可以监听消息：

```javascript
// 在发布面板 Console 中
window.addEventListener('message', (e) => {
  console.log('收到消息:', e.data, '来源:', e.origin);
});

// 在知乎页面 Console 中
window.addEventListener('message', (e) => {
  console.log('收到消息:', e.data, '来源:', e.origin);
});
```

---

## ⚙️ 配置说明

### Supabase 配置

在 `editor/index.html` 中配置 Supabase：

```html
<script id="aifaEditorConfig" type="application/json">
  {
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseAnonKey": "your-anon-key"
  }
</script>
```

### 扩展允许的域名

扩展已配置允许以下域名通信：

- `http://localhost` 及常用端口（3000, 8080）
- `http://127.0.0.1` 及常用端口
- 生产环境域名

如需添加其他本地域名，修改：
- `aifa-extension/manifest.json` 中的 `externally_connectable.matches`
- `aifa-extension/content-zhihu.js` 中的 `ALLOWED_ORIGINS`

---

## 🐛 常见问题

### 1. 扩展无法接收消息

**问题**：点击"一键发布"后，知乎页面没有反应

**解决方案**：
- 检查扩展是否已加载并启用
- 检查 `manifest.json` 中的 `externally_connectable` 是否包含你的本地地址
- 检查 `content-zhihu.js` 中的 `ALLOWED_ORIGINS` 是否包含你的本地地址
- 在知乎页面 Console 查看是否有错误信息

### 2. ES6 模块导入失败

**问题**：页面显示 "Failed to load module"

**解决方案**：
- 必须使用本地服务器，不能直接打开 HTML 文件
- 确保使用 `http://` 协议，不是 `file://` 协议

### 3. Supabase 连接失败

**问题**：登录状态查询失败

**解决方案**：
- 检查 `aifaEditorConfig` 中的 Supabase 配置是否正确
- 检查网络连接
- 检查 Supabase 项目是否正常运行

### 4. 扩展脚本未执行

**问题**：在知乎页面看不到扩展效果

**解决方案**：
- 确认扩展已启用
- 刷新知乎页面
- 检查扩展是否有错误（在 `chrome://extensions/` 查看）
- 确认访问的是 `https://zhuanlan.zhihu.com/write` 页面

### 5. 内容填充失败

**问题**：扩展执行了但内容没有填充

**解决方案**：
- 打开知乎页面 Console，查看扩展日志
- 检查知乎页面结构是否变化（选择器可能失效）
- 尝试手动刷新知乎页面后重试

---

## 📝 开发建议

### 1. 代码修改流程

1. **修改发布面板**：
   - 编辑 `editor/index.html` 或 `editor/session-service.js`
   - 刷新浏览器页面即可看到效果

2. **修改扩展脚本**：
   - 编辑 `aifa-extension/content-zhihu.js`
   - 在 `chrome://extensions/` 刷新扩展
   - 刷新知乎页面测试

3. **修改扩展配置**：
   - 编辑 `aifa-extension/manifest.json`
   - 在 `chrome://extensions/` 重新加载扩展

### 2. 热重载

使用 `live-server` 可以实现发布面板的热重载：

```bash
npx live-server editor --port=8080 --open=/
```

修改 HTML/JS 文件后，浏览器会自动刷新。

### 3. 版本控制

- 修改扩展后，记得更新 `editor/assets/aifa-extension.zip`
- 提交代码前，确保本地测试通过

---

## 🔐 安全注意事项

1. **不要提交敏感信息**：
   - Supabase 密钥虽然使用 anon key，但仍需注意
   - 不要将生产环境的密钥提交到代码库

2. **本地测试数据**：
   - 建议使用测试账号进行本地调试
   - 避免在生产数据上进行测试

---

## 📚 相关文档

- [Chrome 扩展开发文档](https://developer.chrome.com/docs/extensions/)
- [Supabase 文档](https://supabase.com/docs)
- [TinyMCE 文档](https://www.tiny.cloud/docs/)

---

## 💡 提示

- 使用 Chrome 的 **无痕模式** 可以避免缓存干扰
- 使用 **开发者工具** 的 **Network** 标签可以查看所有网络请求
- 使用 **Console** 可以查看详细的错误信息和日志

