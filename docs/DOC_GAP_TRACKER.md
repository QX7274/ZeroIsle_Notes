# 生产上线整改 GAP 台账（精简活跃版）

> 总控入口：[生产上线整改总控](D:/ZeroIsle_Notes/docs/生产上线整改总控.md)  
> 历史归档：[DOC_GAP_TRACKER-历史归档](D:/ZeroIsle_Notes/docs/archive/DOC_GAP_TRACKER-历史归档.md)
> 页面矩阵：[页面能力矩阵](D:/ZeroIsle_Notes/docs/页面能力矩阵.md)
> 子批次记录：[子批次执行记录-批次01（10页）](D:/ZeroIsle_Notes/docs/子批次执行记录-批次01（10页）.md)

## 1. 状态定义
- `TODO`：已登记未实施
- `IN_PROGRESS`：正在修复或验证
- `BLOCKED`：受外部条件阻塞
- `DONE`：代码/验证/文档/Git 四闭环完成

## 2. 活跃 GAP（仅保留当前推进必需项）
| GAP ID | 优先级 | 状态 | 责任 | 目标 | 最近提交 | 最近证据 | 下一步 |
|---|---|---|---|---|---|---|---|
| GAP-SEC-001 | P0 | IN_PROGRESS | 后端/安全 | 清理真实凭据与危险默认值 | `c7b162d` | 仓库配置核查记录 | 继续全仓扫描并补轮换说明 |
| GAP-SEC-002 | P0 | TODO | 后端/安全 | 密钥轮换与环境契约强制失败 | - | 外部平台待执行 | 拆成可执行检查清单 |
| GAP-DEPLOY-001 | P0 | IN_PROGRESS | 部署/CI | `/health/` 与 `/ready/` 职责闭环 | `c7b162d` | 部署配置与检查记录 | 演练冷启动与依赖异常场景 |
| GAP-DEPLOY-002 | P0 | TODO | 部署/CI | 迁移/静态/日志/持久化启动链闭环 | - | 待补 | 编写并验证一键演练流程 |
| GAP-CI-001 | P0 | IN_PROGRESS | 部署/CI | lint/test/build 全 hard-fail | `fba2e33`,`22f0bed` | Detox smoke 7/7 通过 | 增加回归门禁与失败快照 |
| GAP-TEST-001 | P0 | IN_PROGRESS | 后端/安全 | testing 环境去外部 Mongo 依赖 | `ff72009` | `manage.py check` 通过 | 扫尾模块级初始化副作用 |
| GAP-REVIEW-001 | P0 | IN_PROGRESS | 验证 | 全规划功能完成度与上线可用性审查 | 多提交持续推进 | 多轮真机与脚本证据 | 输出模块化“可上线判定矩阵” |
| GAP-DEVICE-001 | P0 | IN_PROGRESS | 移动端/验证 | Android MCP 真机覆盖核心页面并留证 | `44a616e`（round64） | `.local/android-mcp-server` round 证据链 | 继续 round65+，优先共享链与联网同步 |
| GAP-GROUP-012 | P1 | IN_PROGRESS | 移动端/验证 | 共享链 RTK 状态一致性与可观测性收口 | 多提交持续推进 | groupsSlice 单测 + 真机局部证据 | 做端到端真机观看/结束/重连闭环 |
| GAP-MOBILE-001 | P1 | IN_PROGRESS | 移动端 | `testID`、可测试性、UI 可达与降级体验 | 多提交持续推进 | Detox + 真机页面证据 | 继续补缺口页面与操作链 |
| GAP-SLIM-001 | P1 | IN_PROGRESS | 总控/环境 | 删除无用/过时/可再生资产并降输入噪声 | `1d96221`,`044a119`,`c572b46` | 清理记录与差异 | 本轮执行文档瘦身归档迁移 |
| GAP-SLIM-002 | P1 | IN_PROGRESS | 总控/环境 | 已跟踪缓存清理与防回流 | `1d96221` | `.gitignore` 与移除记录 | 持续巡检防回流 |
| GAP-ENV-001 | P0 | IN_PROGRESS | 总控/环境 | Conda `Zeroisle` 命令统一 | `1d96221` | `conda run -n Zeroisle` | 全测试命令统一到该入口 |
| GAP-ENV-002 | P0 | IN_PROGRESS | 移动端 | 统一 `yarn install` / `yarn android` | `1d96221` | 脚本与执行记录 | 继续约束子项目差异说明 |
| GAP-ENV-003 | P1 | IN_PROGRESS | 移动端 | 同局域网联调策略（热点/USB/ADB） | `3e961da` | `adb devices -l` 与本地联调记录 | 补无线 ADB 与失败回退文档 |
| GAP-DOC-ENC-001 | P0 | IN_PROGRESS | 总控/环境 | 统一 docs 活跃文档 UTF-8（无 BOM）并建立编码巡检 | `待提交` | `scripts/tools/check-doc-encoding.ps1` | 执行一次全量编码巡检并固定到每轮提交前 |
| GAP-PAGE-MATRIX-001 | P0 | IN_PROGRESS | 总控/验证 | 建立逐界面/逐功能/逐子功能执行矩阵并绑定活跃 GAP | `待提交` | `docs/页面能力矩阵.md`、`docs/子批次执行记录-批次01（10页）.md` | 进入 round65 按 10 页批次推进并回填证据 |
| GAP-UI-PROFILE-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Profile 页面阻断式交互与页内反馈一致性 | `待提交` | `src/screens/settings/ProfileSettings.js` 中 `state.profile.inlineStatus`；后续真机 round65 证据待补 | 继续补 Community/Reminder 页内状态一致性并统一玻璃卡视觉层级 |
| GAP-UI-COMMUNITY-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Community 分类筛选可测性与轻毛玻璃层级一致性 | `待提交` | `src/screens/community/CommunityScreen.js` 中 `filter.community.*`；分类区玻璃边界样式更新 | 补 round65 真机分类点击链与离线状态证据 |
| GAP-UI-REMINDER-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Reminder 同步状态可测锚点与轻毛玻璃层级一致性 | `待提交` | `src/components/reminder/ReminderListView.js` 中 `state.reminder.syncStatus.*` 与筛选栏/卡片玻璃样式更新 | 补 round65 reminder 同步状态卡真机证据并复核同步链稳定性 |
| GAP-UI-GROUP-DETAIL-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 GroupDetail 阻断交互与菜单动作可测性 | `待提交` | `src/components/groups/GroupDetail.js` 中 `state.group.inlineStatus.*` 与 `action.group.*` 锚点 | 补 round65 group detail 真机菜单动作链与页内状态证据 |

## 3. 已完成里程碑（保留最少）
| GAP ID | 状态 | 结论 | 提交 |
|---|---|---|---|
| GAP-BASELINE-001 | DONE | 基线入 `main` 完成 | `a1931d5` |

## 4. 本轮文档瘦身决议（2026-05-15）
- 主文档和台账改为“活跃控制面板”，移除重复 round 流水。
- 保留所有功能规划与子功能追踪，不删除功能项，仅迁移冗余历史到归档文件。
- 后续每轮记录要求：
  - 必须写“推进了哪个 GAP 的哪个验收标准”。
  - 只写新增证据，不重复粘贴历史证据长列表。
  - 每轮提交后更新“最近提交”和“下一步”列。
  - 每轮提交前必须执行一次 `scripts/tools/check-doc-encoding.ps1`，防止编码回退导致文档乱码。
