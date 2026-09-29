# 本地开发与构建

[返回项目介绍](../README.md)


准备 Node.js 24+ 和 npm：

```bash
git clone https://github.com/mangfufu/director-desk.git
cd director-desk
npm ci
npm run dev
```

按终端显示的地址打开网页。要启动 **Electron 桌面开发版**（包含内置 AI、MCP 和桌面文件功能），执行：

```bash
npm run desktop:dev
```

这个命令复用 `desktop:prepare`，先构建网页与独立桌面运行目录，再启动 Electron，无需制作安装包。Windows 和 macOS 使用同一命令。首次使用需安装本机 Chrome，或通过 `CHROME_PATH` 指定 Chrome 路径。

开发版默认将配置、会话和自动恢复数据保存在 `.local/desktop-dev-profile/`，与安装版分开，重启后保留。源码修改后重新运行 `desktop:dev`；此入口不提供热更新。如果没有改代码，只想再次打开已经准备好的版本，可以运行：

```bash
npm run desktop:start
```

可通过 `npm run desktop:dev '--' --remote-debugging-port=9222` 传入 Electron 调试参数；网页开发仍使用支持热更新的 `npm run dev`。

首次运行测试，先准备公开测试素材（固定版本、校验下载内容并自动解压）：

```bash
npm run test:assets
npm test
```

素材只保存在不入库、不打包的 `test-assets/external/`，已有校验通过的文件可离线复用。来源、许可文件与 SHA-256 见 `scripts/test-asset-sources.json` 及素材目录；缺少素材时测试会明确提示，不会静默跳过。无需测试时，启动和构建软件不需要下载这些素材。

验证后构建网页或 Windows 安装包：

```bash
npm run build
npm run desktop:pack
```

macOS（Apple Silicon）构建 DMG：

```bash
npm run desktop:pack:mac
```

网页产物位于 `dist/`，桌面交付文件位于 `release/`（Windows 为 `DirectorDesk-Setup-<版本>.exe`，macOS 为 `DirectorDesk-<版本>-arm64.dmg`）。桌面构建使用本机 Chrome，可通过 `CHROME_PATH` 指定浏览器。macOS 包未做签名和公证，首次打开如被 Gatekeeper 拦截，请右键点击应用选择“打开”；macOS 版暂不支持应用内自动更新，请从发布页下载新版本。

发布 Windows GitHub Release 时，将构建生成的 `release/latest.yml` 与同版本安装包一起上传，保留文件名。更新客户端按清单校验下载包；缺少清单的历史 Release 仍可检测版本并打开下载页。

从 0.4.8 起支持四段修订号，例如 `0.4.8.1`。三段版本在 `package.json` 的 `version` 与 `shortVersion` 中填写相同值；四段版本使用 `version: "0.4.8+revision.1"`、`shortVersion: "0.4.8.1"`，以兼容 npm 和 Electron。界面、安装包文件名与 GitHub 标签使用四段版本；构建生成的更新清单保留原样即可。更新按四段数字比较，`0.4.8 < 0.4.8.1 < 0.4.9`；早于 0.4.8 的客户端需先升级到 0.4.8。

| 目录 | 内容 |
| --- | --- |
| `src/` | 场景、编辑器、动画、渲染和共用自动化工具 |
| `desktop/` | 桌面入口、AI 协议、MCP 服务和更新客户端 |
| `skills/director-desk/` | 技能说明与离线工程工具 |
| `scripts/`、`tests/` | 构建与验证工具 |

