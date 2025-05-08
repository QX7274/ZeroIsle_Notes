# 样式模块

本目录包含零屿笔记应用的全局样式定义和样式常量，用于统一应用的视觉风格和提高样式复用性。

## 文件结构

- **constants.js**: 样式常量文件，定义全局样式常量
- **globalStyles.js**: 全局样式文件，定义可复用的样式
- **animations.js**: 动画样式文件，定义常用动画效果
- **themes/**: 主题样式目录，包含不同主题的样式定义

## 主要功能

### 样式常量 (constants.js)

样式常量文件定义了全局样式常量，包括：

- **间距常量**: 定义统一的间距值，用于组件内外边距
- **排版常量**: 定义字体大小、字重、行高等排版相关常量
- **颜色常量**: 导入并重新导出颜色常量，方便使用

### 全局样式 (globalStyles.js)

全局样式文件定义了可复用的样式，包括：

- **容器样式**: 定义常用的容器样式，如屏幕容器、卡片容器等
- **文本样式**: 定义常用的文本样式，如标题、正文、标签等
- **表单样式**: 定义表单元素的样式，如输入框、按钮、选择器等
- **列表样式**: 定义列表和网格的样式
- **阴影样式**: 定义常用的阴影效果
- **边框样式**: 定义常用的边框样式

### 动画样式 (animations.js)

动画样式文件定义了常用的动画效果，包括：

- **淡入淡出**: 定义元素的淡入淡出动画
- **滑动**: 定义元素的滑入滑出动画
- **缩放**: 定义元素的缩放动画
- **旋转**: 定义元素的旋转动画
- **弹性**: 定义元素的弹性动画

## 样式常量定义

### 间距常量

```javascript
export const SPACING = {
  TINY: 4,
  SMALL: 8,
  MEDIUM: 16,
  LARGE: 24,
  XLARGE: 32,
  XXLARGE: 48
};
```

### 排版常量

```javascript
export const TYPOGRAPHY = {
  FONT_SIZE_TINY: 12,
  FONT_SIZE_SMALL: 14,
  FONT_SIZE_MEDIUM: 16,
  FONT_SIZE_LARGE: 18,
  FONT_SIZE_XLARGE: 20,
  FONT_SIZE_XXLARGE: 24,
  
  FONT_WEIGHT_LIGHT: '300',
  FONT_WEIGHT_REGULAR: '400',
  FONT_WEIGHT_MEDIUM: '500',
  FONT_WEIGHT_BOLD: '700',
  
  LINE_HEIGHT_TIGHT: 1.2,
  LINE_HEIGHT_NORMAL: 1.5,
  LINE_HEIGHT_LOOSE: 1.8
};
```

## 全局样式示例

```javascript
import { StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY } from './constants';
import { COLORS } from '../utils/constants/colors';

export const globalStyles = StyleSheet.create({
  // 容器样式
  container: {
    flex: 1,
    padding: SPACING.MEDIUM
  },
  
  // 卡片样式
  card: {
    backgroundColor: COLORS.NEUTRAL.WHITE,
    borderRadius: 8,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    shadowColor: COLORS.SHADOW.LIGHT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  
  // 文本样式
  title: {
    fontSize: TYPOGRAPHY.FONT_SIZE_XLARGE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_BOLD,
    marginBottom: SPACING.SMALL
  },
  
  subtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LARGE,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM,
    marginBottom: SPACING.SMALL
  },
  
  body: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL
  },
  
  // 按钮样式
  button: {
    backgroundColor: COLORS.PRIMARY.DEFAULT,
    borderRadius: 8,
    padding: SPACING.MEDIUM,
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  buttonText: {
    color: COLORS.NEUTRAL.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: TYPOGRAPHY.FONT_WEIGHT_MEDIUM
  }
});
```

## 与其他模块的交互

样式模块与以下模块有交互：

- **主题模块**: 提供主题相关的样式和颜色
- **组件模块**: 为组件提供统一的样式定义
- **屏幕模块**: 为屏幕提供基础样式

## 使用方法

```javascript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { globalStyles } from '../../styles/globalStyles';
import { SPACING } from '../../styles/constants';

export default function ExampleScreen() {
  return (
    <View style={globalStyles.container}>
      <Text style={globalStyles.title}>标题文本</Text>
      <Text style={globalStyles.body}>正文内容，展示一些信息...</Text>
      
      <View style={[globalStyles.card, { marginTop: SPACING.LARGE }]}>
        <Text style={globalStyles.subtitle}>卡片标题</Text>
        <Text style={globalStyles.body}>卡片内容，可以包含各种信息...</Text>
      </View>
      
      <TouchableOpacity style={globalStyles.button}>
        <Text style={globalStyles.buttonText}>按钮文本</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## 注意事项

- 样式常量应保持一致性，避免在不同地方定义相同用途的常量
- 全局样式应只包含通用样式，特定组件的样式应在组件文件中定义
- 考虑不同屏幕尺寸和方向的适配
- 确保样式与主题系统的集成，支持动态主题切换
- 使用StyleSheet.create创建样式，提高性能
