# 触摸类型检测服务

本模块提供手指和手写笔触摸类型识别功能，支持Android和iOS平台。

## 功能特性

- ✅ 识别手指触摸和手写笔触摸
- ✅ 支持实时触摸类型检测
- ✅ 支持多点触摸检测
- ✅ 提供React Hook便捷接口
- ✅ 跨平台支持（Android/iOS）
- ✅ 事件监听机制
- ✅ 触摸数据详细信息

## 支持的触摸类型

### Android
- **手指触摸**: `MotionEvent.TOOL_TYPE_FINGER`
- **手写笔触摸**: `MotionEvent.TOOL_TYPE_STYLUS`
- **橡皮擦**: `MotionEvent.TOOL_TYPE_ERASER`

### iOS
- **手指触摸**: `UITouchTypeDirect`
- **Apple Pencil**: `UITouchTypeStylus`
- **间接触摸**: `UITouchTypeIndirect`

## 快速开始

### 1. 基本使用

```javascript
import touchTypeDetectionService, { TOUCH_TYPES } from '../services/touch/TouchTypeDetectionService';

// 检查服务可用性
if (touchTypeDetectionService.isAvailable()) {
  // 从触摸事件检测类型
  const handleTouch = async (event) => {
    const result = await touchTypeDetectionService.detectTouchTypeFromEvent(event);
    console.log('触摸类型:', result.touchType);
    
    if (result.touchType === TOUCH_TYPES.STYLUS) {
      console.log('检测到手写笔');
    } else if (result.touchType === TOUCH_TYPES.FINGER) {
      console.log('检测到手指');
    }
  };
}
```

### 2. 使用React Hook

```javascript
import { useTouchTypeDetection } from '../hooks/useTouchTypeDetection';

const MyComponent = () => {
  const {
    isListening,
    isAvailable,
    startListening,
    stopListening,
    detectTouchTypeFromEvent,
    lastDetectedTouch,
    TOUCH_TYPES
  } = useTouchTypeDetection({
    autoStart: true,
    onTouchTypeDetected: (touchData) => {
      console.log('检测到触摸:', touchData);
    }
  });

  const handleTouch = async (event) => {
    const result = await detectTouchTypeFromEvent(event);
    // 处理检测结果
  };

  return (
    <TouchableOpacity onPress={handleTouch}>
      <Text>触摸检测区域</Text>
    </TouchableOpacity>
  );
};
```

### 3. 简化版Hook

```javascript
import { useSimpleTouchTypeDetection } from '../hooks/useTouchTypeDetection';

const SimpleComponent = () => {
  const {
    lastTouchType,
    detectFromEvent,
    isStylus,
    isFinger
  } = useSimpleTouchTypeDetection();

  const handleTouch = async (event) => {
    const touchType = await detectFromEvent(event);
    if (touchType === TOUCH_TYPES.STYLUS) {
      // 手写笔逻辑
    }
  };

  return (
    <View>
      <Text>当前触摸类型: {lastTouchType}</Text>
      <Text>是否为手写笔: {isStylus ? '是' : '否'}</Text>
    </View>
  );
};
```

## API 参考

### TouchTypeDetectionService

#### 方法

- `isAvailable()`: 检查服务是否可用
- `startListening()`: 开始监听触摸事件
- `stopListening()`: 停止监听触摸事件
- `detectTouchType(touchData)`: 检测单个触摸点类型
- `detectTouchTypeFromEvent(event, touchIndex)`: 从React Native事件检测触摸类型
- `detectMultiTouchTypes(touchPoints)`: 批量检测多个触摸点
- `getSupportedTouchTypes()`: 获取设备支持的触摸类型
- `addEventListener(eventName, callback)`: 添加事件监听器
- `removeEventListener(eventName)`: 移除事件监听器

#### 常量

