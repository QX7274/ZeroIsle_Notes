# 手写识别功能使用指南

## 概述

手写识别功能允许用户将手写笔迹转换为可编辑的文本。该功能使用Apple Vision框架实现，支持中文、英文、数字和符号的识别。

---

## 功能特性

- ✅ **多语言支持**: 中文简体、英文
- ✅ **高精度识别**: 使用Vision框架的高精度模式
- ✅ **自动语言校正**: 启用语言校正以提高准确度
- ✅ **智能笔迹选择**: 自动识别最近的N笔笔迹
- ✅ **无缝集成**: 与AI工具栏完美集成

---

## 支持的平台

| 平台 | 状态 | 备注 |
|------|------|------|
| iOS | ✅ 完整支持 | 使用Vision框架 |
| Android | ❌ 待实现 | 计划使用ML Kit |

---

## 支持的视图

| 视图类型 | 状态 | 识别范围 |
|---------|------|---------|
| 无限画布 (NativeInfiniteCanvasView) | ✅ | 全局最近N笔 |
| 分页笔记 (NativePagedNoteView) | ✅ | 当前页最近N笔 |
| PDF查看器 (NativePDFView) | ❌ | 暂不支持 |

---

## 使用方法

### 1. 通过AI工具栏使用

这是最简单的使用方式，适合大多数用户。

**步骤**:
1. 在画布上书写一些文字
2. 点击工具栏中的AI按钮
3. 选择任意AI工具（如"翻译"、"摘要"等）
4. 如果没有选中文本，系统会自动：
   - 首先尝试区域OCR（需要用户框选）
   - 如果用户取消框选，则自动触发手写识别
5. 识别结果会自动传递给选定的AI工具进行处理

**示例**:
```
用户操作: 书写 "Hello World" → 点击AI → 选择"翻译"
系统行为: 识别笔迹 → 获取"Hello World" → 翻译为"你好世界"
结果: 显示翻译结果
```

### 2. 通过JavaScript API使用

适合开发者在自定义功能中集成手写识别。

#### 无限画布

```javascript
import { NativeModules, findNodeHandle } from 'react-native';

const recognizeHandwriting = async (canvasViewRef) => {
  try {
    const reactTag = findNodeHandle(canvasViewRef.current);
    if (!reactTag) {
      throw new Error('视图无效');
    }

    // 识别最近5笔
    const count = 5;
    const text = await NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(
      reactTag,
      count
    );

    console.log('识别结果:', text);
    return text;
  } catch (error) {
    console.error('手写识别失败:', error);
    throw error;
  }
};
```

#### 分页笔记

```javascript
import { NativeModules, findNodeHandle } from 'react-native';

const recognizeHandwriting = async (noteViewRef) => {
  try {
    const reactTag = findNodeHandle(noteViewRef.current);
    if (!reactTag) {
      throw new Error('视图无效');
    }

    // 识别当前页最近3笔
    const count = 3;
    const text = await NativeModules.NativePagedNoteView.recognizeHandwriting(
      reactTag,
      count
    );

    console.log('识别结果:', text);
    return text;
  } catch (error) {
    console.error('手写识别失败:', error);
    throw error;
  }
};
```

### 3. 通过命令系统使用（高级）

适合需要异步处理或事件驱动的场景。

```javascript
import { UIManager, findNodeHandle } from 'react-native';

// 发送识别命令
const sendRecognitionCommand = (canvasViewRef, count = 5) => {
  UIManager.dispatchViewManagerCommand(
    findNodeHandle(canvasViewRef.current),
    '1', // recognizeHandwriting 命令ID
    [count]
  );
};

// 监听识别结果
const handleHandwritingRecognized = (event) => {
  const { text } = event.nativeEvent;
  console.log('识别结果:', text);
};

// 在组件中使用
<NativeInfiniteCanvasView
  ref={canvasViewRef}
  onHandwritingRecognized={handleHandwritingRecognized}
  // ... 其他props
/>
```

---

## API参考

### NativeInfiniteCanvasView.recognizeHandwriting

识别无限画布中最近的笔迹。

**签名**:
```typescript
recognizeHandwriting(reactTag: number, count: number): Promise<string>
```

**参数**:
- `reactTag` (number): 视图的React标签，通过 `findNodeHandle` 获取
- `count` (number): 要识别的笔迹数量（从最近的笔迹开始计数）

**返回值**:
- `Promise<string>`: 识别的文本内容

**错误**:
- `E_VIEW_NOT_FOUND`: 找不到指定的视图
- `E_HANDWRITING_FAILED`: 识别失败
- `E_NOT_IMPLEMENTED`: 方法未实现（不应该发生）

**示例**:
```javascript
const text = await NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, 5);
// 返回: "Hello World"
```

### NativePagedNoteView.recognizeHandwriting

识别分页笔记当前页中最近的笔迹。

**签名**:
```typescript
recognizeHandwriting(reactTag: number, count: number): Promise<string>
```

