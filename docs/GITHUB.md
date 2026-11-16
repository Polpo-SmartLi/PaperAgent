# 发布到 GitHub

## 仓库内容

提交源码、前端、安装／启动脚本、测试和说明。不要上传 `data/`、`browser-profile/`、`runtime/`、`deps/`、`tools/`、`cache/`、`tmp/` 或 `dist/`。

`.gitignore` 已排除这些目录，仍应在每次推送前核对 `git status` 与暂存文件列表；不要使用 `git add -f` 强行加入忽略文件。分享源码包请使用下方的白名单打包脚本。

## 创建和上传

1. 在自己的 GitHub 账号中新建仓库，例如 `PaperAgent`，按需选择可见性。若从本地已有提交推送，建议创建空仓库。
2. 在项目目录查看暂存清单，检查没有真实 Key、个人数据或下载依赖。
3. 按自己账号的提交身份创建提交，将仓库 URL 添加为远程，再推送。
4. 上传前决定项目许可证。当前作者选择暂缓，不要误称项目已经采用 MIT 或 AGPL，也不要仅因仓库公开就假定他人获得了任意再利用授权。PyMuPDF 的许可需要一并考虑。

## 生成可上传源码包

安装运行时后，在项目目录运行：

```powershell
.\runtime\python.exe -B scripts\package_source.py
```

输出为 `dist/PaperAgent-source.zip`，仅包含白名单源码，压缩包内以 `PaperAgent/` 为根目录；同时生成文件清单及 SHA-256 校验信息。解压该包后可将包内文件上传到空仓库，不要只上传 ZIP 文件本身。也可在确定许可证后将源码包附加到 GitHub Release。

其他人可通过 GitHub 的 **Code → Download ZIP** 获取源码，解压后双击 `Start-PaperAgent.cmd`，首次运行会下载依赖。他们需填写自己的 AI API Key。

## 测试与反馈

CI 使用模拟模型测试对话，不需要 API Key。请勿将真实 Key 放到工作流或测试文件里。提交问题时可以描述复现步骤、浏览器版本与报错文字，避免附带 `data/settings.json` 或完整个人数据库。