```javascript
export const TOUCH_TYPES = {
  FINGER: 'finger',
  STYLUS: 'stylus',
  UNKNOWN: 'unknown'
};

export const EVENTS = {
  TOUCH_TYPE_DETECTED: 'TouchTypeDetected'
};
```

### useTouchTypeDetection Hook

#### 参数

```javascript
const options = {
  autoStart: false,           // 是否自动开始监听
  onTouchTypeDetected: null,  // 触摸类型检测回调
  enableMultiTouch: false     // 是否启用多点触摸检测
};
```

#### 返回值

```javascript
const {
  // 状态
  isListening,          // 是否正在监听
  isAvailable,          // 服务是否可用
  supportedTypes,       // 支持的触摸类型
  lastDetectedTouch,    // 最后检测到的触摸
  error,                // 错误信息

  // 方法
  startListening,       // 开始监听
  stopListening,        // 停止监听
  detectTouchType,      // 检测触摸类型
  detectTouchTypeFromEvent, // 从事件检测
  detectMultiTouchTypes,    // 多点触摸检测

  // 便捷方法
  isStylus,            // 判断是否为手写笔
  isFinger,            // 判断是否为手指
  isLastTouchStylus,   // 最后一次是否为手写笔
  isLastTouchFinger,   // 最后一次是否为手指

  // 常量
  TOUCH_TYPES,
  EVENTS
} = useTouchTypeDetection(options);
```

## 触摸数据格式

### Android 触摸数据

```javascript
{
  touchType: 'stylus',    // 检测到的触摸类型
  x: 100.5,               // X坐标
  y: 200.3,               // Y坐标
  pressure: 0.8,          // 压力值 (0-1)
  size: 0.2,              // 接触面积大小
  toolType: 2,            // 原始工具类型
  timestamp: 1640995200000 // 时间戳
}
```

### iOS 触摸数据

```javascript
{
  touchType: 'stylus',    // 检测到的触摸类型
  x: 100.5,               // X坐标
  y: 200.3,               // Y坐标
  force: 0.6,             // 力度值 (0-1)
  radius: 5.2,            // 接触半径
  originalTouchType: 2,   // 原始触摸类型
  timestamp: 1640995200000 // 时间戳
}
```

## 最佳实践

### 1. 性能优化

```javascript
// 避免在每次触摸时都进行检测，使用防抖
import { debounce } from 'lodash';

const debouncedDetection = debounce(async (event) => {
  const result = await detectTouchTypeFromEvent(event);
  // 处理结果
}, 100);
```

### 2. 错误处理

```javascript
const handleTouch = async (event) => {
  try {
    const result = await detectTouchTypeFromEvent(event);
    // 处理成功结果
  } catch (error) {
    console.error('触摸检测失败:', error);
    // 降级处理，假设为手指触摸
    handleFingerTouch(event);
  }
};
```

### 3. 条件渲染

```javascript
const MyComponent = () => {
  const { isAvailable, isStylus, lastDetectedTouch } = useTouchTypeDetection();

  if (!isAvailable) {
    return <Text>触摸检测不可用</Text>;
  }

  return (
    <View>
      {isStylus(lastDetectedTouch?.touchType) && (
        <Text>手写笔模式激活</Text>
      )}
      {/* 其他组件 */}
    </View>
  );
};
```

## 故障排除

### 常见问题

1. **服务不可用**
   - 检查原生模块是否正确链接
   - 确认设备支持触摸检测

2. **检测不准确**
   - 调整压力和大小的阈值
   - 检查设备校准

3. **性能问题**
   - 使用防抖减少检测频率
   - 避免在高频事件中进行检测

### 调试

```javascript
// 启用详细日志
const { getListeningStatus } = useTouchTypeDetection();
console.log('监听状态:', getListeningStatus());

// 检查支持的功能
const supportInfo = await getSupportedTouchTypes();
console.log('支持信息:', supportInfo);
```

## 示例

完整的示例代码请参考 `TouchTypeDetectionDemo.js` 组件。
