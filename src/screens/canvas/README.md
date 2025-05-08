# 画布屏幕组件

本目录包含与画布功能相关的屏幕组件，用于创建和编辑无限画布内容。

## 屏幕组件列表

### CanvasScreen

画布主屏幕组件，提供画布编辑功能。

**主要功能**：
- 支持元素添加和编辑
- 支持绘图功能
- 支持画布保存和加载
- 支持画布导入和导出

### InfiniteCanvasScreen

无限画布屏幕组件，提供基于SVG的高性能无限画布功能。

**主要功能**：
- 支持无限缩放和平移
- 支持多种绘图工具（笔、荧光笔、橡皮擦等）
- 支持多种形状工具（直线、矩形、圆形、三角形、箭头）
- 支持文本和图片
- 支持图层管理
- 支持撤销/重做功能
- 支持自动保存功能

### InfiniteCanvasListScreen

无限画布列表屏幕组件，用于管理用户的所有无限画布。

**主要功能**：
- 显示用户的所有无限画布
- 支持创建新画布
- 支持打开现有画布
- 支持删除画布
- 支持画布预览

## 使用方法

```javascript
import { CanvasScreen, InfiniteCanvasScreen, InfiniteCanvasListScreen } from '../screens/canvas';

// 在导航中使用
<Stack.Navigator>
  <Stack.Screen name="InfiniteCanvasList" component={InfiniteCanvasListScreen} options={{ title: '我的草稿' }} />
  <Stack.Screen name="InfiniteCanvas" component={InfiniteCanvasScreen} options={{ title: '无限草稿' }} />
  <Stack.Screen name="Canvas" component={CanvasScreen} options={{ title: '画布' }} />
</Stack.Navigator>

// 导航到画布屏幕
navigation.navigate('InfiniteCanvasList');
navigation.navigate('InfiniteCanvas', { canvasId: 'canvas-123', title: '我的草稿' });
```

## 组件关系

- **InfiniteCanvasListScreen**: 显示所有画布，点击画布项导航到InfiniteCanvasScreen
- **InfiniteCanvasScreen**: 使用InfiniteCanvas组件提供无限画布功能
- **CanvasScreen**: 使用InfiniteCanvasAdapter组件提供兼容旧版的画布功能

## 数据流

1. 用户在InfiniteCanvasListScreen创建或选择画布
2. 导航到InfiniteCanvasScreen并传递canvasId
3. InfiniteCanvasScreen加载画布数据并显示
4. 用户编辑画布内容
5. 画布内容自动保存到本地存储
6. 当有网络连接时，画布内容同步到服务器
