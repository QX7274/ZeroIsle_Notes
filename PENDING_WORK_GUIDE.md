# 未完成任务清单与后续开发指导（Pending Work Guide）

本文档用于指导后续开发，聚焦两大范围：
- 数据同步一致性与稳定性（Realm + MongoDB Device Sync）
- 移动端性能与稳定性（10 万条笔记、500MB 附件）

> 说明：当前仓库已完成 Custom JWT 认证链路收敛、Sync Realm 打开路径与最小 Flexible Sync 订阅集接入、
> Note 字段级合并、里程碑 3（冲突审计/deviceId/幂等）、里程碑 4 客户端缓存链路与 10 万条查询整改的主体部分。
> 以下为**仍未完成/需补齐**的任务，按里程碑与优先级组织；已完成项保留结论与证据，便于复验。

---

## 里程碑 2（Device Sync）

> 任务映射：GAP-001 / GAP-002 / GAP-003（详见 `docs/DOC_GAP_TRACKER.md`）

### 2.1 Realm App 控制台配置（阻塞真实联调）
- **目标**：让 Custom JWT + Flexible Sync 在真实环境可用。
- **需要完成**：
  - **Realm App ID**：提供正式 App ID，并注入到客户端配置（严禁硬编码敏感信息）。
  - **JWT 验签配置**：
    - 选择算法（推荐 RS256）
    - 配置 JWKS 或公钥
    - 明确 `sub`/`user_id` 到 Realm user id 的映射
    - 令牌过期策略与续期策略
  - **Flexible Sync 权限规则**：
    - 基于 `user_id`（或选定 ownerId 字段）限制 read/write
    - 确认所有同步集合（Note/Attachment/OfflineQueue/SyncInfo 等）规则一致
- **验收**：
  - 2 台设备同账号：离线编辑 -> 上线同步成功（TTE P95）
  - 2 个账号：互不可见数据
- **状态**：`BLOCKED`（外部控制台条件未提供）。

### 2.2 Subscriptions 与 ownerId/user_id 对齐
- **现状**：客户端订阅条件使用 `user_id == user.id`。
- **风险**：Realm user.id 不一定等于业务 user_id。
- **建议**：二选一并全链路对齐：
  - **方案 A**：以 Realm user.id 作为 user_id（后端 JWT `sub`=业务 user_id 也可，但需确保一致）
  - **方案 B**：以业务 user_id 作为 ownerId，JWT 中携带并在 Realm 中作为字段写入；订阅条件改为 ownerId
- **工作项**：
  - 统一字段命名：`user_id` vs `ownerId`
  - 在 create/update 写入入口强制写入 owner 字段
- **状态**：`BLOCKED`（依赖 2.1 的 App/JWT 配置）。

### 2.3 Sync 错误恢复与 Client Reset 策略
- **需要补齐**：
  - Sync Session 错误分类：网络/权限/会话过期/Client Reset ✅ **已完成（2026-09-28）**
  - 重试策略（指数退避 + 上限 + 可取消）✅ **已完成（2026-09-28）**
  - Client Reset：备份 Realm 文件 + 引导恢复（避免数据丢失）✅ **基础设施已完成（2026-09-28）**，
    真实回调接线待 Realm Sync 启用（本仓库 realm 20.1.0 未导出 ClientResetError）
- **已落地实现（2026-09-28）**：
  - 新增 `src/services/sync/syncErrorRecovery.js`：
    - `classifySyncError(error)` -> `{ category, retryable, userMessage }`，覆盖
      `network | auth | permission | sessionExpired | clientReset | conflict | server | unknown`；
      判定优先级：Client Reset > HTTP 状态码（401 会话语义/403/409/408/429/5xx）> 结构化错误码与网络标记 > 消息关键字 > unknown（保守不可重试）
    - `computeBackoffDelay(attempt, { baseMs, maxMs, jitter, random })`：指数退避 + 上限 + 可选抖动
    - `createRetryController(...)`：返回 `{ run(fn), cancel(), cancelled, isCancelled() }`，
      取消可唤醒退避等待且不吞掉最后一次错误，不可重试错误短路
    - `createClientResetRecovery(...)`：Client Reset 前备份 Realm 文件，返回
      `{ backupPath, restore(), description }`，备份失败抛带原因的明确错误，绝不静默丢数据
    - 时间/休眠/文件系统/随机数全部可注入，零原生依赖
  - `src/services/sync/syncManager.js` 在 `syncAll`、`pullFromServer`、单条操作 catch 处分类并标注
    `error.syncCategory/syncRetryable/syncUserMessage`（不改变原有抛出行为）
  - 测试：`src/services/sync/__tests__/syncErrorRecovery.test.js`，`51 passed`
