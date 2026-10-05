# 工具栏功能补齐计划（2026-10-05）

目标：把工具栏中**未实现 / 被降级 / 静默失效**的功能真正做出来，不再用「诚实降级」兜底；
凡是「必须原生实现或原生性能明显更好」的，一律补原生。

---

## 一、侦察结论（逐文件核对，非推测）

### A. 文本工具：**两端都坏**（P0）
| 端 | 现状 | 证据 |
|---|---|---|
| Android 分页 | `insertText(String)` **只打一行 log**，什么也不做 | `NativePagedNoteView.java:1547-1549` |
| Android 无限 | `addTextElement(String)` 有实现 | `NativeInfiniteCanvasView.java:1487` |
| iOS 分页 | `insertText` 把 `{type:text,text,position,color}` 塞进 strokes，但 `appendStroke:` **只读 `points`**，text 条目被静默跳过 → **完全不渲染** | `NativePagedNoteView.m:671` / `appendStroke:` |
| iOS 无限 | 待确认（命令表无 addText/insertText） | `NativeInfiniteCanvasViewManager.m` |
| JS 桥 | `handleTextAdd` **只传 `[textConfig.text]`**，把 fontSize / color / style / alignment 全丢了 | `useNativeToolbarBridge.js:459-463` |

### B. 图片工具：iOS 分页同样不渲染（P0）
- Android 分页 / 无限：`addImage` 有真实实现（解码 → 转 Stroke → 入 strokes）
- iOS 分页：`addImage` 同样只把 `{type:image,uri}` 塞进 strokes，**appendStroke 不处理 → 不渲染**
- JS 桥只传 `uri`，丢掉 width / height / fileName

### C. 形状库：JS 14 种 vs 原生 7 种（P1）
- JS `ShapeToolSelector` 提供：rectangle / rounded_rect / circle / ellipse / triangle / line / arrow / double_arrow / star / pentagon / hexagon / diamond / heart / cloud / speech_bubble / callout
- 两端原生**只实现 7 种**：line / rectangle / circle / triangle / diamond / star / arrow
- **缺失**：parallelogram、ellipse、arc、polygon、curve、rounded_rect、pentagon、hexagon、heart、cloud、speech_bubble、callout、double_arrow
- **未知形状静默 fallback 成直线**（`else { 默认直线 }`）→ 用户选椭圆却画出直线，且无任何提示
- **`fill`（填充）完全未被原生消费**：JS 已传 `fill: shapeFillEnabled`，原生从未读取 → 形状永远只有描边

### D. PDF 标尺 / 网格：两端都没有（P1）
- Android `NativePDFView.java`：`ruler|Ruler|Grid` 命中 **0 处**
- iOS `NativePDFView.m`：**0 处**
- 工具栏在 PDF 模式下仍显示标尺/网格按钮，点了没有任何效果

### E. 取色器：Android 无原生模块（P1）
- iOS：`ios/ScreenUtils.m` 有完整实现（截图 + ColorPickerViewController + 放大镜）
- Android：**不存在 ScreenUtils**（`ZeroIsleNotesPackage` 未注册任何取色模块）→ 必须新写

### F. 套索选中笔迹的操作：原生完全没有能力（P1）
- 原生**会**上报 `onStrokesSelected`（`NativePagedNoteView.java:982-994`，含 strokeIds）
- 但两端都**没有** deleteSelected / copySelected / moveSelected 之类的方法（全仓 0 命中）
- 工具栏侧目前是 disabled + 「暂不支持」降级

### G. 命令名不统一（P1，导致「同一功能多处实现」）
- 分页 Android/iOS 用 `insertText`，无限 Android 用 `addTextElement`，JS 桥统一发 `addText`
- 三端命令表里 `addText` 这个名字**根本不存在** → `dispatchCommand` 静默返回 false
- 这正是「JS 以为发了、原生收不到」的同一类静默死接线，必须在分支 1 一并收口

### H. `fill` 字段在 JS 桥就被丢弃（P1）
- 工具栏已传 `onToolChange({type:'shape', shape, fill})`
- 但 `useNativeToolbarBridge.js` 里 `fill` **0 命中** → 配置归一化时被丢掉，原生永远收不到
- 所以即使原生实现了填充，也会因为字段在 JS 就没了而无效 —— 必须两处一起修

---

## 二、实施计划（按功能分支）

每条分支的流程：**开发 → 定向测试 → 全量门禁 → 合并 main → 推送 origin → 删除分支**。
提交信息一律中文详述。

