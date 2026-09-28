# dev 性能基线工具（WS-R / 10 万条笔记首屏验收）

本目录提供 **仅 dev 可用** 的 10 万条笔记造数 / 清理能力，配合首屏计时埋点，
让「10 万条笔记首屏 / 滚动 / 内存」这项一直未产出的 P0 验收项可以在模拟器 / 真机上复现。

## 1. 组成

| 文件 | 作用 |
| --- | --- |
| `perfSeedService.js` | `seedPerfNotes`（分批造 10 万条）/ `clearPerfNotes`（只删自己造的数据） |
| `src/screens/settings/OfflineDataScreen.js` | 设置 → 离线数据 页的两个入口（仅 dev 显示），带二次确认与进度/结果 |
| `src/App.js` | 模块加载时写入 `global.__APP_START_TS__`（dev 打印一行） |
| `src/screens/common/HomeScreen.js` | 首屏数据就绪 + 完成一次渲染调度后打印一次 `[PERF] 首屏就绪` |

安全约束：两个服务在非 `__DEV__` 环境调用会**直接抛错**，不会进生产包行为；
`clearPerfNotes` 只匹配 `title` 以 `[PERF]` 开头 **或** `_id` 以 `perf-fixture-` 开头的记录，
绝不误删用户笔记。

## 2. 一次采集的完整步骤

### 2.1 造数

1. 用 dev 构建启动应用，进入 **设置 → 离线数据**；
2. 点「生成性能测试数据（10 万条）」→ 弹窗确认「生成」；
3. 等待进度条刷新（每 10 批刷新一次），完成后提示：
   `新增 100000 条，跳过 0 条，失败 0 条，共 100 批，用时 ...`；
4. 幂等：重复点击不会重复造数（`created=0, skipped=100000`）。

> 期望：100 批 × 1000 条 = 100000 条；单批写入不超过 1000 条。

### 2.2 首屏计时（P95）

1. 杀进程后从首页冷启动，抓日志：
   ```bash
   adb logcat -s ReactNativeJS:V | grep "\[PERF\] 首屏就绪"
   ```
   （模拟器调试时 Metro 终端同样会打印这一行。）
2. 期望日志：
   ```
   [PERF] 首屏就绪 ms=<n> source=summary-page count=50
   ```
   - `source=summary-page`：走的是轻量 summary 首页（分页第一页 50 条）；
   - `source=fallback`：走了全量回退路径（通常是存量笔记未打标）。先执行一次
     「补齐列表预览元数据」，再复测；
   - `ms` 从 `global.__APP_START_TS__`（App 模块加载）算起；
   - 每个应用会话只打印一次，不会重渲染刷屏。
3. 冷启动重复 **20 次**，记录 `ms`，去掉首次（缓存未热）后取 P50 / P95；
   验收线建议 P95 ≤ 1.5s，且不随笔记数增长而恶化。

### 2.3 滚动 FPS / jank

```bash
adb shell dumpsys gfxinfo <包名> reset
# 在应用里固定滚动 10 屏（每屏 20 条，快速 fling 到第 20000 条附近）
adb shell dumpsys gfxinfo <包名> framestats
```
统计 janky frames 比例与 P95 frame time；验收线建议 janky ≤ 5%、P95 ≤ 16.7ms。

### 2.4 内存 / JS Heap

```bash
adb shell dumpsys meminfo <包名>
```
JS Heap 另用 Dev Menu → **Perf Monitor** 读取。采样点：
首屏稳定后 / 滚动到 5 万条后 / 滚动到 10 万条后 / 返回顶部并 GC 后。
验收线建议：JS Heap 峰值 ≤ 150MB，且滚动过程中不随已浏览条数线性增长。

### 2.5 清理

设置 → 离线数据 → 「清除性能测试数据」→ 确认；完成后提示
`删除 100000 条，失败 0 条，共 100 批，用时 ...`，且用户笔记不受影响。
重复点击为幂等（`deleted=0`）。

## 3. 单测

```bash
export PATH="/Users/apple/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin:$PATH"
node node_modules/jest/bin/jest.js src/services/dev --runInBand --watch=false
```

覆盖：分批边界（count 非 batchSize 整数倍）、按批推进（单次 write / materialize 不超过 batchSize）、
幂等、单条失败不中断、只删自己造的数据、非法 realm 抛错、未注入 realm 时惰性取 realmService、
非 `__DEV__` 抛错。

## 4. 本机能证明 / 不能证明

- 能证明：造数与清理的**行为契约**（分批、幂等、只删标记数据、dev 守卫）；
- 不能证明：真机首屏 P95 / FPS / JS Heap —— 必须在设备上按上面步骤采集（本目录工具就是为这一步准备的）。
