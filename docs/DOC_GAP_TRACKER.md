# 生产上线整改 GAP 台账（精简活跃版）

> 总控入口：[生产上线整改总控](D:/ZeroIsle_Notes/docs/生产上线整改总控.md)  
> 历史归档：[DOC_GAP_TRACKER-历史归档](D:/ZeroIsle_Notes/docs/archive/DOC_GAP_TRACKER-历史归档.md)
> 页面矩阵：[页面能力矩阵](D:/ZeroIsle_Notes/docs/页面能力矩阵.md)
> 子批次记录：当前工作区未发现 `子批次执行记录-批次01（10页）.md`；以本文件和 `docs/上线验收矩阵.md` 为当前入口。

## 1. 状态定义
- `TODO`：已登记未实施
- `IN_PROGRESS`：正在修复或验证
- `BLOCKED`：受外部条件阻塞
- `DONE`：代码/验证/文档/Git 四闭环完成

## 2. 活跃 GAP（仅保留当前推进必需项）
| GAP ID | 优先级 | 状态 | 责任 | 目标 | 最近提交 | 最近证据 | 下一步 |
|---|---|---|---|---|---|---|---|
| GAP-SEC-001 | P0 | IN_PROGRESS | 后端/安全 | 清理真实凭据与危险默认值 | 工作区未提交 | `.env`、`admin_system/backend/.env`、debug keystore 和 Firebase 配置已从 Git index 移除并保留本地；`.gitignore` 和本地 tracked-asset scan 已更新 | 完成旧提交/外部平台凭据轮换、历史扫描和生产注入说明 |
| GAP-SEC-002 | P0 | IN_PROGRESS | 后端/安全 | 密钥轮换与环境契约强制失败 | 工作区未提交 | `.gitignore` 已覆盖 `.env*`（保留 example）、签名文件和 Firebase 配置；CI security-scan 已改为 generalized tracked-asset gate；真实轮换和历史扫描待外部执行 | 拆成凭据轮换、历史处理、release keystore、生产环境和复验清单 |
| GAP-DEPLOY-001 | P0 | IN_PROGRESS | 部署/CI | `/health/` 与 `/ready/` 职责闭环 | 工作区未提交 | 生产设置已豁免内部 HTTP 探针；部署脚本已加入两路重试探针，`deploy_prod.ps1` 解析通过 | 使用真实 Compose 演练冷启动、TLS 终止和依赖异常场景 |
| GAP-DEPLOY-002 | P0 | IN_PROGRESS | 部署/CI | 迁移/静态/日志/持久化启动链闭环 | 工作区未提交 | 部署脚本现已校验生产变量、执行 Compose config/up 并等待 health/readiness；真实环境演练待补 | 在真实生产样配置执行一键演练并验证失败可阻断 |
| GAP-CI-001 | P0 | IN_PROGRESS | 部署/CI | lint/test/build 全 hard-fail | 工作区未提交 | Docker 发布 job 已把 `security-scan` 纳入 `needs`；tracked release-asset scan 本地通过；最新 `CI=1 yarn bundle:verify --max-workers 1 --verbose` 通过，`Done in 297.10s`、43 个资源；`.local/verification_bundle_sync_20260719.log` | 增加历史 secret scan、APK/release-signature、readiness 和失败快照门禁并复核 CI |
| GAP-TEST-001 | P0 | IN_PROGRESS | 后端/安全 | testing 环境去外部 Mongo 依赖 | `ff72009` | `manage.py check` 通过 | 扫尾模块级初始化副作用 |
| GAP-REVIEW-001 | P0 | IN_PROGRESS | 验证 | 全规划功能完成度与上线可用性审查 | 2026-09-27 Mac 复核 | 最新全量 Jest `74/74 suites、638/638 tests`、Lint `0 errors / 1204 warnings`；后端本机（@/opt/anaconda3/envs/ZeroIsle@）`21 passed / 2 skipped` + 分片契约 `15 passed`、Mac `assembleDebug` `BUILD SUCCESSFUL` + Android 14 模拟器启动/提醒 CTA/笔记持久化证据已回填；真实同步、500MB 附件、生产安全和真机矩阵仍未闭环 | 输出模块化“可上线判定矩阵”，并补 Windows 平板真机复验 |
| GAP-DEVICE-001 | P0 | IN_PROGRESS | 移动端/验证 | Android MCP 真机覆盖核心页面并留证 | 工作区 2026-07-19 复核 | `.local/android-evidence`：最新普通 `yarn android` 退出码 0，`BUILD SUCCESSFUL`、APK 安装成功、`MainActivity` 启动；`yarn_android_sync_20260719.log/.xml/.png/_crash.log` 命中 `screen.home`、`release_note_20260719`；设备 `HGR3Y9MA/TB128FU/Android 13` | 继续补搜索、AI、社区、提醒、群组、同步和异常流程；保持真机证据文件大小校验与 ADB 稳定性 |
| GAP-NOTE-001 | P0 | IN_PROGRESS | 移动端/核心笔记 | notesApi 本地优先 P0、远端契约和真机闭环 | 工作区 2026-07-19 复核 | 当前真机 `note_flow_editor_created.xml/.png`、`note_flow_after_save.xml/.png`、`note_flow_back_only.xml/.png`、`note_flow_after_restart_reverse_wait.xml/.png`；最新普通入口 `yarn_android_sync_20260719.*`；重启后日志记录开发者本地读取 1 条笔记；最新全量 Jest `46/46 suites、191/191 tests` 覆盖离线队列和编辑器 HTTP 同步代码 | 2026-09-28 修复离线列表主链（Results 被 `Array.isArray` 误判导致静默截断 20 条、Redux `fetchNotes` 列表恒为空、缺 `user_id` 隔离），并新增列表字段裁剪入口 `getAllNotesSummaries`；详见 `GAP-LIST-001`。仍需完成正文输入/自动保存、图片上传、历史/恢复、离线重开、笔迹和真实认证远端集成验证与设备复验 |
| GAP-007 | P0 | IN_PROGRESS | 后端/文件 | 500MB 附件的 init/chunk/complete/cancel/status、幂等、顺序校验、流式落盘和缓存闭环 | 工作区未提交 | `backend/notes/tests/test_chunked_upload_contract.py`：15 passed；客户端二进制分片/权威偏移/chunkSize/SHA-256：3 passed；schema migration：1 passed；已挂载 `/api/v1/files/upload/*`；服务端支持单 Range `206/416` 和逐分片/整文件摘要校验；`MAX_CHUNKED_ATTACHMENT_MB=500` | 2026-09-28 客户端缓存侧补齐纯函数 LRU 索引、可配置配额与预留余量、sha256/大小完整性校验、分段写入与统计/清理接口（`src/services/files` 34 passed）；仍需使用真实 Mongo/对象存储执行客户端认证下载、断点续传、权限、取消清理和 Android 平板性能验收 |
| GAP-GROUP-012 | P1 | IN_PROGRESS | 移动端/验证 | 共享链 RTK 状态一致性与可观测性收口 | 多提交持续推进 | groupsSlice 单测 + 真机局部证据 | 做端到端真机观看/结束/重连闭环 |
| GAP-MOBILE-001 | P1 | IN_PROGRESS | 移动端 | `testID`、可测试性、UI 可达与降级体验 | 2026-09-27 并行批次 | 笔记链路（`CardNoteScreen` 26、`SkiaPagedCanvasScreenNative` 13、`NoteStyleModal` 6、`NoteEditorScreen` 13）、搜索 8 个文件、社区 4 个文件补齐锚点；`jest src/screens/note src/screens/search src/screens/community` = 7 suites / 82 tests 通过；设备复验受主机负载阻塞 | 设备负载恢复后复验新锚点并回填 `.local/android-evidence`；继续补画布原生视图与工具栏（`src/components/**` 无锚点通道） |
| GAP-SLIM-001 | P1 | IN_PROGRESS | 总控/环境 | 删除无用/过时/可再生资产并降输入噪声 | `1d96221`,`044a119`,`c572b46` | 清理记录与差异 | 本轮执行文档瘦身归档迁移 |
| GAP-SLIM-002 | P1 | IN_PROGRESS | 总控/环境 | 已跟踪缓存清理与防回流 | `1d96221` | `.gitignore` 与移除记录 | 持续巡检防回流 |
| GAP-ENV-001 | P0 | IN_PROGRESS | 总控/环境 | Conda `ZeroIsle` 命令统一 | `1d96221` | `D:\APP\Anaconda\condabin\conda.bat run -n ZeroIsle`；当前 shell PATH 未注册 conda | 将固定入口写入脚本和开发环境说明 |
| GAP-ENV-002 | P0 | IN_PROGRESS | 移动端 | 统一 `yarn install` / `yarn android` | 2026-09-27 Mac 复核 | 本机 `npm install --legacy-peer-deps` + `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` `BUILD SUCCESSFUL`，337MB Debug APK 安装到 Android 14 模拟器并启动成功；已修复 wrapper 的 `D:/Gradle-8` 本地路径、`settings.gradle` 的 Windows 专属 `cmd /c` 自动链接命令、缺失 `google-services.json` 时硬失败、`gradlew` 缺可执行位、系统代理导致的依赖下载挂起；`.local/verification/android_build_round66.log` | 保持普通 `yarn android` 入口在本机回归，并补 `yarn install`（yarn 而非 npm）清洁环境演练 |
| GAP-ENV-003 | P1 | IN_PROGRESS | 移动端 | 同局域网联调策略（热点/USB/ADB） | `3e961da` | `adb devices -l` 与本地联调记录 | 补无线 ADB 与失败回退文档 |
| GAP-DOC-ENC-001 | P0 | IN_PROGRESS | 总控/环境 | 统一 docs 活跃文档 UTF-8（无 BOM）并建立编码巡检 | `待提交` | `scripts/tools/check-doc-encoding.ps1` | 执行一次全量编码巡检并固定到每轮提交前 |
| GAP-PAGE-MATRIX-001 | P0 | IN_PROGRESS | 总控/验证 | 建立逐界面/逐功能/逐子功能执行矩阵并绑定活跃 GAP | `待提交` | `docs/页面能力矩阵.md`；缺失的子批次记录不作为证据 | 进入 round65 按 10 页批次推进并回填证据 |
| GAP-UI-PROFILE-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Profile 页面阻断式交互与页内反馈一致性 | `待提交` | `src/screens/settings/ProfileSettings.js` 中 `state.profile.inlineStatus`；后续真机 round65 证据待补 | 继续补 Community/Reminder 页内状态一致性并统一玻璃卡视觉层级 |
| GAP-UI-COMMUNITY-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Community 分类筛选可测性与轻毛玻璃层级一致性 | `待提交` | `src/screens/community/CommunityScreen.js` 中 `filter.community.*`；分类区玻璃边界样式更新 | 补 round65 真机分类点击链与离线状态证据 |
| GAP-UI-REMINDER-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 Reminder 同步状态可测锚点与轻毛玻璃层级一致性 | `待提交` | `src/components/reminder/ReminderListView.js` 中 `state.reminder.syncStatus.*` 与筛选栏/卡片玻璃样式更新 | 补 round65 reminder 同步状态卡真机证据并复核同步链稳定性 |
| GAP-UI-GROUP-DETAIL-001 | P1 | IN_PROGRESS | 移动端/UI | 收口 GroupDetail 阻断交互与菜单动作可测性 | `待提交` | `src/components/groups/GroupDetail.js` 中 `state.group.inlineStatus.*` 与 `action.group.*` 锚点 | 补 round65 group detail 真机菜单动作链与页内状态证据 |
| GAP-UI-ADD-REMINDER-001 | P1 | DONE | 移动端/UI | 收口 AddReminder 创建提示状态可测性与操作条玻璃层级一致性 | `9b0114f` + 2026-09-27 Mac 复验 | `src/screens/reminder/AddReminderScreen.js`、`src/screens/reminder/reminderLayout.js`；2026-09-27 平板尺寸 Android 14 模拟器断言命中 `state.reminder.actionBar`、`action.reminder.cancel`、`action.reminder.create`（键盘展开/收起两态），创建与取消均回流 `screen.reminderList` 并重启持久：`.local/android-evidence/round66_add_reminder_retry.*`、`round66_add_reminder_nokeyboard.*`、`round66_reminder_after_create.*`、`round66_reminder_cancel_ok.*` | 在 Windows 平板真机 `HGR3Y9MA` 复验同等锚点与点击链 |
| GAP-DEVICE-ROUND65-001 | P0 | IN_PROGRESS | 验证 | 补齐 round65 对 AddReminder/GroupDetail/Reminder 回流链的真机证据 | 2026-09-27 Mac 模拟器 | 2026-09-27 已在平板尺寸 Android 14 模拟器补齐 AddReminder 独立场景证据（创建页两态锚点、创建/取消回流、重启持久）：`.local/android-evidence/round66_*`；原引用 `.local/android-mcp-server/round65_add_group_reminder_followup.xml/.png` 仍不存在 | 补 GroupDetail 菜单动作链与真机（`HGR3Y9MA`）版本证据 |
| GAP-NAV-001 | P1 | IN_PROGRESS | 移动端/架构 | 收口不可达的 MainNavigator 链路与幻影依赖 | 2026-09-27 工作区 | `src/navigation/MainNavigator.js` 未被渲染（bundle 中无 `VersionHistoryDrawer`）；`NoteEditorScreen`/`TemplateEditorScreen` 的 `@realm/react` 幻影导入已改为 `realm` 的 `BSON` 导出 | 由产品决定接线或删除 MainNavigator；接线前需确认 `NoteEditor` 与当前可达的 `CardNoteScreen` 的职责边界 |
| GAP-SEARCH-001 | P1 | IN_PROGRESS | 移动端/验证 | 搜索提交后必须展示结果页或明确空态，不能回到首页保留未过滤列表 | `待提交` | 修复前 `.local/android-evidence/search_no_match_20260717-030115.xml`；修复后 `.local/android-evidence/search_fix_submitted_20260717-112226.*` 命中结果页空态 | 继续补正常结果、历史、清除历史、图像/语音和网络异常场景 |
| GAP-LIST-001 | P0 | DONE | 移动端/核心笔记 | 离线笔记列表主链不得静默截断、必须返回真 Array、必须按 user_id 隔离 | 2026-09-28 Mac | `src/services/offline/getNotes.js`：`isResultsLike`（length+slice）替代 `Array.isArray` 误判；查询下推 `is_deleted = false AND user_id == $0`；`data` 经 `materializePage` 返回真 Array；支持 `{ skip, limit }` 且未传时不截断；`src/services/offline/__tests__/getNotes.test.js` 覆盖 25 条不截断 / `Array.isArray(data)` / 跨账号不可见 / 10 万条只 slice 一页；`src/services/offline + src/services/api` 23 passed | 2026-09-28 已在平板尺寸 Android 14 模拟器复验：冷启动 @从离线存储获取到笔记数量: 3@，首页渲染 @round67persist/round67listfix/round66no@ 三张卡片（@.local/android-evidence/round67_final_home.{xml,png}@）；后续只需在 Windows 平板真机补一次同等证据 |
| GAP-SYNC-RECOVER-001 | P0 | IN_PROGRESS | 移动端/同步 | 同步错误分类、指数退避可取消重试、Client Reset 备份恢复并接入真实调用方 | 2026-09-29 Mac（已接线） | `src/services/sync/syncErrorRecovery.js`（classifySyncError / computeBackoffDelay / createRetryController / createClientResetRecovery，依赖可注入）；`src/services/sync/syncManager.js` 在 3 个 catch 点分类并标注；`syncErrorRecovery.test.js` 51 passed | 2026-09-29 已接线：`syncManager` 单条操作用 `createRetryController` 包裹、新增 `cancelPendingRetries()`、Client Reset 备份复用 `realmBackupService` 并加同会话去重（`src/services/sync` 66 tests）；真实 Realm Client Reset 回调链路待 Realm Sync 启用 |
| GAP-LIST-UI-001 | P0 | DONE | 移动端/核心笔记 | 首页列表消费轻量 summary（不含 content/pages/strokeData）并在需要时按 id 延迟加载正文 | 2026-09-29 Mac + 模拟器 | `notePreview` 写入侧打标（createNote/updateNote/saveOfflineNote/importNote）、`toNoteSummary` 增加 previewText/hasPages/hasStrokeData、`NOTE_SUMMARY_FIELDS` 补 19 个小标量字段、HomeScreen `loadNotesListPayload` 优先 summary 并自动回退、正文按 id 延迟加载、存量回填入口 + 未打标自愈；设备链路 `3/3 未打标 → 回填 3 条 → 自动重载 → `使用轻量 summary 列表，条数: 3`，点击可进 `screen.pagedCanvas`（`.local/android-evidence/round68_*.{xml,png}`）；`jest src/screens/common src/services/notes` 41 tests | Windows 平板真机补同链路证据；直写 Realm 入口打标见 `RISK-LIST-UNTAGGED-001` |
| GAP-PERF-GATE-001 | P1 | DONE | 移动端/验证 | 把「10 万条下每页只物化一页」固化为可持续回归门禁 | 2026-09-29 Mac | `src/tests/perf/listMaterializationBudget.test.js`：34 例覆盖 Note 六个入口、AIChat、MindMap/InfiniteCanvas/KnowledgeGraph、SearchIndex、realmService 与 12 个同构 find*ByUser 入口，全部用确定性 materialized 断言；含历史写法 `100000` 对照用例守护灵敏度；`src/tests/perf/README.md` 记录基线表与真机量化步骤 | 在 Windows 平板执行 README 第 5 节的真机 P95/FPS/Heap 采集并回填 |

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
