# 上下文（Context）

本目录包含应用中使用的React上下文（Context）。

## 上下文列表

### ThemeContext

主题上下文，用于管理应用的主题设置。

```javascript
import { useTheme } from '../context';

// 使用示例
const { colors, isDark, toggleTheme } = useTheme();
```

### AccessibilityContext

无障碍上下文，用于管理应用的无障碍设置。

```javascript
import { useAccessibility } from '../context';

// 使用示例
const { isScreenReaderEnabled, fontScale, reduceMotion } = useAccessibility();
```

## 使用方法

### 提供者（Provider）

在应用的根组件中使用提供者：

```javascript
import { ThemeProvider, AccessibilityProvider } from '../context';

function App() {
  return (
    <ThemeProvider>
      <AccessibilityProvider>
        {/* 应用内容 */}
      </AccessibilityProvider>
    </ThemeProvider>
  );
}
```

### 消费者（Consumer）

在组件中使用钩子消费上下文：

```javascript
import { useTheme, useAccessibility } from '../context';

function MyComponent() {
  const { colors, isDark } = useTheme();
  const { fontScale } = useAccessibility();
  
  return (
    <View style={{ backgroundColor: colors.background }}>
      <Text style={{ fontSize: 16 * fontScale, color: colors.text }}>
        Hello World
      </Text>
    </View>
  );
}
```
