# 快速测试指南

## 第一步：安装依赖

```bash
# 进入服务器目录
cd server

# 安装 Node.js 依赖
npm install

# 安装 Playwright 浏览器（首次需要）
npx playwright install chromium
```

## 第二步：启动服务（需要两个终端）

### 终端 1 - 启动小红书服务

```bash
cd server
npm start
```

**看到这个输出就成功了：**
```
====================================
小红书发布服务已启动
监听端口: http://localhost:3001
====================================
```

### 终端 2 - 启动前端编辑器

```bash
cd editor
npx live-server --port=8080 --open=/index.html
```

浏览器会自动打开 `http://localhost:8080/index.html`

## 第三步：测试功能

### 测试 1：Markdown 模式（最简单）

1. 在编辑器中输入一些文字
2. 点击工具栏的 **"Markdown"** 按钮
3. 观察编辑器是否切换到源代码模式
4. 输入 Markdown 语法，例如：
   ```markdown
   # 这是标题
   
   **粗体** 和 *斜体*
   
   - 列表项 1
   - 列表项 2
   ```
5. 再次点击 **"HTML"** 按钮，查看是否正确转换

### 测试 2：小红书登录（首次必须）

1. 在右侧边栏找到 **"小红书"** 卡片
2. 开启小红书通道开关
3. 点击 **"刷新配置"** 按钮
4. 如果提示未登录，点击 **"去重新登录"**
5. 浏览器会自动打开小红书登录页面
6. 用小红书 APP 扫码登录
7. 等待浏览器自动关闭，登录完成

**验证登录成功：**
```bash
# 检查 Cookie 文件是否生成
cat data/xiaohongshu-cookies.json
```

### 测试 3：小红书发布

1. 填写标题：`测试发布`
2. 填写内容（可以是 Markdown 或 HTML）
3. 在小红书通道卡片中：
   - 选择账号：**主账号**
   - 输入标签：`测试, 分享`（可选）
4. 确保小红书通道开关已开启
5. 点击页面底部的 **"一键发布"** 按钮
6. 浏览器会自动打开并填充内容
7. **手动点击小红书页面上的"发布"按钮**完成发布

### 测试 4：知乎发布（验证原有功能）

1. 关闭小红书通道，开启知乎通道
2. 填写标题和内容
3. 点击 **"一键发布"**
4. 确认知乎页面正确打开并填充内容

## 快速验证命令

### 检查服务是否运行

```bash
# 健康检查
curl http://localhost:3001/health

# 获取账号列表
curl http://localhost:3001/api/accounts

# 检查登录状态
curl "http://localhost:3001/api/login/status?accountId=account_1"
```

### 查看日志

- **前端日志**：打开浏览器开发者工具（F12）→ Console
- **服务器日志**：查看运行 `npm start` 的终端窗口

## 常见问题快速解决

### ❌ 服务启动失败

```bash
# 检查端口是否被占用
lsof -i :3001

# 如果被占用，修改 server/xiaohongshu-server.js 中的 PORT 常量
```

### ❌ npm install 失败

```bash
# 清理后重新安装
cd server
rm -rf node_modules package-lock.json
npm install
```

### ❌ Playwright 安装失败

```bash
# 手动安装
npx playwright install chromium --with-deps
```

### ❌ 前端无法连接服务

1. 确认服务正在运行（终端 1）
2. 检查浏览器控制台错误信息
3. 确认 URL 是 `http://localhost:3001`（不是 https）

### ❌ 登录失败

1. 检查网络连接
2. 手动访问 `https://creator.xiaohongshu.com/login` 测试
3. 查看服务器终端日志

## 测试检查清单

- [ ] Node.js 已安装（v18+）
- [ ] 依赖已安装（`npm install`）
- [ ] Playwright 浏览器已安装
- [ ] 小红书服务已启动（端口 3001）
- [ ] 前端编辑器已启动（端口 8080）
- [ ] Markdown 模式切换正常
- [ ] 小红书登录成功
- [ ] Cookie 文件已生成
- [ ] 小红书发布功能正常
- [ ] 知乎发布功能正常（回归测试）

## 下一步

详细测试步骤请参考：[TESTING_GUIDE.md](./TESTING_GUIDE.md)

遇到问题？查看：
- 浏览器控制台（F12）
- 服务器终端日志
- [README.md](./README.md) 中的常见问题部分

