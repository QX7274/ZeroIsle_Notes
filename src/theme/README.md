# 主题模块

本目录包含零屿笔记应用的主题相关文件，用于定义和管理应用的视觉主题，支持亮色/暗色模式和自定义主题。

## 文件结构

- **index.js**: 主题模块导出文件，定义和导出默认主题
- **colors.js**: 颜色定义文件，定义应用使用的所有颜色
- **fonts.js**: 字体定义文件，定义应用使用的字体和排版
- **metrics.js**: 尺寸定义文件，定义应用使用的尺寸和间距
- **modernTheme.js**: 现代主题文件，定义现代风格的主题

## 主要功能

### 主题模块导出 (index.js)

主题模块导出文件提供以下主要功能：

- **定义亮色主题**: 定义应用的亮色主题
- **定义暗色主题**: 定义应用的暗色主题
- **导出主题对象**: 导出包含亮色和暗色主题的对象

### 颜色定义 (colors.js)

颜色定义文件定义了应用使用的所有颜色，包括：

- **主色调**: 定义应用的主要颜色
- **辅助色**: 定义应用的辅助颜色
- **功能色**: 定义成功、警告、错误等功能色
- **中性色**: 定义背景、文本、边框等中性色
- **语义色**: 定义具有特定语义的颜色

### 字体定义 (fonts.js)

字体定义文件定义了应用使用的字体和排版，包括：

- **字体族**: 定义应用使用的字体族
- **字体大小**: 定义不同级别的字体大小
- **字体粗细**: 定义不同级别的字体粗细
- **行高**: 定义不同级别的行高

### 尺寸定义 (metrics.js)

尺寸定义文件定义了应用使用的尺寸和间距，包括：

- **间距**: 定义组件内外边距
- **边框半径**: 定义组件圆角
- **图标大小**: 定义图标尺寸
- **屏幕尺寸**: 定义屏幕相关尺寸

### 现代主题 (modernTheme.js)

现代主题文件定义了现代风格的主题，包括：

- **现代亮色主题**: 定义现代风格的亮色主题
- **现代暗色主题**: 定义现代风格的暗色主题
- **现代主题特性**: 定义现代主题的特有特性

## 主题结构

主题对象的基本结构如下：

```javascript
{
  dark: Boolean,              // 是否为暗色主题
  colors: {                   // 颜色定义
    primary: String,          // 主色调
    background: String,       // 背景色
    card: String,             // 卡片背景色
    text: String,             // 文本色
    border: String,           // 边框色
    notification: String,     // 通知色
    // 自定义颜色
    secondary: String,        // 辅助色
    success: String,          // 成功色
    info: String,             // 信息色
    warning: String,          // 警告色
    error: String,            // 错误色
    textSecondary: String,    // 次要文本色
    textDisabled: String,     // 禁用文本色
    textHint: String,         // 提示文本色
    divider: String,          // 分隔线色
    shadow: String            // 阴影色
  },
  dimensions: {               // 尺寸定义
    spacing: Object,          // 间距
    borderRadius: Object,     // 边框半径
    iconSize: Object          // 图标大小
  },
  typography: {               // 排版定义
    fontFamily: Object,       // 字体族
    fontSize: Object,         // 字体大小
    fontWeight: Object,       // 字体粗细
    lineHeight: Object        // 行高
  }
}
```

## 颜色定义示例

```javascript
// 主色调
export const PRIMARY = {
  LIGHTEST: '#E3F2FD',
  LIGHTER: '#BBDEFB',
  LIGHT: '#90CAF9',
  DEFAULT: '#2196F3',
  DARK: '#1E88E5',
  DARKER: '#1976D2',
  DARKEST: '#0D47A1'
};

// 辅助色
export const SECONDARY = {
  LIGHTEST: '#F3E5F5',
  LIGHTER: '#E1BEE7',
  LIGHT: '#CE93D8',
  DEFAULT: '#9C27B0',
  DARK: '#8E24AA',
  DARKER: '#7B1FA2',
  DARKEST: '#4A148C'
};

// 功能色
export const SUCCESS = {
  LIGHTEST: '#E8F5E9',
  LIGHTER: '#C8E6C9',
  LIGHT: '#A5D6A7',
  DEFAULT: '#4CAF50',
  DARK: '#43A047',
  DARKER: '#388E3C',
  DARKEST: '#1B5E20'
};

// 中性色 - 亮色主题
export const NEUTRAL = {
  WHITE: '#FFFFFF',
  LIGHTEST: '#F5F5F5',
  LIGHTER: '#EEEEEE',
  LIGHT: '#E0E0E0',
  DEFAULT: '#9E9E9E',
  DARK: '#757575',
  DARKER: '#616161',
  DARKEST: '#212121',
  BLACK: '#000000'
};
```

## 与其他模块的交互

主题模块与以下模块有交互：

- **上下文模块**: 通过ThemeContext提供主题
- **样式模块**: 为样式提供主题颜色和尺寸
- **组件模块**: 为组件提供主题支持
- **存储模块**: 存储用户主题偏好

## 使用方法

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ThemedComponent() {
  const theme = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        主题示例
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardText, { color: theme.text }]}>
          这是一个使用主题的卡片
        </Text>
        <Text style={[styles.cardSubtext, { color: theme.textSecondary }]}>
          次要文本使用次要文本颜色
        </Text>
      </View>
      <View style={[styles.button, { backgroundColor: theme.primary }]}>
        <Text style={styles.buttonText}>
          主题按钮
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16
  },
  cardText: {
    fontSize: 16,
    marginBottom: 8
  },
  cardSubtext: {
    fontSize: 14
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500'
  }
});
```

## 注意事项

- 主题颜色应考虑无障碍性，确保足够的对比度
- 主题切换应平滑，避免闪烁
- 自定义主题应有合理的限制，避免破坏应用的整体视觉一致性
- 考虑不同平台的视觉差异，适当调整主题
- 主题应支持动态更新，响应系统主题变化
