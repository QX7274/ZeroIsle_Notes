# 通用组件

本目录包含应用中使用的通用组件，这些组件可以在多个功能模块中复用。

## 组件列表

### Button

按钮组件，提供各种样式的按钮。

**主要功能**：
- 支持多种样式（主要、次要、危险等）
- 支持图标
- 支持加载状态
- 支持禁用状态

### Card

卡片组件，用于显示内容块。

**主要功能**：
- 支持阴影效果
- 支持圆角
- 支持边框
- 支持内容区域和头部/底部区域

### Divider

分隔线组件，用于分隔内容。

**主要功能**：
- 支持水平和垂直方向
- 支持自定义颜色
- 支持自定义宽度
- 支持文本标签

### GradientButton

渐变按钮组件，提供渐变背景的按钮。

**主要功能**：
- 支持多种渐变方向
- 支持自定义渐变颜色
- 支持图标
- 支持加载状态

### Header

头部组件，用于显示页面头部。

**主要功能**：
- 支持标题
- 支持返回按钮
- 支持右侧操作按钮
- 支持搜索框

### Input

输入框组件，用于文本输入。

**主要功能**：
- 支持多种类型（文本、密码、数字等）
- 支持图标
- 支持错误提示
- 支持标签

### Loading

加载组件，用于显示加载状态。

**主要功能**：
- 支持多种加载动画
- 支持自定义颜色
- 支持自定义大小
- 支持加载文本

### Modal

模态框组件，用于显示弹出内容。

**主要功能**：
- 支持自定义内容
- 支持自定义头部和底部
- 支持动画效果
- 支持背景点击关闭

### Typography

排版组件，提供各种文本样式。

**主要功能**：
- 支持标题、段落、引用等样式
- 支持自定义颜色
- 支持自定义字体大小
- 支持自定义行高

## 使用方法

```javascript
import { Button, Card, Input, Loading } from '../components/common';

function MyScreen() {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = () => {
    setIsLoading(true);
    // 处理提交逻辑
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };
  
  return (
    <View style={styles.container}>
      <Card>
        <Input
          label="用户名"
          value={text}
          onChangeText={setText}
          placeholder="请输入用户名"
        />
        
        <Button
          title="提交"
          onPress={handleSubmit}
          disabled={!text}
        />
      </Card>
      
      <Loading visible={isLoading} />
    </View>
  );
}
```