- **已完成（2026-09-29 续）真实接线**：
  - `syncManager.syncPendingOperations` 的单条操作已由 `_executeOperationWithRetry` 用 `createRetryController` 包裹
    （退避重试、耗尽后沿用既有失败标记语义、不可重试错误短路）
  - 新增 `cancelPendingRetries()`：可中止进行中的退避等待，取消不吞错、不算成功，剩余操作保持 pending
  - Client Reset 备份改为复用 `realmBackupService.backupRealmFile`（与 `realmConfig.onError` 的 ClientReset 回调同一实现），
    并加同一会话去重；备份失败显式抛错，不静默丢数据
  - `src/services/sync` 合计 `66 passed`
- **仍待完成**：
  - Realm Sync 启用后接入真实 Client Reset 回调链路（本仓库 realm 20.1.0 无 ClientResetError 导出，
    当前为「错误分类兜底备份 + `onError` 回调」双触发，跨触发点去重需改 `realmConfig.js`）
- **验收**：
  - 弱网/断网/切后台 200 次不崩溃
  - Sync 失败可自动恢复率 >= 95%

---

## 里程碑 3（字段级合并 Field-Level Merge）

> 任务映射：GAP-004 / GAP-005 / GAP-006（详见 `docs/DOC_GAP_TRACKER.md`）

### 3.1 冲突审计真正接线（SyncInfo/ConflictLog）✅ 已完成
- `EnhancedNoteService.updateNote` 已调用 `_detectMergeConflicts`，冲突时写入
  `SyncInfo(operation='conflict')`，字段含 `entity_id/entity_type/device_id/clientOpId/data(冲突摘要)`，
  写入失败降级为 warn 不阻断主流程。
- 证据：`src/services/notes/enhancedNoteService.js`、`src/services/notes/__tests__/enhancedNoteService.test.js`。

### 3.2 deviceId 稳定来源（不可依赖入参）✅ 已完成
- `src/services/app/deviceIdentityService.js`：首次生成并持久化，后续复用。
- create/update/offlineQueue/syncInfo 均从该服务取 deviceId。

### 3.3 幂等重放（OfflineQueue）策略 ✅ 已完成
- 离线队列写入统一携带 `clientOpId`；重放按 `clientOpId` 幂等去重
  （`_buildOfflineDedupKey` / `_getPendingDuplicateItems` / `_markDuplicatesAsSynced`）。
- 失败记录 `error + retry_count`，达到 `MAX_OFFLINE_RETRIES` 进入 `failed`。
- 证据：`src/services/offline/offlineSyncService.js`、`src/services/offline/__tests__/offlineSyncService.test.js`。

### 3.4 仍未闭环
- 真实 Mongo/远端 `/sync/notes/` 的端到端同步、双设备冲突与数据隔离仍需真实环境验收。

---

## 里程碑 4（500MB 大附件：模拟分片 + 断点续传 + 缓存/LRU + 非阻塞）

> 任务映射：GAP-007 / GAP-008（详见 `docs/DOC_GAP_TRACKER.md`）

### 4.1 现有附件链路缺口 ✅ 已完成（客户端侧）
- `FileUploader` -> `fileService.uploadFile` -> `chunkedUploadService` 链路完整
  （小文件直传 + 大文件分片、暂停/恢复/取消）。
- 证据：`src/components/FileUploader.js`、`src/services/files/fileService.js`、`src/services/files/chunkedUploadService.js`。

### 4.2 核心组件 ✅ 已落地（2026-09-28 补齐缓存/LRU）
- **UploadSession schema（Realm）** ✅：fileId/localPath/fileSize/chunkSize/uploadedBytes/status/error/retryCount/
  updatedAt/deviceId/clientOpId/noteId/attachmentId。
- **chunkedUploadService** ✅：切片读取（有界 1MB base64）、分片上传、断点恢复（服务端权威偏移）、
  失败指数退避重试、暂停/取消、完成前整文件 SHA-256 校验。
