# 工具栏完整实现指南

## 概述

本文档详细说明了 ZeroIsle Notes 应用中通用工具栏（`AllInOneToolbar`）的完整实现，包括如何在所有原生界面（无限画布、分页笔记、PDF查看器）中统一使用。

## 架构设计

### 三层架构

```
┌─────────────────────────────────────┐
│   AllInOneToolbar.js (UI层)         │
│   - 工具按钮                         │
│   - 颜色选择器                       │
│   - 笔触粗细控制                     │
│   - AI工具面板                       │
│   - 书签管理                         │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   useNativeToolbarBridge (桥接层)   │
│   - 统一命令分发                     │
│   - 状态管理                         │
│   - 工具配置转换                     │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   原生组件 (实现层)                  │
│   - NativeInfiniteCanvasView        │
│   - NativePagedNoteView             │
│   - NativePDFView                   │
└─────────────────────────────────────┘
```

## 已实现的工具

### 1. 绘图工具

#### 1.1 画笔 (Pen)
- **工具ID**: `pen`
- **原生实现**: ✅ 完整实现
- **特性**: 标准绘图工具，支持压感

#### 1.2 铅笔 (Pencil)
- **工具ID**: `pencil`
- **原生实现**: ✅ 完整实现
- **特性**: 类似画笔，但透明度略低

#### 1.3 刷子 (Brush)
- **工具ID**: `brush`
- **原生实现**: ✅ 完整实现
- **特性**: 更粗的笔触效果

#### 1.4 荧光笔 (Highlighter)
- **工具ID**: `highlighter`
- **原生实现**: ✅ 完整实现
- **特性**: 半透明效果，支持混合模式
- **配置参数**:
  - `opacity`: 透明度 (默认: 0.4)
  - `blendMode`: 混合模式 (默认: 'multiply')

#### 1.5 激光笔 (Laser)
- **工具ID**: `laser`
- **原生实现**: ✅ 完整实现
- **特性**: 临时标记，3秒后自动淡出
- **配置参数**:
  - `fadeOutDuration`: 淡出时长 (默认: 3000ms)
  - `animationSteps`: 动画帧数 (默认: 60)

### 2. 编辑工具

#### 2.1 橡皮擦 (Eraser)
- **工具ID**: `eraser`
- **原生实现**: ✅ 完整实现
- **特性**: 智能擦除，支持按笔迹擦除
- **配置参数**:
  - `mode`: 擦除模式 (默认: 'erase')

#### 2.2 套索选择 (Lasso)
- **工具ID**: `lasso`
- **原生实现**: ✅ 完整实现
- **特性**: 自由绘制选区，选择笔迹后可移动、复制、删除
- **配置参数**:
  - `mode`: 选择模式 (默认: 'select')
  - `allowMove`: 允许移动 (默认: true)
  - `allowCopy`: 允许复制 (默认: true)
  - `allowDelete`: 允许删除 (默认: true)

### 3. 形状工具

#### 3.1 形状 (Shape)
- **工具ID**: `shape`
- **原生实现**: ✅ 完整实现
- **支持的形状**:
  - `line`: 直线
  - `rectangle`: 矩形
  - `circle`: 圆形
  - `triangle`: 三角形
  - `diamond`: 菱形
  - `arrow`: 箭头
  - `star`: 五角星
  - `ellipse`: 椭圆
  - `parallelogram`: 平行四边形
  - `arc`: 弧形
  - `polygon`: 多边形
  - `curve`: 曲线
- **配置参数**:
  - `shape`: 形状类型 (必需)

### 4. 文本工具

#### 4.1 文本 (Text)
- **工具ID**: `text`
- **原生实现**: ✅ 完整实现
- **特性**: 点击位置弹出文本输入框，支持自定义样式
- **配置参数**:
  - `text`: 文本内容
  - `fontSize`: 字体大小
  - `color`: 文本颜色
  - `style`: 文本样式 (bold, italic, underline)
  - `alignment`: 对齐方式 (left, center, right)

### 5. AI工具

#### 5.1 区域OCR
- **功能**: 选择区域进行本地文本识别
- **原生实现**: ✅ 使用 Vision 框架实现
- **支持语言**: 中文、英文
- **使用方式**: 通过 `onRequestRegionOCR` 回调触发

#### 5.2 手写识别
- **功能**: 识别手写笔迹并转换为文本
- **原生实现**: ✅ 使用 Vision 框架实现
- **支持语言**: 中文简体、英文、数字、符号
- **识别范围**: 最近N笔笔迹（默认5笔）
- **使用方式**:
  - Promise方式: `NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, count)`
  - 回调方式: 通过 `onRequestStrokeRecognition` 回调触发
- **详细文档**: [手写识别功能使用指南](./handwriting-recognition-guide.md)

#### 5.3 AI文本处理
- **支持的操作**:
  - 翻译
  - 代码识别
  - 数学公式识别
  - 摘要生成
  - 关键词提取
  - 文本解释
  - 改写
  - 语法检查
  - 简化

### 6. 其他工具

#### 6.1 图片上传
- **功能**: 从相册选择图片并添加到画布
- **原生实现**: ✅ 完整实现
- **命令ID**: 
  - 分页笔记: 18
  - 无限画布: 15

#### 6.2 书签
- **功能**: 添加、查看、导航书签
- **实现层**: JavaScript层
- **特性**: 支持自定义标题和颜色

## 使用方法

### 在屏幕组件中使用工具栏

