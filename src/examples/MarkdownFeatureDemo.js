/**
 * Markdown Feature Demo Component
 * Demonstrates all supported markdown features with live examples
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MarkdownEditorIntegration } from '../components/common';

const DEMO_CONTENT = `# Markdown 功能演示

这个文档展示了我们的 Markdown 编辑器支持的所有功能。

## 文本格式

### 基本格式
- **粗体文本** 使用 \`**文本**\` 或 \`__文本__\`
- *斜体文本* 使用 \`*文本*\` 或 \`_文本_\`
- ~~删除线文本~~ 使用 \`~~文本~~\`
- __下划线文本__ 使用 \`__文本__\`
- \`行内代码\` 使用反引号

### 组合格式
- ***粗斜体*** 组合使用 \`***文本***\`
- **粗体中的 *斜体***
- ~~删除线中的 **粗体**~~

## 列表

### 无序列表
- 第一项
- 第二项
  - 嵌套项目
  - 另一个嵌套项目
    - 更深层的嵌套
- 第三项

### 有序列表
1. 第一步
2. 第二步
   1. 子步骤 A
   2. 子步骤 B
3. 第三步

### 任务列表
- [x] 已完成的任务
- [ ] 待完成的任务
- [x] 另一个已完成的任务
- [ ] 重要的待办事项

## 链接和图片

### 链接
- [普通链接](https://example.com)
- [带标题的链接](https://example.com "这是链接标题")
- 自动链接: https://github.com

### 图片
![示例图片](https://reactnative.dev/img/tiny_logo.png)

## 代码

### 行内代码
使用 \`console.log('Hello World')\` 来输出信息。

### 代码块

\`\`\`javascript
// JavaScript 示例
function greetUser(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return message;
}

// 调用函数
greetUser('Markdown用户');
\`\`\`

\`\`\`python
# Python 示例
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

# 计算斐波那契数列
for i in range(10):
    print(f"F({i}) = {calculate_fibonacci(i)}")
\`\`\`

\`\`\`css
/* CSS 示例 */
.markdown-editor {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}
\`\`\`

## 表格

| 功能 | 支持状态 | 描述 |
|------|----------|------|
| 标题 | ✅ 完全支持 | H1-H6 所有级别 |
| 文本格式 | ✅ 完全支持 | 粗体、斜体、删除线等 |
| 列表 | ✅ 完全支持 | 有序、无序、任务列表 |
| 链接 | ✅ 完全支持 | 内联和引用式链接 |
| 图片 | ✅ 完全支持 | 支持 alt 文本和标题 |
| 代码 | ✅ 完全支持 | 行内代码和代码块 |
| 表格 | ✅ 完全支持 | 支持对齐和格式化 |
| 引用 | ✅ 完全支持 | 单行和多行引用 |
| 数学公式 | ✅ 完全支持 | LaTeX 风格的数学表达式 |

### 表格对齐

| 左对齐 | 居中对齐 | 右对齐 |
|:-------|:--------:|-------:|
| 内容1  |   内容2   |  内容3 |
| 较长的内容 | 中等内容 | 短内容 |

## 引用

> 这是一个简单的引用。

> 这是一个多行引用的示例。
> 
> 引用可以包含其他 Markdown 元素：
> 
> - 列表项目
> - **粗体文本**
> - [链接](https://example.com)
> 
> > 这是嵌套引用

## 数学公式

### 行内数学
爱因斯坦的质能方程：$E = mc^2$

圆的面积公式：$A = \\pi r^2$

### 块级数学

$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n
$$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\begin{pmatrix}
x \\\\
y
\\end{pmatrix}
=
\\begin{pmatrix}
ax + by \\\\
cx + dy
\\end{pmatrix}
$$

## 分割线

使用三个或更多的连字符、星号或下划线创建分割线：

---

***

___

## 高级功能

### 转义字符
使用反斜杠转义特殊字符：\\*不是斜体\\*，\\[不是链接\\]

### HTML 支持
<details>
<summary>点击展开详细信息</summary>

这里是隐藏的内容，只有点击上面的摘要才会显示。

</details>

### 脚注
这里有一个脚注引用[^1]，还有另一个[^note]。

[^1]: 这是第一个脚注的内容。
[^note]: 这是命名脚注的内容。

## 移动端优化

我们的 Markdown 编辑器针对移动设备进行了特别优化：

- **实时预览**：输入时即时显示渲染结果
- **性能优化**：防抖更新，流畅的输入体验
- **语法高亮**：编辑器中的 Markdown 语法着色
- **响应式布局**：适配不同屏幕尺寸
- **智能工具栏**：快速插入常用 Markdown 元素
- **自动保存**：防止内容丢失
- **主题支持**：深色和浅色主题

## 使用建议

1. **开始简单**：从基本的标题和段落开始
2. **逐步学习**：每次尝试一种新的 Markdown 元素
3. **使用预览**：随时查看渲染效果
4. **善用工具栏**：使用工具栏快速插入复杂元素
5. **保持一致**：在整个文档中使用一致的格式风格

---

这个演示展示了我们 Markdown 编辑器的强大功能。开始创作你的内容吧！`;

const MarkdownFeatureDemo = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [content, setContent] = useState(DEMO_CONTENT);
  const [showDemo, setShowDemo] = useState(true);

  const handleReset = () => {
    setContent(DEMO_CONTENT);
  };

  const handleClear = () => {
    setContent('');
  };

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Markdown 功能演示</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={styles.resetButtonText}>重置演示</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
          >
            <Text style={styles.clearButtonText}>清空内容</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MarkdownEditorIntegration
        value={content}
        onChange={setContent}
        style={styles.editor}
        placeholder="开始输入你的 Markdown 内容..."
        showPreview={true}
        viewMode="split"
        enablePerformanceMode={true}
        enableFullscreen={true}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 提示：使用工具栏快速插入 Markdown 元素，或切换到预览模式查看渲染效果
        </Text>
      </View>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: colors.primary,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  clearButton: {
    backgroundColor: colors.border,
  },
  clearButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  editor: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default MarkdownFeatureDemo;