**参数**:
- `reactTag` (number): 视图的React标签
- `count` (number): 要识别的笔迹数量

**返回值**:
- `Promise<string>`: 识别的文本内容

**错误**:
- `E_VIEW_NOT_FOUND`: 找不到指定的视图
- `E_HANDWRITING_FAILED`: 识别失败

**示例**:
```javascript
const text = await NativeModules.NativePagedNoteView.recognizeHandwriting(reactTag, 3);
// 返回: "你好世界"
```

---

## 识别准确度

### 影响因素

1. **笔迹清晰度**: 清晰的笔迹识别准确度更高
2. **笔迹大小**: 适中的笔迹大小效果最好
3. **笔迹间距**: 适当的间距有助于识别
4. **语言类型**: 打印体比草书识别准确度高

### 优化建议

**书写建议**:
- ✅ 使用清晰的打印体
- ✅ 保持适当的字符间距
- ✅ 避免笔迹重叠
- ✅ 使用适中的笔画粗细

**技术建议**:
- ✅ 识别前确保笔迹完整
- ✅ 避免在识别过程中添加新笔迹
- ✅ 对于复杂内容，分批识别

### 预期准确度

| 内容类型 | 预期准确度 | 备注 |
|---------|-----------|------|
| 英文打印体 | 90-95% | 效果最好 |
| 中文打印体 | 85-90% | 需要清晰书写 |
| 英文草书 | 70-80% | 取决于书写风格 |
| 中文草书 | 60-75% | 识别难度较高 |
| 数字 | 95-98% | 效果很好 |
| 符号 | 80-90% | 常见符号识别良好 |

---

## 故障排除

### 问题: 识别结果为空

**可能原因**:
1. 没有可识别的笔迹
2. 笔迹数量少于请求的数量
3. 笔迹类型不支持（如橡皮擦、形状等）

**解决方案**:
- 确保画布上有笔迹
- 减少请求的笔迹数量
- 确保使用的是笔、铅笔或画笔工具

### 问题: 识别准确度低

**可能原因**:
1. 笔迹过于潦草
2. 笔迹重叠
3. 笔迹过小或过大

**解决方案**:
- 使用更清晰的书写风格
- 增加字符间距
- 调整笔画粗细

### 问题: 识别速度慢

**可能原因**:
1. 识别的笔迹数量过多
2. 笔迹过于复杂
3. 设备性能限制

**解决方案**:
- 减少识别的笔迹数量
- 分批识别
- 在较新的设备上使用

### 问题: 在Android上不可用

**原因**: Android平台尚未实现

**解决方案**: 
- 等待Android版本的实现
- 或使用区域OCR作为替代方案

---

## 最佳实践

### 1. 错误处理

始终使用try-catch包裹识别调用：

```javascript
try {
  const text = await recognizeHandwriting(viewRef);
  if (!text || text.trim() === '') {
    Alert.alert('提示', '未识别到文本，请重新书写');
    return;
  }
  // 处理识别结果
} catch (error) {
  console.error('识别失败:', error);
  Alert.alert('错误', '手写识别失败，请重试');
}
```

### 2. 用户反馈

在识别过程中提供视觉反馈：

```javascript
const [isRecognizing, setIsRecognizing] = useState(false);

const handleRecognize = async () => {
  setIsRecognizing(true);
  try {
    const text = await recognizeHandwriting(viewRef);
    // 处理结果
  } finally {
    setIsRecognizing(false);
  }
};

// 在UI中显示加载状态
{isRecognizing && <ActivityIndicator />}
```

### 3. 结果验证

验证识别结果的合理性：

```javascript
const validateRecognitionResult = (text) => {
  if (!text || text.trim() === '') {
    return { valid: false, reason: '识别结果为空' };
  }
  
  if (text.length < 2) {
    return { valid: false, reason: '识别结果过短' };
  }
  
  // 可以添加更多验证逻辑
  
  return { valid: true };
};
```

---

## 性能考虑

### 内存使用

- 每次识别会创建临时图像，完成后自动释放
- 识别大量笔迹时，内存使用会增加
- 建议每次识别不超过10笔

### 处理时间

| 笔迹数量 | 预期时间 | 备注 |
|---------|---------|------|
| 1-3笔 | 0.5-1秒 | 最快 |
| 4-5笔 | 1-2秒 | 推荐 |
| 6-10笔 | 2-3秒 | 可接受 |
| 10+笔 | 3+秒 | 不推荐 |

---

## 未来计划

- [ ] Android平台支持（使用ML Kit）
- [ ] 支持选择特定笔迹进行识别
- [ ] 支持区域选择识别
- [ ] 多候选结果支持
- [ ] 识别置信度显示
- [ ] 离线模型优化

---

## 相关文档

- [AI功能完成度总结](../AI功能完成度总结.md)
- [工具栏实现指南](./toolbar-implementation-guide.md)
- [Vision框架文档](https://developer.apple.com/documentation/vision)

---

**最后更新**: 2025-11-11
**版本**: 1.0

