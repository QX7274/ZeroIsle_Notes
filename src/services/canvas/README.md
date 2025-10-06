# 画布服务

本目录包含零屿笔记应用的画布相关服务，用于管理无限画布和绘图等功能。

## 文件结构

- **canvasService.js**: 画布服务，提供画布管理和操作功能
- **drawingService.js**: 绘图服务，提供绘图功能
- **index.js**: 服务导出文件，集中导出所有画布相关服务

## 主要功能

### 画布服务 (canvasService.js)

画布服务提供以下主要功能：

- **画布创建**: 创建新的画布实例
- **画布加载**: 加载保存的画布数据
- **画布保存**: 保存画布状态和内容
- **画布操作**: 提供缩放、平移、旋转等画布操作
- **元素管理**: 管理画布上的元素（文本、图形、图片等）
- **历史记录**: 提供撤销/重做功能
- **视图管理**: 管理画布视图和视口

### 绘图服务 (drawingService.js)

绘图服务提供以下主要功能：

- **绘图工具**: 提供各种绘图工具（笔、橡皮擦、形状等）
- **绘图样式**: 管理绘图的样式（颜色、粗细、透明度等）
- **图层管理**: 管理绘图图层
- **路径优化**: 优化绘图路径，提高性能

## 画布数据结构

画布数据的基本结构如下：

```javascript
{
  id: String,                 // 画布ID
  name: String,               // 画布名称
  width: Number,              // 画布宽度
  height: Number,             // 画布高度
  backgroundColor: String,    // 背景颜色
  backgroundImage: String,    // 背景图片（可选）
  elements: [{                // 画布元素
    id: String,               // 元素ID
    type: String,             // 元素类型（text, shape, image, path等）
    x: Number,                // X坐标
    y: Number,                // Y坐标
    width: Number,            // 宽度
    height: Number,           // 高度
    rotation: Number,         // 旋转角度
    opacity: Number,          // 透明度
    zIndex: Number,           // 层级
    data: Object              // 元素特定数据
  }],
  viewBox: {                  // 视图框
    x: Number,                // 视图X坐标
    y: Number,                // 视图Y坐标
    width: Number,            // 视图宽度
    height: Number            // 视图高度
  },
  scale: Number,              // 缩放比例
  createdAt: Date,            // 创建时间
  updatedAt: Date             // 更新时间
}
```

## 绘图路径数据结构

绘图路径的基本结构如下：

```javascript
{
  id: String,                 // 路径ID
  points: [{                  // 路径点
    x: Number,                // X坐标
    y: Number,                // Y坐标
    pressure: Number,         // 压力值（可选）
    timestamp: Number         // 时间戳
  }],
  strokeWidth: Number,        // 线条宽度
  strokeColor: String,        // 线条颜色
  strokeOpacity: Number,      // 线条透明度
  tool: String,               // 使用的工具
  smoothing: Number,          // 平滑度
  simplification: Number,     // 简化度
  isEraser: Boolean           // 是否为橡皮擦
}
```

## 与其他服务的交互

画布服务与以下服务有交互：

- **存储服务**: 用于保存和加载画布数据
- **同步服务**: 确保画布数据在多设备间同步
- **AI服务**: 集成手写识别和图形识别功能
- **导出服务**: 支持将画布导出为图片或PDF

## 使用方法

```javascript
import { canvasService, drawingService } from '../../services/canvas';

// 创建新画布
async function createCanvas(name, width, height) {
  try {
    const canvas = await canvasService.createCanvas({
      name,
      width,
      height,
      backgroundColor: '#ffffff'
    });
    
    console.log('画布创建成功:', canvas.id);
    return canvas;
  } catch (error) {
    console.error('创建画布失败:', error);
    return null;
  }
}

// 加载画布
async function loadCanvas(canvasId) {
  try {
    const canvas = await canvasService.loadCanvas(canvasId);
    console.log('画布加载成功:', canvas.name);
    return canvas;
  } catch (error) {
    console.error('加载画布失败:', error);
    return null;
  }
}

// 添加元素到画布
async function addElement(canvasId, element) {
  try {
    const elementId = await canvasService.addElement(canvasId, {
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      data: {
        text: '这是一个文本元素',
        fontSize: 16,
        fontFamily: 'Arial',
        color: '#000000'
      }
    });
    
    console.log('元素添加成功:', elementId);
    return elementId;
  } catch (error) {
    console.error('添加元素失败:', error);
    return null;
  }
}

// 开始绘图会话
function startDrawingSession(canvasId) {
  drawingService.startSession(canvasId, {
    tool: 'pen',
    strokeWidth: 2,
    strokeColor: '#000000',
    smoothing: 0.5
  });
}

// 添加绘图点
function addDrawingPoint(x, y, pressure = 1) {
  drawingService.addPoint({
    x,
    y,
    pressure,
    timestamp: Date.now()
  });
}

// 结束绘图会话
async function endDrawingSession() {
  try {
    const pathId = await drawingService.endSession();
    console.log('绘图路径已保存:', pathId);
    return pathId;
  } catch (error) {
    console.error('保存绘图路径失败:', error);
    return null;
  }
}

// 导出画布为图片
async function exportCanvasAsImage(canvasId, format = 'png') {
  try {
    const imageUri = await canvasService.exportAsImage(canvasId, {
      format,
      quality: 0.9
    });
    
    console.log('画布导出成功:', imageUri);
    return imageUri;
  } catch (error) {
    console.error('导出画布失败:', error);
    return null;
  }
}
```

## 注意事项

- 画布操作可能是资源密集型的，应注意性能优化
- 对于大型画布，考虑使用分块渲染和懒加载
- 提供自动保存功能，防止数据丢失
- 考虑多设备同步时的冲突解决策略
- 对于手写识别，考虑在设备上进行，减少网络依赖
