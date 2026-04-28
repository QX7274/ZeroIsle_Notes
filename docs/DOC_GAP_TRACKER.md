# 文档缺口跟踪表（DOC_GAP_TRACKER）

> 目的：集中管理“未完成 / 待优化 / 待对齐”事项，作为文档与实施计划的统一入口。  
> 范围：`PENDING_WORK_GUIDE.md`、`module-status/*`、`optimization-docs/*`、`archive/模块核查方案/*`。

## 1. 使用规则
- 状态：`NOT_STARTED` / `IN_PROGRESS` / `BLOCKED` / `DONE`
- 优先级：`P0`（阻塞）/ `P1`（核心）/ `P2`（优化）
- 每条必须包含：负责人、验收标准、来源文档
- 每周至少更新一次（建议周一）

---

## 2. 当前缺口总览（第一版）

| ID | 模块 | 问题描述 | 类型 | 优先级 | 状态 | 负责人 | 截止日期 | 验收标准 | 来源 |
|---|---|---|---|---|---|---|---|---|---|
| GAP-001 | Device Sync | Realm App ID、JWT验签、Flexible Sync 权限规则未完成生产级联调 | 未完成 | P0 | IN_PROGRESS | 后端负责人（待指定） | 2026-03-04 | 同账号双设备离线编辑后可同步；不同账号数据隔离 | `PENDING_WORK_GUIDE.md` 13-28 |
| GAP-002 | 数据模型对齐 | `user_id` 与 `ownerId` 口径未统一，订阅条件存在一致性风险 | 缺陷/未对齐 | P0 | IN_PROGRESS | 后端负责人（待指定） | 2026-03-05 | 字段命名与订阅条件全链路统一并通过联调 | `PENDING_WORK_GUIDE.md` 29-38 |
| GAP-003 | Sync可靠性 | Sync 错误分类、重试策略、Client Reset 恢复流程未补齐 | 未完成 | P0 | NOT_STARTED | 后端负责人（待指定） | 2026-03-07 | 弱网/断网/后台切换压力场景恢复率≥95% | `PENDING_WORK_GUIDE.md` 39-47 |
| GAP-004 | 冲突审计 | `updateNote` 冲突检测接线与 `SyncInfo` 审计未完整落地 | 未完成 | P1 | NOT_STARTED | 后端负责人（待指定） | 2026-03-11 | 并发冲突可审计到 entity/device/clientOpId | `PENDING_WORK_GUIDE.md` 52-60 |
| GAP-005 | 设备标识 | `deviceId` 稳定来源服务未落地（不可依赖入参） | 未完成 | P1 | NOT_STARTED | 客户端负责人（待指定） | 2026-03-10 | create/update/offlineQueue/syncInfo 全部使用持久化 deviceId | `PENDING_WORK_GUIDE.md` 61-66 |
| GAP-006 | 离线幂等 | OfflineQueue `clientOpId` 幂等重放与失败阈值策略未完成 | 未完成 | P1 | NOT_STARTED | 后端负责人（待指定） | 2026-03-12 | 重放无重复写；失败可追踪并可提示 | `PENDING_WORK_GUIDE.md` 67-73 |
| GAP-007 | 大附件上传 | 上传链路不完整，缺少分片/断点续传与服务端最小能力约束 | 未完成 | P1 | NOT_STARTED | 后端+客户端联合负责人（待指定） | 2026-03-16 | 500MB断网3次可恢复完成，成功率≥99% | `PENDING_WORK_GUIDE.md` 76-101 |
| GAP-008 | 缓存与LRU | 下载缓存、完整性校验、容量控制与LRU清理未形成闭环 | 未完成 | P2 | NOT_STARTED | 客户端负责人（待指定） | 2026-03-18 | 缓存上限可配置且清理后不超阈值 | `PENDING_WORK_GUIDE.md` 82-101 |
| GAP-009 | 查询性能 | 10万笔场景中全量 materialize 风险路径待排查与整改 | 待优化 | P1 | NOT_STARTED | 客户端负责人（待指定） | 2026-03-14 | 首屏/滚动/堆内存指标达标并可复现 | `PENDING_WORK_GUIDE.md` 104-114 |
| GAP-010 | 手写识别 | 手写识别功能状态仍为未实现（0%） | 未实现 | P1 | NOT_STARTED | 移动端负责人（待指定） | 2026-03-21 | iOS/Android能力、接口、UI链路可用 | `module-status/README.md` 44-46,108-113 |
| GAP-011 | Android OCR | Android OCR 未实现，平台能力不对齐 | 未实现 | P1 | NOT_STARTED | Android负责人（待指定） | 2026-03-20 | Android OCR 端到端可用并通过回归 | `module-status/README.md` 48,114-119 |
| GAP-012 | 知识图谱 | 知识图谱仅规划阶段，文档与实现差距较大 | 未实现/规划中 | P2 | NOT_STARTED | 架构负责人（待指定） | 2026-03-24 | 明确最小可交付版本与里程碑完成标准 | `module-status/README.md` 49-50,120-125 |
| GAP-013 | 文档一致性 | `module-status` 与 `optimization-docs` 的完成度口径需统一 | 待优化 | P1 | IN_PROGRESS | 文档负责人（待指定） | 2026-03-08 | 同一模块在各文档中状态一致、可追溯 | `module-status/README.md`, `optimization-docs/README.md` |
| GAP-014 | 历史核查转办 | `archive/模块核查方案` 大量“未实现/缺陷”尚未统一转办到活文档 | 待治理 | P1 | IN_PROGRESS | 文档负责人（待指定） | 2026-03-09 | 每个历史缺口均映射到当前执行任务ID | `archive/模块核查方案/*.md` |

