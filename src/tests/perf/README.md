# 10 万条数据「列表物化预算」回归门禁（WS-K / RISK-PERF-002）

本目录是**本机可执行**的性能回归门禁与基线报告，用于把「10 万条数据下每个列表入口
只物化当前页」固化为可持续运行的断言，而不是一次性的手工验证。

> 说明：共享任务 B 原本要求把说明写到 `scripts/perf/README.md`，但本轮 write scope 仅为
> `src/tests/perf/`。任务描述明确允许「在 `src/tests/perf/` 内放 copy」，因此本文件即
> 该 README 的归档位置；`scripts/` 目录未做任何改动。

## 1. 如何运行

```bash
export PATH="/Users/apple/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin:$PATH"

# 只跑本门禁
node node_modules/jest/bin/jest.js src/tests/perf --runInBand --watch=false

# lint
node node_modules/eslint/bin/eslint.js src/tests/perf
```

- 测试文件：`src/tests/perf/listMaterializationBudget.test.js`
- 同时也可作为默认 Jest suite 的一部分运行（文件名以 `.test.js` 结尾，未被 testPathIgnorePatterns 排除）。
- 测试结束时会用 `console.info` 打印一张「入口 → 实测物化条数 → 预算」的汇总表，
  可直接粘贴进验收记录；下面的基线表就是一次真实运行的结果。

## 2. 度量方式（为什么是确定性的）

复用仓库既有 helper `src/models/__tests__/helpers/countingResults.cjs` 构造伪 Realm Results：

- `filtered()` / `sorted()` / `slice()` 全部保持惰性，不累加；
- 只有真正**读取**（`Array.from` / `for...of` / `Symbol.iterator`）才会累加 `stats.materialized`。

因此断言全部基于 `stats.materialized` 与返回值形态（数组 / 惰性 Results），
**不包含任何耗时断言**，不会因为机器快慢而 flaky。

门禁灵敏度由「对照用例」保证：同一份 10 万条数据上，
历史写法 `Array.from(results).slice(50000, 50020)` 会被记为 **materialized = 100000**，
而分页路径只记 **20**。任何入口一旦回退为整表物化，`materialized === limit` 的断言会立刻失败。

## 3. 覆盖清单

### 3.1 任务要求的入口（全部覆盖）

| 入口 | 10 万条下的实测物化条数 | 预算 |
| --- | --- | --- |
| `Note.findByUser` | 20 | `limit` |
| `Note.findByUserSummaries` | 10 | `limit` |
| `Note.search` | 15 | `limit` |
| `Note.findDeleted` | 5 | `limit` |
| `Note.findArchived` | 10 | `limit` |
| `Note.findFavorites` | 12 | `limit` |
| `AIChat.search`（首页） | 200 | `DEFAULT_FILTER_WINDOW` |
| `AIChat.search`（skip 500 / limit 10） | 600 | `ceil((skip+limit)/200)*200` |
| `MindMap.findSharedWithUser` | 200 | `DEFAULT_FILTER_WINDOW` |
| `InfiniteCanvas.findSharedWithUser` | 200 | `DEFAULT_FILTER_WINDOW` |
| `KnowledgeGraph.findSharedWithUser` | 200 | `DEFAULT_FILTER_WINDOW` |
| `MindMap.findSharedWithUser`（skip 1000 / limit 20） | 1200 | `ceil((skip+limit)/200)*200` |
| `SearchIndex.textSearch`（惰性 slice 后消费当前页） | 20 | `limit` |
| `SearchIndex.vectorSearch` | 500 | `VECTOR_SCAN_LIMIT`（源码常量 500） |
| `SearchIndex.findByUser`（惰性 slice 后消费当前页） | 30 | `limit` |
| `realmService.objects` | 20 | `limit` |
| `realmService.find` | 10 | `limit` |

### 3.2 既有契约（未分页）与已知全量点

| 场景 | 实测物化条数 | 说明 |
| --- | --- | --- |
| `Note.findByUser`（未分页） | 0 | 返回惰性 Results，契约不变 |
| `AIChat.search`（未分页） | 100000 | 契约要求返回全部命中，属已知全量点 |
| `MindMap.findSharedWithUser`（未分页） | 20000 | 同上（20000 条命中，已知全量点） |
| `realmService.objects`（未分页） | 100000 | 契约要求返回完整普通对象数组（已知全量点） |

### 3.3 扩展覆盖（同构分页入口）

额外用数据驱动方式覆盖了 12 个同类 `findByUser` 分页入口，10 万条下
`{ skip: 40000, limit: 25 }` 消费当前页后均只物化 **25** 条：

`AIChat` / `MindMap` / `InfiniteCanvas` / `KnowledgeNode` / `KnowledgeEdge` /
`SearchIndex` / `Tag` / `File` / `Reminder` / `Category` / `SearchHistory` / `SyncInfo`。

其中 `KnowledgeEdge.findByUser`、`KnowledgeNode.findByUser`、`SearchIndex.findByUser`、
`SearchIndex.textSearch` 分页后返回的是**惰性 Results 子集**（slice 前置），
测试通过 `consumePage()` 显式消费当前页后再断言物化条数。