### 分支 1：`feature/toolbar-text-image-native`（P0）
把文本与图片从「写进数据但不渲染」变成真正可见、可持久化、可导入导出。
- **Android 分页**：实现 `insertText(text, configJson)` —— 按 fontSize/color/style/alignment 构造文本笔迹并绘制；
  新增 `TextData` 类型（或扩展 `StrokeData`），在 `PageView.onDraw` 与 `drawText` 分支渲染。
- **iOS 分页**：重写渲染层 —— 不再只用一个 `CAShapeLayer` 画所有内容，
  改为「笔迹层 + 文本层 + 图片层」三类图层分别重建；`appendStroke:` 按 `type` 分派。
- **iOS 无限**：补 `addText` / `insertText` 命令与实现。
- **JS 桥**：`handleTextAdd` 传完整配置（JSON），`handleImageUpload` 传完整元数据；
  新增命令别名 `addText`/`insertText` 与三端对齐。
- **导入导出**：text/image 笔迹必须能 `exportNote`/`importNote` 往返。

### 分支 2：`feature/toolbar-shapes-full`（P1）
- 把 JS 与原生**统一到一份形状清单**（单一来源，避免再次漂移）。
- 两端补齐缺失形状：ellipse、parallelogram、polygon、arc、curve、rounded_rect、pentagon、hexagon、heart、cloud、speech_bubble、callout、double_arrow。
- **未知形状不再静默画直线**：改为「画不支持的形状时明确上报 + 在开发态告警」，杜绝静默错误。
- **实现 `fill` 填充**：原生读取 `fill` 字段，用 `Paint.Style.FILL_AND_STROKE`（Android）/ `fillColor`（iOS）。
- 形状预览与最终落笔必须一致（含填充）。

### 分支 3：`feature/pdf-ruler-grid`（P1）
- Android `NativePDFView`：新增标尺/网格覆盖层，读取 `setToolConfig` 的 `showRuler`/`showGrid`，在 PDF 面上绘制。
- iOS `NativePDFView`：同样补齐（可复用分页那套 Core Graphics 覆盖层实现）。
- 与分页/无限保持同样的刻度与视觉。

### 分支 4：`feature/android-eyedropper`（P1）
- 新建 Android `ScreenUtilsModule`：截取当前窗口 Bitmap（`PixelCopy`，性能优于 `drawViewHierarchy`）。
- 提供 `pickColor()` Promise 接口 + 取色浮层（放大镜 + 十字准星 + 实时色值）。
- 在 `ZeroIsleNotesPackage` 注册；`screenUtilsBridge.isPickColorAvailable()` 自动变为 true。
- 移除 ColorPicker 中 Android 的降级分支（能力探测保留，作为兜底）。

### 分支 5：`feature/lasso-selection-ops`（P1）
- **原生**：两端各补「选中笔迹操作」能力 —— delete / duplicate / 平移（move）选中笔迹，并支持撤销。
- 命令：`deleteSelectedStrokes`(strokeIds)、`duplicateSelectedStrokes`(strokeIds, dx, dy)、`moveSelectedStrokes`。
- **JS**：`useNativeToolbarBridge` 新增 `deleteSelectedStrokes` 等派发器；
  工具栏 `renderSelectedStrokesBar` 从「disabled 降级」改为**真实接通**；
  四个调用点（分页/无限/PDF/Markdown）注入真实 handler。
- 保留 3 秒后自动清除选中态的现状，但用户操作时立即生效。

---

## 三、验证口径
- **单测**：JS 侧接线一致性（按钮 → 命令载荷 → 命令名）用 Jest 锁定；
  原生侧补契约测试（源码级断言：命令表包含新命令、不存在静默 fallback）。
- **设备**：Android `emulator-5554`（2560x1600）+ iOS iPad Pro 13" 模拟器，
  用已有「临时取证入口」办法逐项截图取证（文本/图片/各形状/填充/PDF 标尺网格/取色/套索操作）。
- **门禁**：全量 Jest 不得回归；`eslint` 0 errors；iOS `xcodebuild` 与 Android `assembleDebug` 均须成功。

## 四、顺序与依赖
1. 先做**分支 1（文本/图片）**：它是「功能缺失」里最严重的一条，且会重构 iOS 渲染层，是后续分支的地基。
2. 再做**分支 2（形状全量+填充）**：同样依赖渲染层，但可与分支 1 并行（不同文件区域）。
3. **分支 3（PDF 覆盖层）**与**分支 4（Android 取色）**相互独立，可并行。
4. **分支 5（套索操作）**依赖原生渲染层（分支 1/2）先稳定，放最后。