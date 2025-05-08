# 画布组件

本目录包含与画布功能相关的组件，用于创建和编辑无限画布内容。

## 组件列表

### InfiniteCanvas

无限画布组件，提供基于SVG的高性能无限画布功能。

**主要功能**：
- 支持无限缩放和平移
- 支持多种绘图工具（笔、荧光笔、橡皮擦等）
- 支持多种形状工具（直线、矩形、圆形、三角形、箭头）
- 支持文本和图片
- 支持图层管理
- 支持撤销/重做功能
- 支持自动保存功能
- 支持导出为图片

### InfiniteDrawingCanvas

无限绘图画布组件，提供与旧DrawingCanvas兼容的接口，但使用新的InfiniteCanvas实现。

**主要功能**：
- 提供与DrawingCanvas兼容的API
- 支持多种绘图工具
- 支持形状绘制
- 支持截图功能

### InfiniteCanvasAdapter

无限画布适配器组件，提供与旧Canvas兼容的接口，但使用新的InfiniteCanvas实现。

**主要功能**：
- 提供与Canvas兼容的API
- 支持元素管理
- 支持内容变更回调
- 支持元素选择

### CanvasToolbar

画布工具栏组件，提供各种绘图工具和操作按钮。

**主要功能**：
- 提供笔、橡皮擦、形状等工具
- 提供颜色选择器
- 提供线宽选择器
- 提供撤销、重做按钮

### CanvasElement

画布元素组件，用于在画布上渲染各种元素。

**主要功能**：
- 支持文本元素
- 支持图形元素
- 支持图片元素
- 支持连接线

### LayerManager

图层管理器组件，用于管理画布上的图层。

**主要功能**：
- 显示图层列表
- 支持图层排序
- 支持图层显示/隐藏
- 支持图层锁定/解锁

### StyleEditor

样式编辑器组件，用于编辑元素的样式。

**主要功能**：
- 编辑颜色
- 编辑线宽
- 编辑字体
- 编辑填充样式

## 使用方法

### 使用InfiniteCanvas

```javascript
import { InfiniteCanvas } from '../components/canvas';

function InfiniteCanvasScreen() {
  return (
    <View style={styles.container}>
      <InfiniteCanvas
        canvasId="my-canvas"
        onContentChange={handleContentChange}
        onSave={handleSave}
      />
    </View>
  );
}
```

### 使用InfiniteCanvasAdapter

```javascript
import {
  CanvasToolbar,
  InfiniteCanvasAdapter,
  LayerManager
} from '../components/canvas';

function CanvasScreen() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [elements, setElements] = useState([]);

  return (
    <View style={styles.container}>
      <CanvasToolbar
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
      />

      <InfiniteCanvasAdapter
        elements={elements}
        onContentChange={setElements}
      />

      <LayerManager
        layers={layers}
        onLayersChange={setLayers}
      />
    </View>
  );
}
```
