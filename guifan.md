# 项目规范（2025-10-23）

## 技术架构
- 桌面端 Electron 应用配合浏览器扩展实现知乎文章的自动发布。
- 编辑页（CloudBase 静态托管）与浏览器扩展之间通过 `window.postMessage` 建立通信，所有任务以唯一 `taskId` 作为可信锚点。
- 浏览器扩展内容脚本运行在知乎写作页/文章页内，负责填充 TinyMCE 内容、执行自动发布，并在跳转后利用 `sessionStorage` 补发结果消息。

## 通信与安全
- 扩展 `manifest.json` 的 `externally_connectable.matches` 必须包含以下来源：
  - `https://cloud1-2galtebofd65ac99-1360656182.tcloudbaseapp.com/*`
  - `https://aifa.aixiaohu.top/*`
- 内容脚本内 `ALLOWED_ORIGINS` 与上述站点保持一致，确保只接受可信编辑页的任务。
- 编辑页在接收 `AIFA_TASK_RESULT` 时必须校验 `taskId`；所有超时、失败、成功路径统一调用 `cleanup` 清理定时器与监听器。

## 部署流程
- 编辑页代码更新后使用 CloudBase `uploadFiles` 同步至 `simple-publisher/editor` 目录。
- 浏览器扩展改动需在 `chrome://extensions` 页面执行“更新”或重新加载解压目录，确保最新 `manifest.json` 与 `content-zhihu.js` 生效。
- 发布前建议在 Chrome 隐身模式下访问 `https://aifa.aixiaohu.top/simple-publisher/editor/` 进行回归验证。

## 静态资源与指引页面（2025-10-23）
- Chrome 插件指引页所用截图统一放置在 `editor/assets/images/chrome-guide/`，命名格式为 `step-XX.png`（两位序号）。
- 图文内容以 Word 导出 HTML 为来源时，需确认排序与指引步骤一致，避免遗漏或重复。
- 指引页引用图片时使用相对路径 `./assets/images/chrome-guide/step-XX.png`，并为每张图片提供准确的 `alt` 与说明文字。
- 每次更新指引文案或新增图片后，务必重新上传 `editor/` 目录至 CloudBase `simple-publisher/editor`，保持线上版本最新。
