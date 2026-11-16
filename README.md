# PaperAgent

一个在本地浏览器运行的论文阅读工作台：阅读 PDF、划选翻译、带页码依据的问答、论文搜索，以及独立的 AI 助手。

## 功能

- **PDF 阅读**：导入论文、按页浏览、缩放，支持同栏跨行与反向划选。
- **确认后翻译**：选中文字，点击阅读区底部“翻译选中内容”，译文显示在右侧栏，不遮挡正文；支持复制、收起、保存为笔记。
- **问论文**：检索当前论文原文，附每轮独立的证据编号和 PDF 页码，可跳回页面核对；支持连续追问与历史恢复。
- **AI 助手**：无需打开论文即可讨论概念、编程问题和研究思路，聊天记录独立保存。
- **论文搜索**：联合 Crossref 和 DataCite（含 arXiv DOI 记录），精确标题优先、结果去重，支持 DOI、arXiv 编号和链接。
- **本地笔记**：保存观点、选中原文、译文及页码，支持 Markdown 导出。

## Windows 快速开始

支持 Windows 10/11 **x64**，需已安装 Edge 或 Chrome。首次安装需要联网，不需要自行安装 Python 或 Node.js。

1. 下载本仓库（GitHub 页面选择 **Code → Download ZIP**），解压到你希望保存程序和数据的目录，例如 `E:\PaperAgent`。不要直接在 ZIP 内运行。
2. 双击 **`Start-PaperAgent.cmd`**。首次运行会调用安装脚本，在项目目录内下载独立 Python 和 PDF 依赖；下载完成后打开本地浏览器窗口。
3. 右上角打开“模型设置”，填写自己的 AI 接口地址、模型名和 API Key，保存。
4. 导入一篇文字型 PDF，开始阅读。也可以直接点击“AI 助手”提问。

独立安装入口：`Install-PaperAgent.cmd`。安装失败时检查网络，然后再次运行。

浏览器地址：[http://127.0.0.1:8765](http://127.0.0.1:8765)。服务仅监听本机；本项目不提供公网部署或多用户隔离。一个端口同时运行一个实例。

### DeepSeek 配置示例

| 字段 | 内容 |
|---|---|
| 接口根地址 | `https://api.deepseek.com` |
| 模型名称 | 填写 DeepSeek 平台当前提供的模型 ID，例如 `deepseek-flash` |
| API Key | 使用者自己申请的密钥 |

程序会追加 `/chat/completions`，不要把这个后缀填进根地址。其他兼容 Chat Completions 的服务也可使用；模型可用性和费用以服务商为准。未配置 AI 时仍可阅读、记笔记、搜索论文和检索候选原文。

## 数据与隐私

每位使用者在自己电脑上配置密钥。仓库和源码包不包含任何真实密钥、论文、笔记、聊天记录或浏览器配置。

所有应用文件均相对于项目目录保存：

| 目录 | 内容 | 是否纳入 Git |
|---|---|---|
| `web/`、`server.py`、`paper_search.py` | 前后端源码 | 是 |
| `runtime/`、`tools/`、`deps/` | 安装脚本下载的 Python、pip 和 PDF 依赖 | 否 |
| `data/` | PDF、SQLite 笔记与聊天记录、模型设置、Markdown 导出 | 否 |
| `browser-profile/` | 专用浏览器配置 | 否 |
| `cache/`、`tmp/` | 应用下载、渲染缓存与临时文件 | 否 |
| `dist/` | 本地生成的分享包与清单 | 否 |

API Key **明文**存储在 `data/settings.json`，请保护好这个目录。远程翻译会发送选中文本，论文问答会发送候选段落及最近对话，AI 助手会发送提问及最近对话到配置的服务。论文搜索会把搜索词发送至搜索源。

不要把整个运行目录打包分享。使用 `scripts/package_source.py` 生成仅包含源码的包；`.gitignore` 同时排除了运行数据。更多信息见 [发布指南](docs/GITHUB.md)。

浏览器程序使用系统既有安装；项目运行时、依赖、浏览器用户配置、应用数据和缓存位于项目目录。Windows 和浏览器自身可能产生系统日志，程序无法约束操作系统的全部写入。

## 限制

- 仅支持文字型 PDF；扫描件需自行 OCR 后导入。单文件上限 80 MB、2000 页，不支持直接导入加密文档。
- 划选以单词为单位；双栏内容建议分栏选择，复杂公式、旋转文字和异常字体可能影响效果。
- 引用采用 PDF 文件页码，可能与印刷页码不同。候选证据不等于已经验证结论，需核对原文。
- 本地检索目前采用关键词匹配；中文问题查询英文论文时建议加入英文关键词。
- 论文问答使用最近 6 轮 AI 对话；独立助手使用最近 8 轮。历史记录持续保存在本地。
- 独立 AI 助手不自动读取当前 PDF，也不自动联网搜索。
- 论文搜索是关键词和标题检索，不是引用图谱推荐；打开 PDF 不会自动导入本地论文库。
- 已有逻辑与接口回归测试；复杂论文排版与不同设备的鼠标交互仍需要实际试用核对。

## 开发与测试

后端：Python 标准库 HTTP 服务、SQLite、PyMuPDF；前端：原生 HTML/CSS/JavaScript，无需 npm 构建。

Windows 完成安装后：

```powershell
.\runtime\python.exe -B server.py
.\runtime\python.exe -B tests\test_chat.py
.\runtime\python.exe -B tests\test_search.py
```

已安装 Node.js 的开发者可运行：

```powershell
node tests/selection.cjs
node tests/reader-ui.cjs
```

真实 PDF 几何测试 `tests/real-pdf-selection.cjs` 需要自行准备 `tmp/selection-fixture.json`，未提供时跳过；仓库不附带论文文件。

使用已有 Python 3.12 的开发者也可将依赖安装到项目目录后运行：

```sh
python -m pip install --target deps -r requirements.txt
python -B server.py
```

Windows 启动器之外的平台尚未完成验证。

## 许可证

**项目许可证暂未选择。** 当前准备的是源码分享版本，尚未声明允许再许可、修改或再分发的项目授权条款。

第三方依赖的许可证仍适用，尤其是 PyMuPDF 的 AGPL／商业双许可。发布者需要在正式发布前确定项目许可安排，参见 [第三方依赖说明](THIRD_PARTY_NOTICES.md)。
