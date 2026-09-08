# 导演台 · DirectorDesk

面向 AI 短剧和视频创作的三维预演工具。先搭场景、排人物走位和运镜，再导出参考视频。支持手动制作，也支持 AI 助手和 MCP Agent 直接操作工程。

[下载 Windows 版](https://github.com/mangfufu/director-desk/releases/latest) · [获取配套 skill](https://github.com/mangfufu/director-desk/releases/latest) · [MIT License](LICENSE)

![布景与摄影机画面并排预览，下方编排动作和切镜](docs/images/workspace.jpg)

## 能做什么

| 功能 | 用法 |
| --- | --- |
| 白模搭景 | 使用人物、动物、家具、建筑、道路和道具，调整尺寸、颜色与摆放位置 |
| 仅几何体 | 用六种基础几何体组合、上色，快速表达人物和场景；AI 按需检索资产 |
| 导入模型 | 导入 GLB/glTF、FBX 和 OBJ 资源，随工程保存 |
| 人物调度 | 编排站位、走位路径、基础动作和群演，支持手持道具绑定 |
| 操控录制 | 用键盘控制白模移动，将走位录成可继续编辑的路径 |
| 摄影机与运镜 | 从三维场景真实取景，编排多机位路径、视线、跟随、POV 和切镜 |
| 时间轴编辑 | 缩放、拖动、分割片段、调整时长，手动记录位置关键帧 |
| 多场戏接拍 | 同工程切换独立戏段，从上一段末帧继承场景和人物状态 |
| 视频与提示词 | 导出参考视频、工程和素材包，可选人物名字标签；各戏段独立保存配套视频提示词 |
| AI 协作 | 内置助手与外部 MCP Agent 查询空间、编辑当前工程、检查和修正调度 |

### 资产与摄影机

选择白模搭建场景，调整人物和道具，再设置摄影机的景别、目标与运动路径。

![内置资产库与摄影机参数](docs/images/camera-path.jpg)

### 让 AI 直接操作

**内置导演助手**：配置模型渠道后，用自然语言提出搭景、走位或镜头调整要求。助手窗口支持拖动、缩放和收起。

**MCP Agent**：在软件的 **AI → MCP 连接** 中复制连接配置，让 Agent 读取内置 `director_skill`，即可操作当前工程。它能查询指定时刻的位置与空间关系，再继续修改场景、机位和分镜。

配套 skill 随软件提供，也支持生成可导入网页版本的 `.director` 工程文件。

![导演助手窗口与任务输入](docs/images/ai-assistant.jpg)

## 开始使用

1. 从 [Releases](https://github.com/mangfufu/director-desk/releases/latest) 下载 Windows 安装包或免安装 ZIP。
2. 安装后启动，或完整解压 ZIP 后运行 `DirectorDesk.exe`。
3. 选择场景模板，加入人物与道具，在时间轴上安排动作和镜头。
4. 播放预览，导出参考视频；点击戏段旁的“提示词”查看、编辑或导出配套文案。

支持常见横竖画幅与帧率。工程可保存为文件，之后继续编辑或交给 Agent 调整。
桌面版可在“文件位置”设置默认工程和导出目录，退出时可选择保存并退出、不保存退出或取消。

## 本地开发

准备 Node.js 24+ 和 npm：

```bash
git clone https://github.com/mangfufu/director-desk.git
cd director-desk
npm ci
npm run dev
```

按终端显示的地址打开网页。构建网页和 Windows 桌面版：

```bash
npm run build
npm run desktop:pack
```

网页产物位于 `dist/`，桌面交付文件位于 `release/`。桌面构建使用 Windows x64 和本机 Chrome，可通过 `CHROME_PATH` 指定浏览器。

| 目录 | 内容 |
| --- | --- |
| `src/` | 场景、编辑器、动画、渲染和共用自动化工具 |
| `desktop/` | 桌面入口、AI 协议、MCP 服务和更新客户端 |
| `skills/director-desk/` | 技能说明与离线工程工具 |
| `scripts/`、`tests/` | 构建与验证工具 |

## 许可证

项目自有代码采用 [MIT](LICENSE) 许可证。第三方依赖和动作素材保留各自许可，内置动作来源见 [NOTICE](src/animation/library/NOTICE.txt)。
