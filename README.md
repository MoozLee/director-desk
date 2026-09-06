# 导演台

用于 AI 短剧站位、走位、动作和运镜参考的三维预演工具。版本 0.3.5，支持浏览器和 Windows 桌面版。

## 开发

需要 Node.js 24+、npm；桌面构建在 Windows x64 验证，构建图标及浏览器检查需要本机 Chrome，可通过 CHROME_PATH 指定路径。

```powershell
npm ci
npm run dev
```

按终端显示的本地地址打开网页。

```powershell
npm run build
npm run desktop:pack
```

网页产物生成到 dist，桌面安装包生成到 release。构建会从共用源码生成 skill 离线工具，并执行发布隐私白名单检查。

完整测试包含 17 项使用公开第三方模型的导入检查。这些模型不进入源码仓库；首次测试先按以下命令下载并解压，保留下载目录内的来源与许可记录：

```powershell
node scripts/download-test-models.mjs
Expand-Archive -LiteralPath test-assets/external/kenney_furniture-kit.zip -DestinationPath test-assets/external/kenney-furniture -Force
node scripts/download-fbx-fixtures.mjs
npm test
```

未准备这些模型时，相关测试会报告缺少 test-assets 文件；应用运行与构建不依赖这些测试素材。

## 功能

- 参数化人物、道具、家具、建筑和场景白模，颜色与模型资源管理。
- 真实场景取景，多摄影机路径、跟随和 POV，时间轴切镜与视频导出。
- 人物动作预设、位置路径、群演、独立戏段和末帧接拍。
- 内置 AI 助手、MCP 查询与编辑，离线 skill 生成可导入网页版的 .director 文件。
- 完整本机会话保留；只有用户手动点击“新对话”才重置。

桌面版在 AI 面板配置渠道；MCP 配置从“本机 MCP”复制。密钥使用系统加密保存在本机，不写入源码或工程。

## 源码结构

| 目录 | 用途 |
| --- | --- |
| src | 场景、模型、编辑器、渲染、动画及共用自动化工具 |
| desktop | Electron 主进程、协议适配、会话和 MCP 服务 |
| skills/director-desk | 在线操作说明、离线格式与公开模板 |
| scripts | 构建、隐私检查和可复现检查工具 |
| tests | 自动测试与合成几何基准 |
| public | 公开应用图标 |

内置动作资源的来源和许可见 src/animation/library/NOTICE.txt。

仓库只保存源码、构建配置、公开运行资源及测试代码；不收录本机配置、私人素材、测试剧本、聊天历史、依赖目录或打包产物。Windows 安装包和免安装版单独放在 GitHub Releases。

免安装压缩包需完整解压，再运行 DirectorDesk.exe；本机设置仍使用系统用户配置目录，不随软件压缩包分发。
