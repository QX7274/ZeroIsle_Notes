# AI 工具 × 本地 OCR/手写识别 集成说明

## 目标

- 在点击任一 AI 工具（翻译/摘要/改写/解释/关键词/语法/简化等）时，如果没有选中文本，则允许用户框选区域进行本地 OCR，或对手写区域进行本地手写识别，获得文本后再交给 AI 工具处理。
- 不上传图片至云端（OCR/手写识别走本地引擎），AI 阶段基于得到的纯文本继续执行（保持现有 AI 能力不变）。

## 工具栏变更

文件：`src/components/common/AllInOneToolbar.js`

- 新增 props（由页面容器实现并传入）：
  - `onRequestRegionOCR?: () => Promise<string>`：触发矩形区域框选与本地 OCR，返回识别出的纯文本。
  - `onRequestStrokeRecognition?: (strokeIds?: string[]) => Promise<string>`：对选中/指定笔画进行本地手写识别，返回纯文本。

- 行为变更：
  - 之前：AI 工具必须先有 `selectedText`，否则提示“请先选择文本”。
  - 现在：若 `selectedText` 为空，则依次尝试：
    1) 调用 `onRequestRegionOCR()` 进行区域 OCR；
    2) 若仍无文本且提供 `onRequestStrokeRecognition()`，则尝试手写识别；
    3) 两者都失败/取消时，再提示用户进行选择或框选。

## 页面容器对接（Viewer/Canvas）

容器需实现如下能力并以回调形式传给工具栏：

### 1) 区域 OCR（onRequestRegionOCR）

建议流程：
1. 显示矩形框选 Overlay（独立于“套索”工具，避免冲突）。
2. 用户拖拽得到选区（世界/页面坐标）。
3. 内部将选区渲染为位图（本地内存渲染，用户无感截图）。
4. 调用本地 OCR 引擎识别得到纯文本；返回给工具栏。

本地 OCR 引擎建议：
- Android：ML Kit Text Recognition v2（支持中英文，离线模型可用）。
- iOS：Vision（VNRecognizeTextRequest，`zh-Hans`/`en-US`）。

可选预处理（提升本地OCR效果）：
- 自适应阈值二值化、对比度增强、去噪、旋转/透视校正（如需）。

### 2) 手写识别（onRequestStrokeRecognition）

建议流程：
1. 从当前页面取选中笔画的点序列（或通过参数传入 `strokeIds`）。
2. Android 使用 ML Kit Digital Ink（离线可用，不需要转图片）。
3. iOS 快速方案：将笔画快速栅格化为灰度图后用 Vision 识别；高精度可后续集成第三方（如 MyScript/Azure Ink）。
4. 返回识别文本给工具栏。

## 交互建议

- 用户点击任一 AI 工具：
  - 若已有 `selectedText`：直接处理；
  - 否则进入“框选模式”，完成后自动识别并继续 AI；
  - 识别完成后，支持“替换选区/插入光标/复制到剪贴板”。
- 提供取消/返回入口；识别失败时提示“请重新框选或改用手写识别”。

## 回调契约（Contract）

```
type OnRequestRegionOCR = () => Promise<string>;
type OnRequestStrokeRecognition = (strokeIds?: string[]) => Promise<string>;
```

- 返回值：应为去除多余空白的纯文本（若为空字符串或抛错，工具栏会提示用户重试/框选）。
- 超时建议：本地识别 > 8s 未返回可视为失败，请中断并给出可重试提示。

## 不使用云端的保证

- 区域位图仅在本地内存渲染与处理；
- OCR/手写识别优先且仅使用本地引擎；
- 工具栏仅向 AI 阶段传递纯文本，不上传图片。

> 如需在极端素材下开启“云端增强 OCR”兜底，可在设置中提供可选开关（默认关闭）。

## 错误处理与退让策略

- OCR/手写识别失败：提示用户重试或缩小/放大框选范围；
- 文本为空：提示“请先选中文本，或拖拽矩形区域进行识别”；
- 识别成功但质量差：允许用户先直接插入文本，再使用“改写/纠错”等 AI 工具二次清洗。

## 后续可选增强

- 语种/识别模式偏好设置（中文优先/英文优先/自动）；
- 版面结构分析（段落/表格/标题）；
- 手写公式（LaTeX）识别，输出渲染块；
- iOS 引入更强的手写 SDK；
- 框选历史与快速复用。




