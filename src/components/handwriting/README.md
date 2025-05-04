# 手写识别组件

本目录包含与手写识别功能相关的组件。

## 组件列表

### HandwritingRecognizer

手写识别器组件，用于识别手写内容。

**主要功能**：
- 支持手写文本识别
- 支持多语言识别
- 支持实时识别
- 支持识别结果编辑

### HandwritingCanvas

手写画布组件，用于手写输入。

**主要功能**：
- 支持手写输入
- 支持笔迹样式调整
- 支持橡皮擦功能
- 支持清空画布

### HandwritingHistory

手写历史组件，用于显示和管理历史手写记录。

**主要功能**：
- 显示历史手写记录
- 支持历史记录预览
- 支持历史记录编辑
- 支持历史记录删除

### ShapeRecognizer

形状识别器组件，用于识别手绘形状。

**主要功能**：
- 支持基本形状识别（圆形、矩形、三角形等）
- 支持形状美化
- 支持形状编辑
- 支持形状转换

## 使用方法

```javascript
import { HandwritingCanvas, HandwritingRecognizer } from '../components/handwriting';

function HandwritingScreen() {
  const [strokes, setStrokes] = useState([]);
  const [recognizedText, setRecognizedText] = useState('');
  
  const handleStrokeEnd = (newStrokes) => {
    setStrokes([...strokes, ...newStrokes]);
  };
  
  const handleRecognize = async () => {
    if (strokes.length === 0) return;
    
    try {
      const result = await recognizeHandwriting(strokes);
      setRecognizedText(result);
    } catch (error) {
      console.error('Recognition error:', error);
    }
  };
  
  return (
    <View style={styles.container}>
      <HandwritingCanvas
        onStrokeEnd={handleStrokeEnd}
        onClear={() => setStrokes([])}
      />
      
      <Button title="识别" onPress={handleRecognize} />
      
      <HandwritingRecognizer
        text={recognizedText}
        onTextChange={setRecognizedText}
      />
    </View>
  );
}
```