- **downloadCacheService + LRU** ✅（2026-09-28 增强）：
  - 新增 `src/services/files/cacheLruIndex.js`：与 Realm/RNFS 解耦的纯函数 LRU 索引
    （upsert/touch/remove/totalSize/selectEvictions/normalizeEntries）；淘汰顺序确定
    （lastAccessedAt 升序、同时间按 key 升序）；预算 = maxBytes - reserveBytes；
    protectedKeys（正在写入项）不淘汰；超额 incoming 只淘汰到清空，不会出现负数。
  - `downloadCacheService` 新增 `configure({ maxCacheSize, reserveRatio, chunkWriteThreshold, chunkWriteSize })`
    （默认 2GB / 预留 10% / 8MB 阈值 / 1MB 分段、分段上界 4MB）。
  - **完整性校验**：`saveToCache` 支持 `metadata.sha256` / `metadata.expectedSize`；
    校验失败抛 `CACHE_INTEGRITY_MISMATCH`、清理半成品且不写索引；
    `RNFS.hash` 不可用时安全降级为仅大小校验，不阻断主流程。
  - **分段写入**：大文件走 `RNFS.read + writeFile/appendFile` 有界分段，小文件保留 `copyFile` 快路径。
  - 新增 `getCacheStats() / removeFromCache(fileId) / clearCache()`；`_getCacheKey/_sanitizeExtension` 路径规则不变。
  - 测试：`src/services/files/__tests__/cacheLruIndex.test.js`（新增）、
    `src/services/files/__tests__/downloadCacheService.test.js`（扩展），合计 `34 passed`。
- **non-blocking I/O** ✅（有界）：分片/分段读写均按固定大小分批，单次读入内存有上界。
- **已完成（2026-09-29 续）调用方接线**：
  - 新增 `src/services/files/cacheSaveMetadata.js`：从文件/附件记录提取可得的 `sha256`（64 位 hex 归一化）与
    期望字节大小，取不到/非法一律不传，保持「可选校验」
  - `FileViewerScreen` 调用 `saveToCache` 时接入该 metadata（含本地 `stat` 大小用于配额）
  - 配额配置入口：`src/config/index.js` 新增 `CACHE_CONFIG`；`downloadCacheService` 新增 `resolveCacheDefaults` 与
    `setCacheQuota`，默认仍 2GB / 10% 预留
  - 安全加固：期望大小不再读取 `contentLength`（那是「正文字符数」，与字节数不等价，会误判为缓存损坏）
  - `src/services/files` + `src/screens/common` 合计 `56 passed`
- **仍待完成**：
  - 真实对象存储、客户端认证下载、断网恢复与 500MB 真机内存/吞吐验收仍未执行（需真机与后端）。

### 4.3 对服务端的最小依赖 ✅ 已具备
- 后端已提供 `init/chunk/complete/cancel/status/download`，支持单 `Range`（`206/416`）、
  逐分片与整文件 SHA-256 校验、`MAX_CHUNKED_ATTACHMENT_MB=500`。
- 证据：`backend/notes/tests/test_chunked_upload_contract.py` `15 passed`。

### 4.4 验收指标（必须量化，仍未产出）
- 500MB 上传：断网 3 次仍可恢复完成，成功率 >= 99%
- 下载/预览：内存峰值不超过基线 + 150MB（分机型）
- 缓存：可配置上限（如 2GB），触发 LRU 清理后占用不超过阈值（**代码已支持配额与预留，缺真机量化**）

---

## 性能专项（10 万条笔记）

> 任务映射：GAP-009（详见 `docs/DOC_GAP_TRACKER.md`）

### 5.1 Realm 查询与分页（避免全量 materialize）
- **已完成（2026-09-27）**：`src/models/utils/queryPagination.js` 分页前置到 `Results.slice`，
  15 个模型文件 40 处列表分页改造，`RealmService.objects()/find()`、`mindMapApi.getMindMaps()`、
  `notesApi.saveOfflineNote()` 同批改造；10 万条回归测试。