## 4. 本机能证明什么 / 不能证明什么

**能证明（本机、确定性）**

- 上述列表入口在 `{ skip, limit }` 分页下，应用层物化条数与页大小 / 窗口上界一致，
  与总行数（10 万）无关；
- JS 谓词路径（`AIChat.search`、`findSharedWithUser`）按 `DEFAULT_FILTER_WINDOW` 有界窗口扫描，
  深分页的扫描量按 `ceil((skip+limit)/窗口)*窗口` 增长；
- 查询条件（user_id / is_deleted / is_archived / is_favorite / title CONTAINS / shared_with CONTAINS）
  仍然下推到伪 Results 的 `filtered()`，没有被挪到 JS 全表过滤；
- 未分页的既有契约没有被破坏（`Note.findByUser` 仍返回惰性 Results）。

**不能证明（需要真机 / 后端，本轮不做）**

- 真机首屏时间（P95）、滚动 FPS / jank、JS Heap 峰值与回落；
- 500MB 上传速率、重试与内存表现；
- 真实 Realm 引擎的磁盘 I/O、索引命中与后台同步线程行为——
  伪 Results 度量的是「应用层物化条数」，不是磁盘读取量。helper 的 `sorted()` 内部会做一次
  JS 数组拷贝（不计入 `materialized`），真实 Realm 的 `sorted()` 是惰性下推，二者在这一步不完全等价。

## 5. 真机量化建议步骤（供后续在 Windows 平板执行）

### 5.1 数据准备（10 万条 + 500MB 上传样本）

1. 构造 10 万条笔记：每条约 1–3KB 正文，10% 带 1MB 附件（≈ 500MB 可上传样本）；
2. 通过调试入口或一次性 bulk 落库脚本写入（禁止在正式环境执行）；也可从后端导出一份
   10 万条的 Realm 文件直接拷入设备；
3. 记录基线：`realm.objects('Note').length`、`realm.objects('File').length`、磁盘占用。

### 5.2 首屏 P95

1. 在列表首屏 `onLayout` / `InteractionManager.runAfterInteractions` 回调打点
   `home_first_render_ms`（从 `AppState` 变为 active 或导航进入开始计时）；
2. 冷启动重复 **20 次**，去掉首次（缓存未热），统计 P50 / P95；
3. 验收线建议：P95 ≤ 1.5s（按产品目标调整），且不随笔记数增长而恶化。

### 5.3 滚动 FPS / jank

1. Android（含 Windows 平板 Android 子系统）：`adb shell dumpsys gfxinfo <包名> reset` →
   固定滚动 10 屏（每屏 20 条，快速 fling 到第 20000 条附近）→
   `adb shell dumpsys gfxinfo <包名> framestats`；
2. 统计 janky frames 比例与 P95 frame time；验收线建议：janky ≤ 5%，P95 frame time ≤ 16.7ms；
3. 记录滚动到第 5 万、10 万条附近是否出现持续掉帧（验证外层是否退化为整表派生）。

### 5.4 JS Heap 采样

1. Dev Menu → Perf Monitor 读取 JS Heap；同时 `adb shell dumpsys meminfo <包名>` 记录 Native/Java Heap；
2. 采样点：首屏稳定后 / 滚动到 5 万条后 / 滚动到 10 万条后 / 返回顶部并 GC 后；
3. 验收线建议：JS Heap 峰值 ≤ 150MB，且滚动过程中**不随已浏览条数线性增长**；
4. Hermes 可用 `--trace-gc` 复核是否出现高频 major GC。

### 5.5 500MB 上传速率

1. 使用 5.1 的 500MB 分片样本，按生产分片大小上传；
2. 记录：平均吞吐（MB/s）、P95 单分片耗时、失败重试次数；
3. 上传期间并行 `dumpsys meminfo` 采样，确认 JS Heap 不随分片累积而增长（分片应及时释放）。

## 6. 未纳入本轮的入口（TODO）

1. **真机指标**：首屏 P95 / 滚动 FPS / JS Heap / 500MB 上传速率（见第 4、5 节），需要真机与后端；
2. **只传 limit（无 skip）的入口**：如 `MindMap.findRecent`、`SearchHistory.findRecent`、
   `OfflineQueue.*`，契约同为 `materializePage(results, { limit })`，已被核心入口覆盖；
   如需逐入口断言，可追加到测试文件「扩展覆盖」段落；
3. **服务层其它列表查询**：`src/services/**` 中除 `realmService.objects` / `realmService.find`
   之外的查询（如云同步分页），本轮未逐一构造 10 万条假 Results。

## 7. 维护提示

- 若上游调整 `DEFAULT_FILTER_WINDOW`，测试直接引用导出常量，断言与报表会自动跟随；
- `SearchIndex` 的 `VECTOR_SCAN_LIMIT` 未导出，测试内以同名常量镜像（500），
  若源码调整需同步测试内常量；
- 若某入口新增/修改分页实现，请同时更新本 README 的覆盖清单与基线表。
