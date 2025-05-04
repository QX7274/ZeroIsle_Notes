# 代码编辑器组件

本目录包含与代码编辑器功能相关的组件。

## 组件列表

### CodeEditor

代码编辑器组件，提供代码编辑功能。

**主要功能**：
- 支持语法高亮
- 支持代码补全
- 支持行号显示
- 支持代码折叠
- 支持查找和替换

### CodeRunner

代码运行器组件，用于运行和测试代码。

**主要功能**：
- 支持多种编程语言
- 显示运行结果
- 显示错误信息
- 支持输入参数

### LanguageSelector

语言选择器组件，用于选择编程语言。

**主要功能**：
- 显示支持的编程语言列表
- 支持语言切换
- 显示语言图标

### CodeSnippet

代码片段组件，用于显示只读的代码片段。

**主要功能**：
- 支持语法高亮
- 支持复制代码
- 支持行号显示
- 支持代码折叠

### ThemeSelector

主题选择器组件，用于选择代码编辑器的主题。

**主要功能**：
- 显示可用的主题列表
- 支持主题预览
- 支持主题切换

## 使用方法

```javascript
import { CodeEditor, LanguageSelector, ThemeSelector } from '../components/code';

function CodeEditorScreen() {
  const [code, setCode] = useState('console.log("Hello, World!");');
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');
  
  return (
    <View style={styles.container}>
      <LanguageSelector
        language={language}
        onLanguageChange={setLanguage}
      />
      
      <ThemeSelector
        theme={theme}
        onThemeChange={setTheme}
      />
      
      <CodeEditor
        code={code}
        language={language}
        theme={theme}
        onCodeChange={setCode}
      />
    </View>
  );
}
```