- **已完成（2026-09-27 续）**：JS 谓词过滤路径的有界窗口扫描
  （collectFilteredItems / filterPageInWindows / tryFilterSortPageInWindows），
  `KnowledgeGraph/InfiniteCanvas/MindMap.findSharedWithUser` 与 `AIChat.search` 已改造；
  `SearchIndex.vectorSearch` 经评估本身是惰性子集（`slice(0, 500)`），仅补注释与具名常量。
- **已完成（2026-09-28）列表字段裁剪 + 正文延迟加载**：
  - 新增 `src/models/utils/noteProjection.js`：`NOTE_SUMMARY_FIELDS` 轻量白名单（**不含 content**）、
    `toNoteSummary(note)`（只读白名单字段 + metadata，全程不访问 content；hasContent/contentLength
    由 metadata 派生，未知时为 null 而非误判；非枚举 loadContent() 惰性兜底）、
    `materializeNoteSummaries(results, { skip, limit })`（复用 materializePage，先取页再投影）、
    `loadNoteContent(realm, noteId)`（详情页按 id 单读正文）。
  - `src/models/Note.js`：抽出 `_queryUserResults` 共用过滤/排序；`findByUser` 契约不变；
    新增 `findByUserSummaries(realm, userId, options)`。
  - `src/services/offline/getNotes.js` 新增 `getNoteSummariesFromOfflineStorage({ skip, limit })`；
    `src/services/api/notesApi.js` 新增显式入口 `getAllNotesSummaries({ skip, limit })`。
  - 测试：`src/models/__tests__/noteProjection.test.js`（10 万条伪 Results 只物化一页、content getter 零访问）。
- **已完成（2026-09-29）列表 UI 接线 + 预览元数据 + 增量索引**：
  - 预览元数据：新增 `src/models/utils/notePreview.js`（`buildNotePreview` 剥离 markdown + 截断 80 字 +
    `contentLength/hasContent/hasPages/hasStrokeData`；`mergePreviewMetadata` 增量合并）；
    `notesApi` 的 `createNote/updateNote/saveOfflineNote/importNote` 落库前打标
  - summary 增强：`toNoteSummary` 增加 `previewText/hasPages/hasStrokeData`（只读 metadata，绝不触碰大字段），
    `NOTE_SUMMARY_FIELDS` 补齐 19 个卡片渲染需要的小标量字段（仍不含 content/pages/strokeData）
  - UI 切换：新增 `src/screens/common/noteItemProjection.js` 让卡片同时兼容「完整对象」与「summary」；
    HomeScreen 的 `loadNotesListPayload` 优先取 `getAllNotesSummaries`，异常/空数组自动回退 `getAllNotes`；
    需要正文的路径（导航参数、导出 TXT）改为按 id 延迟加载（`resolveItemContent` + `notesApi.getById`）；
    排序不再用 `content?.length` 兜底
  - 存量数据：新增 `src/services/notes/backfillNotePreviewMetadata.js`（分批、幂等、可注入、带统计），
    并在「我的 → 离线数据」提供「补齐列表预览元数据」入口
  - 自愈：检测到未打标时本次回退全量渲染（不回归），同时后台幂等回填一次，成功后自动重载切回轻量路径
    （`createPreviewSelfHealController`：in-flight 去重 + 会话级尝试上限 + 防循环 + 卸载取消）
  - 笔记增量索引：新增 `src/services/search/noteIndexService.js`（`upsertNoteIndex/removeNoteIndex` + Safe 版本），
    `notesApi` 的创建/更新/离线保存/删除已接入，不再只依赖手动「重建搜索索引」
- **仍待完成**：
  - 部分「直写 Realm」的入口（CardNoteScreen / SaveButton / PDFViewerNative / notesSlice offlineNote 等）仍未打标；
    新写入的这类笔记会由首页自愈在下次启动补齐（会话内额度 1 次，属刻意防循环取舍）
  - 列表分页 + Realm 侧排序：当前轻量列表一次性取该用户全部 summary，排序仍在 JS 侧；
    10 万条下的首屏/FPS/内存真机基线仍未产出
- **验收**：
  - 首屏 P95、滚动 FPS、JS Heap 峰值达标（真机 10 万条基线仍未产出）

