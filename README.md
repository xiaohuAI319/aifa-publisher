# AIFA 发布助手（静态版本）

该仓库提供知乎一键发布工具的轻量实现，采用 “静态页面 + Chrome 扩展” 架构。核心目标：

- 在 `editor/` 下维护可直接部署的静态发布面板，并提供扩展使用指引。
- 在 `aifa-extension/` 下维护浏览器扩展源码，并同步发布用的 ZIP 压缩包。
- 通过 CloudBase 静态托管（路径：`simple-publisher/editor`）对外提供访问。

---

## 仓库结构

```text
.
├─ editor/                        # 发布面板静态资源
│  ├─ index.html                 # 主界面（TinyMCE 编辑器 + 一键发布入口）
│  ├─ chrome-extension-guide.html# Chrome 插件安装/使用指南
│  └─ assets/
│     ├─ aifa-extension.zip      # 供指引页下载的扩展安装包
│     └─ images/
│        └─ chrome-guide/        # 指引页用截图（step-01.png ~ step-08.png 等）
├─ aifa-extension/                # Chrome 扩展源码
│  ├─ manifest.json
│  └─ content-zhihu.js           # 在知乎写作页执行的内容脚本
├─ parse_word_html.py             # 将 Word 导出的 HTML 转为步骤 JSON 的辅助脚本，可删除
├─ inspect_word_sections.py       # 检查步骤文本/图片顺序的调试脚本，可删除
├─ jindu.md                       # 项目进度记录（追加式）
├─ guifan.md                      # 团队规范记录（最新条目制）
└─ README.md                      # 当前说明文档
```

---

## 核心模块说明

### 1. 发布面板 `editor/`
- 本地直接打开 `index.html` 即可预览 TinyMCE 编辑器与发布按钮。
- 页面右上角的 “重要：Chrome 插件下载” 链接指向 `chrome-extension-guide.html`。
- 右侧新增“发布通道”侧栏，可展示 Supabase 中配置的可用渠道（当前默认启用知乎，其它平台为占位），同处提供“自动发布”开关与配置表单。
- 自动发布关闭时，仅创建草稿；开启后会按各通道表单配置执行发布，表单字段与默认值将从 Supabase 拉取并支持手动刷新。
- 线上部署地址：`https://cloud1-2galtebofd65ac99-1360656182.tcloudbaseapp.com/simple-publisher/editor`
    以及 `https://aifa.aixiaohu.top/simple-publisher/editor`
- 每次更新静态资源后，需要将 `editor/` 目录整体上传至 CloudBase 对应路径。

### 2. Chrome 插件 `aifa-extension/`
- 包含 `manifest.json` 与 `content-zhihu.js`，支持在知乎写作页自动填充标题与正文。
- 发布使用的压缩包位于 `editor/assets/aifa-extension.zip`，指引页会直接提供该文件下载。
- 本地调试时，可在 Chrome 的 `chrome://extensions/` 页面开启开发者模式后，加载 `aifa-extension/` 目录。

### 3. 图片与指引资源
- 指引页使用的所有截图统一存放于 `editor/assets/images/chrome-guide/`。
- 命名规范：`step-XX.png`（两位数字序号），便于按步骤引用。
- `chrome-extension-guide.html` 中的 `<figure>` 块直接引用上述图片，并配有中文说明文字。

### 4. 辅助脚本
- `parse_word_html.py`：从 Word 导出的 HTML（`source.html`）解析出步骤文本/图片，生成 `sections.json` 供校对使用。
- `inspect_word_sections.py`：快速查看解析结果，确保段落与图片顺序正确。
- 如果后续有新的 Word 指引，可将导出的 HTML 与资源文件放入 `editor/assets/images/chrome-guide/` 后再次运行脚本。

---

## 快速上手

1. **本地打开发布面板**：
   - 直接双击 `editor/index.html` 或通过本地静态服务器访问。
2. **加载 Chrome 扩展**：
   - 在 `chrome://extensions/` 打开开发者模式，加载解压目录 `aifa-extension/`。
   - 或者按指引页提供的 ZIP 包 (`editor/assets/aifa-extension.zip`) 解压后加载。
3. **验证交互**：
   - 在发布面板填写标题与正文，点击 “一键发布到知乎”。
   - 浏览器会打开知乎写作页，扩展脚本负责填充内容。

---

## 技术架构

- **前端**：原生 HTML/CSS/JavaScript + TinyMCE 富文本编辑器（新增右侧“发布通道”侧栏）
- **浏览器扩展**：Chrome Extension Manifest V3
- **数据库**：Supabase（下一阶段开始用于管理通道配置、发布选项及发布记录）
- **部署**：腾讯云 CloudBase 静态托管

## 部署与同步

- 静态托管：默认部署到 CloudBase `simple-publisher/editor` 目录，指引页和 ZIP 包均从该路径引用。
- 每次修改完 `editor/`、`aifa-extension/` 或相关资源后，执行以下流程：
  1. 更新本地文件（确保图片命名规则不变）。
  2. 将 `editor/` 目录整体上传至 CloudBase 对应目录。
  3. 如需提交代码，按需 `git add/commit/push`（遵循「需我通知你再执行 git」的协作约定）。

---

## 维护建议

- 指引页新增图片时，保持 `step-XX.png` 命名，并在 README/规范文档中同步说明。
- 浏览器扩展若更新 `content-zhihu.js`，记得重新打包 ZIP 并覆盖 `editor/assets/aifa-extension.zip`。
- 通常不在仓库保留旧版扩展脚本备份（例如 `.backup` 文件），以免增加维护成本。
- 线上验证可在 Chrome 隐身模式访问部署地址，确保无缓存干扰。

如需更多历史记录与规范，请参考 `jindu.md` 与 `guifan.md`。
