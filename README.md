# 导演台

用于 AI 短剧站位、走位、动作和运镜参考的三维预演工具。版本 0.3.9，支持浏览器和 Windows 桌面版。

采用 [MIT 许可证](LICENSE) 开源。可使用、修改和分发，包括商用，需保留版权及许可声明。第三方依赖与内置动作素材遵循各自许可证；动作来源见 [NOTICE](src/animation/library/NOTICE.txt)，桌面发行版附带第三方许可清单。

[下载软件与配套 skill](https://github.com/mangfufu/director-desk/releases/latest) · [官网](https://bigthat.me)

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

`node scripts/test-continuous-shot.mjs` 使用本机 Chrome 检查区域编辑、视线关键帧、接拍、悬浮助手和导出画面抽样。`npm run desktop:prepare` 后运行 `node scripts/test-ai-desktop.mjs` 检查桌面助手与 MCP，使用隔离配置及本机模拟接口，不消耗模型额度。

## 功能

- 参数化人物、道具、家具、建筑和场景白模，颜色与模型资源管理。
- 真实场景取景，多摄影机路径、跟随和 POV，时间轴切镜与视频导出。
- 同一戏段的命名空间区域，以及独立于机位路径的视线关键帧。
- 人物动作预设、位置路径、群演、独立戏段和末帧接拍。
- 内置 AI 助手、MCP 查询与编辑，离线 skill 生成可导入网页版的 .director 文件。
- 完整本机会话保留；只有用户手动点击“新对话”才重置。
- 助手窗口可拖动、缩放和收起；收起不停止任务，并记住窗口布局。
- 桌面软件更新检查；安装版下载校验后由用户确认重启安装，免安装版引导下载新版压缩包。

桌面版在 AI 面板配置渠道；MCP 配置从“本机 MCP”复制，端口和加密令牌保存在本机，重启后开启 MCP 可复用原配置；“重置连接凭据”只更换令牌。端口被占用时提示冲突，不自动换址。首次升级到持久连接版本需重新复制一次配置。密钥使用系统加密保存在本机，不写入源码或工程。

## 源码结构

| 目录 | 用途 |
| --- | --- |
| src | 场景、模型、编辑器、渲染、动画及共用自动化工具 |
| desktop | Electron 主进程、协议适配、会话和 MCP 服务 |
| skills/director-desk | 在线操作说明、离线格式与公开模板 |
| scripts | 构建、隐私检查和可复现检查工具 |
| tests | 自动测试与合成几何基准 |
| website | 官网、本机只读下载服务及公开发布说明 |
| public | 公开应用图标 |

内置动作资源的来源和许可见 src/animation/library/NOTICE.txt。

仓库只保存源码、构建配置、公开运行资源及测试代码；不收录本机配置、私人素材、测试剧本、聊天历史、依赖目录或打包产物。Windows 安装包和免安装版单独放在 GitHub Releases。

免安装压缩包需完整解压，再运行 DirectorDesk.exe；本机设置仍使用系统用户配置目录，不随软件压缩包分发。

安装版与免安装版均在软件目录提供 `skills/director-desk/`。将整个目录交给 Agent 或复制到其技能目录即可使用，入口为 `SKILL.md`；需要一并保留 references、scripts 和 assets。它支持 MCP 在线操作，也支持离线生成可导入网页版的工程；离线脚本需要 Node.js 22+，运行软件本身不需要安装 Node.js。

## 官网与远程更新

官网为 https://bigthat.me 。网页与发布包由本机服务提供，通过独立 Cloudflare Tunnel 接入域名；不依赖 R2 或云主机，服务器关机时无法检查或下载更新。0.3.6 及更早版本需要先手动安装新版；0.3.7 起可使用软件内更新入口。免安装版不自动替换正在使用的目录。

发布顺序：修改版本及 `website/release-notes.json`，运行 `npm run desktop:pack`，用 `scripts/package-portable.ps1` 生成免安装包，并生成包含完整目录的 skill ZIP。准备对应版本的三个文件后运行 `node scripts/publish-update.mjs`。它核验安装包 SHA512、生成 SHA256 清单，只复制白名单发布文件；相同版本禁止替换内容，最后更新 latest.yml。

本机发布目录为 `.local/update-server/public/win-x64`，不进入源码或安装包。用 `node website/server.mjs` 运行网站，默认只监听 127.0.0.1:8788。Cloudflare Tunnel 配置保存在 `.local/update-server/tunnel.yml`，将自己的子域名指向该端口；凭据文件保留在本机 cloudflared 配置目录，不复制到发布目录。`scripts/start-update-server.ps1` 隐藏启动网站和独立隧道，日志及进程编号也仅保存在 `.local`。

`node scripts/test-updates-desktop.mjs` 验证更新窗口、本机设置以及真实 Electron 下载和损坏包拒绝；使用隔离目录，不执行安装程序。Windows 安装签名仍取决于发布者的代码签名配置；当前发行包未签名，下载完整性通过 SHA512 校验。