### 5.2 列表主链缺陷修复（2026-09-28，已在设备复验通过）
- **发现**：`getNotesFromOfflineStorage()` 用 `Array.isArray` 判定 Realm Results，
  导致真实设备上必然回落到「最近导入」分支并被静默截断到最多 20 条；
  且返回 Results（非 Array）会让 `notesSlice.fetchNotes` 的 `Array.isArray(action.payload.data)`
  判定失败，把 Results 包成 `[Results]` 后再被 `note.id || note._id` 过滤成空数组；
  同时查询缺少 `user_id` 隔离。
- **修复**：`isResultsLike`（length:number + slice:function，兼容真 Array）替代误判；
  查询下推 `is_deleted = false AND user_id == $0`；`data` 经 `materializePage` 返回**真 Array**；
  支持 `{ skip, limit }` 且未传时不静默截断；原有测试 mock 改为「类 Realm Results」以覆盖真实形态。
- **设备复验暴露的第二层缺陷（同轮修复）**：修复上述契约后，在平板尺寸 Android 14 模拟器上
  新建笔记并「保存」，应用提示「保存成功」，但**强制停止重启后首页仍为空**。
  用设备内临时诊断拿到决定性证据：`Note total = 3`，三条 `user_id` 全为 **null**，
  `filtered count = 0`（`userId = dev-account-001`）。
  - 根因 1：运行时 schema 是 `src/services/database/realmModels.js` 的 `user_id: 'string?'`（可空），
    而 `src/models/Note.js` 里声明的是非空 string——两者不一致；仅匹配空串不足以覆盖 null。
  - 根因 2：`src/screens/note/pagedNoteHelpers.js` 的 `buildPagedNoteRecord` 硬编码
    `user_id: 'current_user'` 哨兵，既不等于任何真实账号也不被读取侧识别。
  - 修复：读取谓词统一为 `(user_id == 当前用户 OR user_id == nil OR user_id == "")`
    （`getNotes.js` 与 `Note._queryUserResults/findDeleted/findArchived/findFavorites`）；
    `buildPagedNoteRecord` 去掉哨兵，owner 由调用方 `resolveLocalOwnerId()` 注入；
    写入侧（`notesApi.createNote/updateNote/saveOfflineNote`）在 owner 缺失/为空/null 时回填。
- **证据**：
  - 单测（先 RED 后 GREEN）：`src/services/offline/__tests__/getNotes.test.js`（25 条不截断、
    `Array.isArray(data)`、跨账号不可见、空串与 null owner 可见、10 万条只 slice 一页且 content 零访问）、
    `src/models/__tests__/noteProjection.test.js`、`src/services/api/__tests__/notesApi.test.js`、
    `src/screens/note/__tests__/pagedNoteHelpers.test.js`；
    修复前 `3 suites failed / 7 tests failed`，修复后全绿。
  - 设备：`emulator-5554` / Android 14 / 2560x1600；冷启动（清空 RN 缓存 bundle 后重启）
    日志 `从离线存储获取到笔记数量: 3`，首页渲染 `round67persist`、`round67listfix`、`round66no`
    三张卡片且不再出现空态；证据 `.local/android-evidence/round67_final_home.{xml,png}`、
    `round67_owner_diagnosis.log`。

---

## 建议的后续实施顺序（不偏离既定里程碑）
1. 为笔记列表补「正文预览字段」，把 HomeScreen 列表切到 `getAllNotesSummaries` + `loadNoteContent`
   （里程碑 5.1 的最后一段接线）。
2. 用 `createRetryController` 真实包裹同步单条操作重放；Realm Sync 启用后接入 Client Reset 回调。
3. 补齐 10 万条真机性能基线（首屏 P95 / FPS / JS Heap）与 500MB 附件真机量化（内存峰值、断网恢复、缓存配额）。
4. 最后完成 Realm App 控制台配置联调（2.1）与灰度策略。

## 2026-09-28 进展补充
- 里程碑 2.3：新增 `syncErrorRecovery.js`（错误分类 / 指数退避 / 可取消重试 / Client Reset 备份恢复），
  `syncManager` 最小接线；`51 passed`。真实 Client Reset 回调与单条操作重试接线待里程碑 2.1 解锁。
- 里程碑 4.2：补齐 `cacheLruIndex.js` 与 `downloadCacheService` 的可配置配额、预留余量、完整性校验、
  分段写入与统计/清理接口；`src/services/files` 合计 `34 passed`。
