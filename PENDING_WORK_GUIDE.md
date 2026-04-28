# 未完成任务清单与后续开发指导（Pending Work Guide）

本文档用于指导后续开发，聚焦两大范围：
- 数据同步一致性与稳定性（Realm + MongoDB Device Sync）
- 移动端性能与稳定性（10 万条笔记、500MB 附件）

> 说明：当前仓库已完成 Custom JWT 认证链路收敛、Sync Realm 打开路径与最小 Flexible Sync 订阅集接入、以及 Note 字段级合并的基础设施与部分落地。以下为**仍未完成/需补齐**的任务，按里程碑与优先级组织。

---

## 里程碑 2（Device Sync）未完成项

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

### 2.2 Subscriptions 与 ownerId/user_id 对齐
- **现状**：客户端订阅条件使用 `user_id == user.id`。
- **风险**：Realm user.id 不一定等于业务 user_id。
- **建议**：二选一并全链路对齐：
  - **方案 A**：以 Realm user.id 作为 user_id（后端 JWT `sub`=业务 user_id 也可，但需确保一致）
  - **方案 B**：以业务 user_id 作为 ownerId，JWT 中携带并在 Realm 中作为字段写入；订阅条件改为 ownerId
- **工作项**：
  - 统一字段命名：`user_id` vs `ownerId`
  - 在 create/update 写入入口强制写入 owner 字段

### 2.3 Sync 错误恢复与 Client Reset 策略
- **需要补齐**：
  - Sync Session 错误分类：网络/权限/会话过期/Client Reset
  - 重试策略（指数退避 + 上限 + 可取消）
  - Client Reset：备份 Realm 文件 + 引导恢复（避免数据丢失）
- **验收**：
  - 弱网/断网/切后台 200 次不崩溃
  - Sync 失败可自动恢复率 >= 95%

---

## 里程碑 3（字段级合并 Field-Level Merge）未完成项

> 任务映射：GAP-004 / GAP-005 / GAP-006（详见 `docs/DOC_GAP_TRACKER.md`）

### 3.1 冲突审计真正接线（SyncInfo/ConflictLog）
- **现状**：已存在冲突检测与 SyncInfo 写入方法雏形（EnhancedNoteService 内）。
- **待完成**：
  - 在 `updateNote` 中调用 `_detectMergeConflicts`，若有冲突写入 `SyncInfo(operation='conflict')`
  - 明确写入字段：`entity_id/entity_type/device_id/clientOpId/data(冲突摘要)`
  - 对 attachments 的“删除优先”策略落地与审计
- **验收**：
  - 并发场景（2 端）产生冲突时，SyncInfo 可查到对应记录

### 3.2 deviceId 稳定来源（不可依赖入参）
- **目标**：所有写入都有稳定 deviceId，用于幂等与冲突判定。
- **工作项**：
  - 新增 `deviceIdentityService`：首次生成并持久化（Keychain/StorageItem），后续复用
  - create/update/offlineQueue/syncInfo 均从该服务取 deviceId

### 3.3 幂等重放（OfflineQueue）策略
- **现状**：OfflineQueue schema 已补充 clientOpId/deviceId。
- **待完成**：
  - 离线队列写入统一携带 `clientOpId`
  - 重放时按 `clientOpId` 做幂等去重（避免重复写）
  - 失败记录 error + retry_count，达到阈值进入 failed 并提示

---

## 里程碑 4（500MB 大附件：模拟分片 + 断点续传 + 缓存/LRU + 非阻塞）未完成项（核心）

> 任务映射：GAP-007 / GAP-008（详见 `docs/DOC_GAP_TRACKER.md`）

### 4.1 现有附件链路缺口
- **现状**：FileUploader 调用的 upload 方法链路不完整；fileService 缺少真正的 uploadFile；无分片/续传。

### 4.2 需要新增的核心组件（建议最小集合）
- **UploadSession schema（Realm）**
  - 字段建议：sessionId/fileId/localPath/fileSize/chunkSize/uploadedBytes|uploadedParts/status/error/retryCount/updatedAt/deviceId/clientOpId
- **chunkedUploadService**
  - 负责：切片读取、分片上传、断点恢复、失败重试、后台续传
- **downloadCacheService + LRUIndex**
  - 负责：分段写入缓存、完整性校验、缓存配额与 LRU 清理
- **non-blocking I/O**
  - 分片读取/写入必须分批调度，避免一次性读入内存导致掉帧

### 4.3 对服务端的最小依赖（必须明确）
- 若服务端不支持 Range/标准分片：仍至少需要支持以下之一，否则“真正续传”无法成立：
  - **append/offset 上传接口**：sessionId + offset + bytes
  - 或 **chunkIndex 上传接口**：sessionId + chunkIndex + totalChunks
- 若当前后端完全无能力：需新增后端接口（单独任务 + 影响评估 + 回滚方案）。

### 4.4 验收指标（必须量化）
- 500MB 上传：断网 3 次仍可恢复完成，成功率 >= 99%
- 下载/预览：内存峰值不超过基线 + 150MB（分机型）
- 缓存：可配置上限（如 2GB），触发 LRU 清理后占用不超过阈值

---

## 性能专项（10 万条笔记）未完成项

> 任务映射：GAP-009（详见 `docs/DOC_GAP_TRACKER.md`）

### 5.1 Realm 查询与分页（避免全量 materialize）
- **风险点**：存在 Array.from 全量转换再 slice 的查询路径（需全局排查）。
- **待完成**：
  - 列表查询统一走 Results 层 slice（分页前置）
  - 列表字段裁剪（轻量字段 + 延迟加载正文）
  - 若需要搜索：建立本地索引或增量索引更新策略
- **验收**：
  - 首屏 P95、滚动 FPS、JS Heap 峰值达标

---

## 建议的后续实施顺序（不偏离既定里程碑）
1. 完成里程碑 3：冲突审计接线 + deviceId 服务 + offlineQueue 幂等
2. 进入里程碑 4：UploadSession + chunkedUploadService + cache/LRU
3. 并行补齐 10 万条性能基线与查询整改（只改相关查询路径）
4. 最后完成 Realm App 控制台配置联调与灰度策略

