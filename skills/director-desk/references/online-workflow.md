# 在线导演助手工作流

按用户要求操作白模场景。内置 AI 与 MCP 使用同一套工程规则；下文说明参数与空间含义，不要求固定制作顺序。工具描述包含完整说明时可直接使用；内置助手的简短描述未覆盖的字段，可用 `director_help(names:["工具名"])` 查询。

## 查询和修改

- `director_read` 获取当前工程；有任务快照时直接利用，需要对象详情或新版本时用 ids 限定查询。`director_assets(queries:[...])` 同时找多个相关资产，不必遍历目录。
- `director_apply` 可一批新增多个人物、道具、机位和动作，普通编辑直接提交。参数错误时按返回信息修改即可，无需逐对象预检。
- `director_spatial(time:秒,cameraId:"program")` 返回该时刻实际站位、朝向、边界与节目机位取景。position 是对象原点；bounds 是占据的空间。路径、姿态、绑定会改变实际位置，不能只看初始 position 推断全过程。遮挡采样按需启用。
- 构图或调度不合适时继续修改。检查范围由用户任务决定，不要求每次运行完整扫描或做到一次完美。

## 常用编辑约定

- 每批携带当前 revision 和唯一 requestId，正常批次失败不会部分写入，可撤销。不要改 locked/id/kind/asset；保留未修改的数据。遇到版本冲突，尊重用户的并行修改。超时先读取实际状态，避免重复新增。
- add 使用真实 asset ID 并省略 kind；kind 只用于已有导入资源的 actor/prop。显式指定新 ID，可被同批后续动作、机位和切镜引用。目录的 parameters 是定义，尺寸值写入 parameterPatchField，通常为 assetParameters，旧 stairs/road/wall/ground 为 parameters。
- `patch.camera` 合并提供的顶层字段，例如 `{focal:50,target:[0,1.2,0]}`；内部数组和其他嵌套对象整体替换，修改前读取原值。targetId:"" 解除跟随目标。
- 坐姿、走路等粗略动作优先查询 basic 预设。`motion` 操作用 time/duration 安排，省略 duration 会使用短默认时长；整场坐姿覆盖实际导出区间。插入会寻找空闲区间。无需手 K 面部、手指，也不用默认安排脚部校正。
- 米/秒，世界 +Y 向上、人物 +Z 向前；rotation 为弧度、pose 为度。路径用 `{smooth:false,points:[{time,position:[x,y,z]}]}`。颜色为 #RRGGBB。duration 支持小数，不把 24.5 秒无故延长至 25 秒。
- cuts 的 value 为完整 `[{time:0,cameraId},...]`；notes 的 value 为完整 `{fixedPrompt:"",sceneReferenceIds:[],notes:[{id,start,end,actorId:"",story:"",emotion:"",dialogue:"",action:""}]}`。所有文字字段齐全，未写内容用空串。保留原有备注/引用，不用 patch 替代 value。
- preview 不写入对象。预检成功后用 previewId、未变化的 revision 和新 requestId 提交，省略 operations；修改批次或预检失效时重新提供 operations。明确的小修改无需先预检。

## 多戏段、检查与交付

独立戏段与时间轴 cuts 不同。director_scene 的 continue 从当前段最后实际输出帧接拍，源段保持独立；director_continuity 查询保存的前情与末帧站位，director_spatial 查询当前实时状态。历史前情有分页，完整读取时跟随 nextOffset。高级接拍/资源规则按需查询帮助。

director_spatial 的 cameraId:"program" 使用真实节目切镜；入画包围盒与有限射线不是全程无遮挡保证。director_scan 可选区间检查，jobId 通过 director_job 查询；不要密集轮询。末帧根据 fps 计算，例如 10 秒 24fps 为 239/24 秒。

director_export 导出工程、截图、视频或素材包，走用户本地保存流程；save-requested 仅表示已发起保存。视频按当前独立戏段输出，工程包含所有戏段。没有执行导出就不声称已交付视频。参考视频确定运镜、景别、站位和走位，cut 提示词只写剧情、情绪、台词、自然动作。

停止和报错后保留完整对话。execution:"unknown" 表示调用结果未确认，先读工程/任务状态；not-started 表示未执行。只有用户手动点击“新对话”才清空历史。纯文件制作使用 skill 的离线流程，不需要 MCP；上述 previewId 是在线窗口的临时引用。
