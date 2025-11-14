# 工具脚本说明

本目录包含项目开发过程中使用的工具脚本。

## 脚本列表

### inspect_word_sections.py

**用途**：检查Word文档的章节结构

**功能**：
- 从HTML格式的Word文档中提取章节信息
- 解析H2标题及其内容
- 输出章节的文本、图片和列表信息

**使用方法**：
```bash
cd scripts
python inspect_word_sections.py
```

**输入文件**：`editor/assets/images/chrome-guide/source.html`

### parse_word_html.py

**用途**：解析Word HTML文件并生成JSON配置

**功能**：
- 解析HTML格式的Word文档
- 提取章节标题、文本块和图片
- 生成JSON格式的配置文件

**使用方法**：
```bash
cd scripts
python parse_word_html.py
```

**输入文件**：`editor/assets/images/chrome-guide/source.html`  
**输出文件**：`editor/assets/images/chrome-guide/sections.json`

## 依赖

- Python 3.x
- BeautifulSoup4 (`pip install beautifulsoup4`)

