# 测试指南

本文档提供详细的测试步骤，帮助验证 Markdown 模式和小红书发布功能。

## 准备工作

### 1. 安装依赖

```bash
# 进入服务器目录
cd server

# 安装 Node.js 依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium
```

### 2. 启动服务

**终端 1 - 启动小红书服务**：
```bash
cd server
npm start
```

看到以下输出表示服务启动成功：
```
====================================
小红书发布服务已启动
监听端口: http://localhost:3001
====================================
```

**终端 2 - 启动前端编辑器**：
```bash
cd editor
npx live-server --port=8080 --open=/
```

浏览器会自动打开 `http://localhost:8080/index.html`

## 测试一：Markdown 模式切换和转换

### 测试步骤

1. **打开编辑器**
   - 访问 `http://localhost:8080/index.html`
   - 确认页面正常加载

2. **测试 Markdown 模式切换**
   - 在编辑器中输入一些 HTML 格式的内容（例如：粗体、标题、列表）
   - 点击工具栏的 **"Markdown"** 按钮
   - 观察编辑器是否切换到源代码模式
   - 按钮文字是否变为 **"HTML"**

3. **测试 Markdown 输入**
   - 在 Markdown 模式下，输入以下内容：
   ```markdown
   # 这是标题
   
   这是**粗体**文本和*斜体*文本。
   
   ## 二级标题
   
   - 列表项 1
   - 列表项 2
   - 列表项 3
   
   [这是链接](https://example.com)
   ```

4. **测试 Markdown 转 HTML**
   - 再次点击 **"HTML"** 按钮
   - 观察内容是否正确转换为 HTML 格式
   - 标题、粗体、列表等是否正确显示

5. **测试 HTML 转 Markdown**
   - 在 HTML 模式下，使用工具栏创建一些格式（粗体、列表等）
   - 切换到 Markdown 模式
   - 检查是否能看到纯文本内容

### 预期结果

✅ Markdown 模式切换流畅，无报错  
✅ Markdown 语法正确转换为 HTML  
✅ HTML 可以转换为纯文本  
✅ 按钮状态正确更新

### 常见问题

**Q: 切换模式时内容丢失？**  
A: 检查浏览器控制台是否有错误，确认 marked.js 已正确加载

**Q: Markdown 语法未生效？**  
A: 确认切换到 HTML 模式后再查看效果

## 测试二：小红书发布流程

### 测试步骤

#### 第一步：检查服务状态

1. **验证服务是否运行**
   ```bash
   curl http://localhost:3001/health
   ```
   
   预期输出：
   ```json
   {
     "status": "ok",
     "service": "xiaohongshu-publisher",
     "timestamp": "2024-01-XX..."
   }
   ```

2. **检查账号列表**
   ```bash
   curl http://localhost:3001/api/accounts
   ```
   
   预期输出：
   ```json
   {
     "success": true,
     "accounts": [
       {
         "account_id": "account_1",
         "account_name": "主账号"
       }
     ]
   }
   ```

#### 第二步：小红书登录

1. **在编辑器中找到小红书通道**
   - 在右侧边栏找到 **"小红书"** 卡片
   - 开启小红书通道开关

2. **点击刷新配置**
   - 点击 **"刷新配置"** 按钮
   - 系统会检查登录状态

3. **启动登录流程**
   - 如果提示未登录，点击 **"去重新登录"** 按钮
   - Playwright 会自动打开 Chrome 浏览器
   - 浏览器会导航到小红书登录页面

4. **扫码登录**
   - 使用小红书 APP 扫描页面上的二维码
   - 在 APP 上确认登录
   - 等待浏览器自动跳转到创作中心

5. **验证登录成功**
   - 终端应该显示：`登录成功，Cookie已保存`
   - 浏览器会自动关闭
   - 检查 `data/xiaohongshu-cookies.json` 文件是否已生成

#### 第三步：发布内容测试

1. **准备内容**
   - 在标题框输入：`测试小红书发布功能`
   - 在编辑器输入以下内容：
   ```
   这是一段测试文本。

   包含多个段落和换行。

   这是第二段内容。
   ```

2. **配置发布选项**
   - 在小红书通道卡片中，选择账号：**主账号**
   - 在标签框输入：`测试, 分享`

3. **执行发布**
   - 确保小红书通道开关已开启
   - 点击页面底部的 **"一键发布"** 按钮
   - 观察浏览器控制台和服务器终端的输出

4. **观察自动化过程**
   - Playwright 会自动打开浏览器
   - 浏览器会导航到小红书发布页面
   - 自动填充标题和内容
   - 尝试添加标签（如果支持）

5. **手动确认发布**
   - 检查填充的内容是否正确
   - **手动点击**小红书页面上的 **"发布"** 按钮
   - 等待发布完成

### 预期结果

✅ 服务健康检查通过  
✅ 登录流程顺利完成  
✅ Cookie 文件已创建  
✅ 发布页面正确打开  
✅ 标题和内容正确填充  
✅ 标签正确添加  
✅ 内容成功发布到小红书