---

## 3. 详细执行计划列表（先规划后实施）

### 3.1 执行批次与顺序
- **批次A（P0阻塞）**：GAP-001, GAP-002, GAP-003
- **批次B（P1核心链路）**：GAP-004, GAP-005, GAP-006, GAP-007, GAP-009
- **批次C（能力补齐）**：GAP-010, GAP-011
- **批次D（治理与对齐）**：GAP-012, GAP-013, GAP-014

### 3.2 每项任务详细计划
| GAP-ID | 详细操作清单 | 交付物 | 验证方式 | 依赖 |
|---|---|---|---|---|
| GAP-001 | 1) 确认 Realm App ID 注入方式；2) 定义 JWT 验签参数（RS256/JWKS/过期续期）；3) 完成 Flexible Sync 规则清单 | 配置矩阵、联调记录 | 双设备同账号同步 + 双账号隔离测试 | Realm 控制台权限、后端JWT配置 |
| GAP-002 | 1) 选定统一字段（ownerId或user_id）；2) 统一写入入口；3) 统一订阅条件与服务端规则 | 字段口径说明、映射表 | 抽样检查 create/update/subscription 全链路 | GAP-001 |
| GAP-003 | 1) 建立错误分类；2) 实现指数退避与可取消重试；3) 制定 Client Reset 备份恢复流程 | 错误码与恢复流程文档 | 弱网/断网/切后台压测200次 | GAP-001 |
| GAP-004 | 1) 在 updateNote 接线冲突检测；2) 写入 SyncInfo conflict 记录；3) 附件删除优先策略审计 | 冲突审计说明、示例记录 | 双端并发冲突可查询到审计日志 | GAP-002, GAP-003 |
| GAP-005 | 1) 设计 deviceIdentityService；2) 首次生成+持久化；3) 接入 create/update/offlineQueue/syncInfo | 设备ID服务说明 | 四类写入均能读取稳定deviceId | GAP-002 |
| GAP-006 | 1) 离线入队统一clientOpId；2) 重放幂等去重；3) 失败阈值与告警 | 幂等策略说明 | 重放场景无重复写，失败可观测 | GAP-005 |
| GAP-007 | 1) 定义 UploadSession schema；2) 分片上传与断点续传；3) 服务端最小接口能力确认 | 大附件方案文档与接口清单 | 500MB断网3次可恢复，成功率>=99% | GAP-003 |
| GAP-008 | 1) downloadCacheService；2) LRUIndex；3) 配额和完整性校验 | 缓存策略文档 | 缓存触发清理后容量不超阈值 | GAP-007 |
| GAP-009 | 1) 排查全量materialize路径；2) 分页前置；3) 轻量字段与延迟加载 | 查询优化清单 | 首屏P95/FPS/Heap指标达标 | GAP-003 |
| GAP-010 | 1) 梳理iOS/Android手写识别差距；2) 完成端到端链路定义；3) 补齐状态文档 | 手写识别实施计划 | 关键流程可演示、可回归 | GAP-013 |
| GAP-011 | 1) Android OCR能力缺口拆解；2) 对齐iOS体验与接口；3) 回归计划 | Android OCR实施计划 | Android端OCR可用并通过回归 | GAP-013 |
| GAP-012 | 1) 知识图谱最小可交付范围定义；2) 里程碑拆解；3) 风险与依赖登记 | 知识图谱里程碑计划 | 里程碑具备可验收标准 | GAP-014 |
| GAP-013 | 1) 统一完成度口径；2) 回写 module-status 与 optimization-docs；3) 建立版本更新规则 | 口径一致性说明 | 同模块状态在多文档一致 | 无 |
| GAP-014 | 1) 建立 archive 历史文档映射；2) 为每项历史缺口绑定GAP-ID；3) 标记转办状态 | 历史转办映射表 | 抽查10篇文档均能追溯到GAP-ID | GAP-013 |

### 3.3 实施节奏（建议）
1. 第1周：完成批次A，输出阻塞项清零报告。
2. 第2周：完成批次B（优先GAP-004~006），并启动GAP-007方案评审。
3. 第3周：推进GAP-007~009并完成首轮性能与附件验证。
4. 第4周：完成批次C/D，收敛历史文档与状态口径。

---

## 4. 实施进度记录（执行时填写）
| 日期 | GAP-ID | 进展 | 风险 | 下一步 |
|---|---|---|---|---|
| 2026-02-26 | GAP-001~014 | 已完成详细计划列表 | 负责人/截止日期待指定 | 开始回写主文档映射 |

---

## 5. 更新记录
| 日期 | 更新人 | 变更说明 |
|---|---|---|
| 2026-02-26 | AI Assistant | 创建第一版缺口台账，完成核心文档初始入库 |
| 2026-02-26 | AI Assistant | 新增“详细执行计划列表”与“实施进度记录”模板 |