```javascript
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';

const MyCanvasScreen = ({ route, navigation }) => {
  const canvasViewRef = useRef(null);
  
  // 使用工具栏桥接 Hook
  const toolbarProps = useNativeToolbarBridge(canvasViewRef, 'infinite', {
    currentPage: 1,
    totalPages: 1,
  });
  
  return (
    <ViewerLayout
      toolbarProps={{
        ...toolbarProps,
        // 添加额外的回调
        onRequestRegionOCR: async () => {
          // 实现区域OCR逻辑
          return recognizedText;
        },
        onRequestStrokeRecognition: async () => {
          // 实现手写识别逻辑
          return recognizedText;
        },
      }}
    >
      <NativeInfiniteCanvasView
        ref={canvasViewRef}
        currentTool={toolbarProps.currentTool}
        currentColor={toolbarProps.currentColor}
        currentStrokeWidth={toolbarProps.currentStrokeWidth}
      />
    </ViewerLayout>
  );
};
```

### 工具配置传递

工具栏会自动将工具配置传递给原生组件：

```javascript
// 用户选择形状工具并选择"矩形"
onToolChange({ type: 'shape', shape: 'rectangle' })

// Hook 会自动：
// 1. 设置工具类型为 'shape'
// 2. 发送工具配置 { shape: 'rectangle' } 到原生层
```

## 数据持久化

### 当前实现状态

✅ **已修复**: 无限画布和分页笔记的数据持久化问题已解决

#### 修复内容

1. **无限画布** (`FluidInfiniteCanvasScreenNative.js`):
   - 修复了 `handleGoBack` 中的命令ID错误（从 '10' 改为 '3'）
   - 确保退出时正确保存数据

2. **分页笔记** (`SkiaPagedCanvasScreenNative.js`):
   - 统一了 `handleGoBack` 和 `handleGoBackWrapper` 的实现
   - 确保所有退出路径都会保存数据

#### 保存机制

- **自动保存**: 3秒防抖
- **失焦保存**: 屏幕失去焦点时
- **后台保存**: 应用进入后台时
- **退出保存**: 组件卸载或返回时
- **手动保存**: 点击保存按钮时

## 待实现功能

### 取色器 (Eyedropper)

- **状态**: ⚠️ 占位实现
- **当前行为**: 显示"功能待开发"提示
- **未来实现方向**:
  1. 调用原生模块进行屏幕截图
  2. 显示放大镜视图
  3. 获取选中像素的颜色值

## 命令ID映射表

### 分页笔记 (paged)

| 命令 | ID | 说明 |
|------|-----|------|
| recognizeHandwriting | 1 | 手写识别 |
| insertText | 2 | 插入文本 |
| exportNote | 3 | 导出笔记 |
| undo | 4 | 撤销 |
| redo | 5 | 重做 |
| clear | 6 | 清除 |
| setCurrentPage | 7 | 设置当前页 |
| setCurrentTool | 8 | 设置工具 |
| setCurrentColor | 9 | 设置颜色 |
| setCurrentStrokeWidth | 10 | 设置线宽 |
| addPage | 11 | 添加页面 |
| importNote | 12 | 导入笔记 |
| setToolConfig | 15 | 设置工具配置 |
| addImage | 18 | 添加图片 |

### 无限画布 (infinite)

| 命令 | ID | 说明 |
|------|-----|------|
| recognizeHandwriting | 1 | 手写识别 |
| addTextElement | 2 | 添加文本元素 |
| exportCanvas | 3 | 导出画布 |
| undo | 4 | 撤销 |
| redo | 5 | 重做 |
| clear | 6 | 清除 |
| setCurrentTool | 7 | 设置工具 |
| setCurrentColor | 8 | 设置颜色 |
| setCurrentStrokeWidth | 9 | 设置线宽 |
| setToolConfig | 10 | 设置工具配置 |
| setViewport | 11 | 设置视口 |
| resetViewport | 12 | 重置视口 |
| addImage | 15 | 添加图片 |

## 故障排除

### 工具不工作

1. 检查 `nativeViewRef` 是否正确传递
2. 确认 `viewType` 参数正确 ('pdf', 'paged', 'infinite')
3. 查看控制台日志，确认命令是否成功分发

### 数据未保存

1. 确认 `noteId` 已正确传递
2. 检查 Realm 数据库是否正常初始化
3. 查看保存相关的控制台日志

### 工具配置未生效

1. 确认工具配置格式正确
2. 检查原生代码是否实现了 `setToolConfig` 方法
3. 查看原生日志，确认配置是否接收

## 最佳实践

1. **统一使用 `useNativeToolbarBridge`**: 不要在每个屏幕重复实现工具栏逻辑
2. **正确传递 viewType**: 确保使用正确的视图类型参数
3. **实现必要的回调**: 如 `onRequestRegionOCR` 等
4. **测试所有工具**: 确保每个工具在所有界面都能正常工作
5. **查看日志**: 开发时启用详细日志，便于调试

## 贡献指南

如果需要添加新工具：

1. 在 `AllInOneToolbar.js` 中添加UI
2. 在 `useNativeToolbarBridge.js` 中添加处理逻辑
3. 在 `nativeCommandMap.js` 中添加命令映射
4. 在原生代码中实现功能
5. 更新本文档

## 参考资料

- [AllInOneToolbar.js](../src/components/common/AllInOneToolbar.js)
- [useNativeToolbarBridge.js](../src/hooks/useNativeToolbarBridge.js)
- [nativeCommandMap.js](../src/config/nativeCommandMap.js)
- [NativeInfiniteCanvasView.m](../ios/NativeInfiniteCanvasView/NativeInfiniteCanvasView.m)
- [NativePagedNoteView.m](../ios/NativePagedNoteView/NativePagedNoteView.m)