### 常见问题

#### 服务相关

**Q: 服务启动失败，提示端口占用？**  
A: 修改 `server/xiaohongshu-server.js` 中的 `PORT` 常量，或者关闭占用 3001 端口的程序

**Q: npm install 失败？**  
A: 检查 Node.js 版本（需要 18+），或尝试使用 `npm install --legacy-peer-deps`

**Q: Playwright 安装失败？**  
A: 运行 `npx playwright install chromium --with-deps`

#### 登录相关

**Q: 浏览器未自动打开？**  
A: 检查服务器终端日志，确认是否有错误信息

**Q: 二维码不显示？**  
A: 手动访问 `https://creator.xiaohongshu.com/login` 检查网络连接

**Q: 扫码后未自动保存 Cookie？**  
A: 检查 `data/` 目录是否有写入权限

**Q: Cookie 已过期？**  
A: Cookie 默认 7 天有效期，重新执行登录流程即可

#### 发布相关

**Q: 点击发布后浏览器未打开？**  
A: 检查小红书服务是否正常运行，查看终端日志

**Q: 内容未正确填充？**  
A: 小红书页面可能有更新，选择器需要调整。查看终端错误信息

**Q: 前端提示 CORS 错误？**  
A: 确认服务器已启用 CORS（代码中已配置）

**Q: 提示 "未找到登录Cookie"？**  
A: 先完成登录流程，确保 Cookie 文件存在

## 测试三：Markdown 转纯文本（小红书）

### 测试步骤

1. **切换到 Markdown 模式**
   - 点击工具栏的 **"Markdown"** 按钮

2. **输入 Markdown 内容**
   ```markdown
   # 测试标题
   
   这是**粗体**和*斜体*文本。
   
   - 列表项 1
   - 列表项 2
   
   [链接文本](https://example.com)
   ```

3. **发布到小红书**
   - 选择小红书通道
   - 点击 **"一键发布"**

4. **验证纯文本转换**
   - 观察自动打开的小红书发布页面
   - 检查内容是否为纯文本（无 HTML 标签）
   - 确认格式符号（如 `**`、`#`）已被移除

### 预期结果

✅ Markdown 内容正确转换为纯文本  
✅ 无 HTML 标签残留  
✅ 标题、列表等格式已清理  
✅ 内容可读性良好

## 测试四：知乎发布（回归测试）

确保添加小红书功能后，知乎发布仍然正常工作。

### 测试步骤

1. **加载 Chrome 扩展**（如果未加载）
   - 访问 `chrome://extensions/`
   - 开启开发者模式
   - 加载 `aifa-extension/` 目录

2. **准备内容**
   - 填写标题和内容（可以使用 HTML 或 Markdown）

3. **选择知乎通道**
   - 确保知乎通道开关已开启
   - 小红书通道开关已关闭

4. **发布**
   - 点击 **"一键发布"**
   - 观察知乎页面是否正确打开
   - 内容是否正确填充

### 预期结果

✅ 知乎发布功能正常  
✅ 不影响原有功能

## 日志查看

### 前端日志
打开浏览器开发者工具（F12），查看 Console 标签页

### 服务器日志
查看运行 `npm start` 的终端窗口

### Cookie 文件
```bash
cat data/xiaohongshu-cookies.json
```

## 清理测试数据

```bash
# 清空 Cookie
echo "{}" > data/xiaohongshu-cookies.json

# 或删除整个 data 目录
rm -rf data
mkdir data
echo "{}" > data/xiaohongshu-cookies.json
echo '[{"account_id":"account_1","account_name":"主账号"}]' > data/xiaohongshu-accounts.json
```

## 故障排查

### 1. 查看完整错误信息
- 浏览器控制台（F12 → Console）
- 服务器终端输出
- 网络请求（F12 → Network）

### 2. 验证服务连接
```bash
# 测试服务器健康状态
curl http://localhost:3001/health

# 测试账号接口
curl http://localhost:3001/api/accounts

# 测试登录状态
curl "http://localhost:3001/api/login/status?accountId=account_1"
```

### 3. 重启服务
```bash
# 停止服务（Ctrl+C）
# 重新启动
cd server
npm start
```

### 4. 重新安装依赖
```bash
cd server
rm -rf node_modules package-lock.json
npm install
npx playwright install chromium
```

## 成功标准

✅ 所有测试步骤无报错  
✅ Markdown 模式切换正常  
✅ Markdown 正确转换为 HTML 和纯文本  
✅ 小红书登录成功，Cookie 已保存  
✅ 小红书发布页面正确打开  
✅ 内容正确填充到小红书发布页面  
✅ 知乎发布功能不受影响

---

如有问题，请检查：
1. Node.js 版本（需要 18+）
2. 端口占用情况（3001、8080）
3. 网络连接状态
4. 小红书网站可访问性
5. 文件权限（data 目录）