- 里程碑 5.1：新增列表字段裁剪（`noteProjection.js` + `Note.findByUserSummaries`）与
  `getAllNotesSummaries({ skip, limit })` 入口；`src/models` 合计 `62 passed`。
- 里程碑 5.2：修复 `getNotesFromOfflineStorage` 的 Results 契约缺陷（静默截断到 20 条、
  Redux 列表恒为空）并补 `user_id` 隔离；随后由设备复验继续暴露并修复了两层归属缺陷
  （空串 owner、null owner + `'current_user'` 哨兵）；`src/services/offline + src/services/api
  + src/models + src/screens/note` 定向合计 `117 passed`。
- 门禁：全量 Jest `57/57 suites、441/441 tests`（基线 54/332）退出码 0；
  `eslint .` 为 `0 errors / 1204 warnings`（基线 1205，无新增）退出码 0；
  `CI=1` 开发态 bundle 成功（37,482,043 bytes、48 assets）。
- 设备复验（已通过）：平板尺寸 Android 14 模拟器 `emulator-5554` / 2560x1600，
  冷启动命中 `screen.home`，`从离线存储获取到笔记数量: 3`，首页渲染三张笔记卡片；
  证据 `.local/android-evidence/round67_final_home.{xml,png}`。10 万条性能基线与 500MB 附件仍未产出。

## 2026-09-29 进展补充（规划项收口轮）
- 里程碑 2.3 真实接线：单条操作由 `createRetryController` 包裹、新增 `cancelPendingRetries()`；
  Client Reset 备份复用 `realmBackupService.backupRealmFile` 并加同会话去重；`src/services/sync` `66 passed`。
- 里程碑 4.2 完整性接线：`cacheSaveMetadata` + `FileViewerScreen` 传入可得 sha256/期望大小；
  `CACHE_CONFIG` + `resolveCacheDefaults/setCacheQuota`；不再把 `contentLength`（字符数）当字节数；
  `src/services/files + src/screens/common` `56 passed`。
- 里程碑 5.1 收口：预览元数据（`notePreview`）、summary 增强（`previewText/hasPages/hasStrokeData` +
  19 个卡片字段）、UI 切换（`getAllNotesSummaries` + 自动回退 + 正文按 id 延迟加载）、
  存量回填（`backfillNotePreviewMetadata` + 设置页入口）、未打标自愈（`createPreviewSelfHealController`）、
  笔记增量索引（`noteIndexService`）。
- 里程碑 5.1 验收门禁：新增 `src/tests/perf/listMaterializationBudget.test.js`（34 例），
  对 10 万条伪 Results 断言各列表入口「只物化一页」，并附基线表与真机量化步骤说明（`src/tests/perf/README.md`）。
- 风险收口：`RISK-SCHEMA-001` 已通过统一 `user_id` 可空声明解决（`src/models/Note.js` 与
  `src/services/database/realmModels.js` 一致，运行时本就是 `string?`，无需迁移）。
- 门禁：全量 Jest `68/68 suites、578/578 tests`（本轮起点 57/441）退出码 0；
  `eslint .` 为 `0 errors / 1204 warnings` 退出码 0；`CI=1` 开发态 bundle 成功（37,552,785 bytes、48 assets）。
- 设备复验（已通过，平板尺寸 Android 14 模拟器 `emulator-5554` / 2560x1600）：
  1. 自愈链路：`3/3 条笔记缺少预览元数据（未打标）` → 本次回退全量渲染（`从离线存储获取到笔记数量: 3`）
     → `[previewSelfHeal] 回填完成：更新 3 条，触发一次列表重载` → `使用轻量 summary 列表，条数: 3`（`source: 'summary'`）。
  2. 已打标后的冷启动直接走轻量路径，无未打标回退、无 LogBox 遮罩（`Console Warning` 命中数 0）。
  3. 从轻量列表点击笔记可正常进入 `screen.pagedCanvas` 并显示标题（验证正文延迟加载/按 id 打开路径）。
  证据 `.local/android-evidence/round68_*.{xml,png}`。
- 仍未闭环（需外部条件，非本机可完成）：Realm App/JWT/Flexible Sync 真实配置与双设备冲突、
  真实 Mongo/对象存储的 500MB 附件验收、10 万条真机首屏 P95/FPS/JS Heap 基线、Windows 平板真机复验。
