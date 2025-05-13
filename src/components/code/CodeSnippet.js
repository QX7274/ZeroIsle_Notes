/**
 * 代码片段组件
 * 用于显示只读的代码片段，支持语法高亮
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Clipboard,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { vs2015, github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { analyticsService } from '../../services/analytics/analyticsService';

/**
 * 代码片段组件
 * @param {string} code - 代码内容
 * @param {string} language - 编程语言
 * @param {string} theme - 主题 ('light' 或 'dark')
 * @param {boolean} showLineNumbers - 是否显示行号
 * @param {boolean} showCopyButton - 是否显示复制按钮
 * @param {boolean} showLanguageLabel - 是否显示语言标签
 * @param {string} title - 代码片段标题
 * @param {object} style - 自定义样式
 */
const CodeSnippet = ({
  code,
  language = 'javascript',
  theme: initialTheme = 'dark',
  showLineNumbers = true,
  showCopyButton = true,
  showLanguageLabel = true,
  title,
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;
  
  // 状态
  const [editorTheme, setEditorTheme] = useState(initialTheme);
  const [copied, setCopied] = useState(false);
  
  // 复制代码
  const copyCode = () => {
    Clipboard.setString(code);
    setCopied(true);
    
    // 记录分析事件
    analyticsService.trackCodeAction('copy_snippet', { language });
    
    // 2秒后重置复制状态
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  
  // 切换主题
  const toggleTheme = () => {
    const newTheme = editorTheme === 'dark' ? 'light' : 'dark';
    setEditorTheme(newTheme);
    
    // 记录分析事件
    analyticsService.trackCodeAction('toggle_snippet_theme', { 
      language, 
      theme: newTheme 
    });
  };
  
  // 获取语言显示名称
  const getLanguageDisplayName = () => {
    const languageMap = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'c': 'C',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'go': 'Go',
      'rust': 'Rust',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'html': 'HTML',
      'css': 'CSS',
      'sql': 'SQL',
      'json': 'JSON',
      'xml': 'XML',
      'markdown': 'Markdown',
      'bash': 'Bash',
      'shell': 'Shell',
    };
    
    return languageMap[language.toLowerCase()] || language;
  };
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: editorTheme === 'dark' ? '#0d1117' : '#ffffff',
          borderColor: editorTheme === 'dark' ? '#30363d' : '#d0d7de',
        },
        style,
      ]}
    >
      {/* 标题栏 */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: editorTheme === 'dark' ? '#161b22' : '#f6f8fa',
            borderBottomColor: editorTheme === 'dark' ? '#30363d' : '#d0d7de',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          {title && (
            <Text
              variant="body"
              size="small"
              style={{
                color: editorTheme === 'dark' ? '#c9d1d9' : '#24292f',
                fontWeight: '500',
                marginRight: 8,
              }}
            >
              {title}
            </Text>
          )}
          
          {showLanguageLabel && (
            <View
              style={[
                styles.languageLabel,
                {
                  backgroundColor: editorTheme === 'dark' ? '#238636' : '#2da44e',
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: '500',
                }}
              >
                {getLanguageDisplayName()}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggleTheme}
          >
            <Icon
              name={editorTheme === 'dark' ? 'light-mode' : 'dark-mode'}
              size={18}
              color={editorTheme === 'dark' ? '#8b949e' : '#57606a'}
            />
          </TouchableOpacity>
          
          {showCopyButton && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={copyCode}
            >
              <Icon
                name={copied ? 'check' : 'content-copy'}
                size={18}
                color={
                  copied
                    ? '#2da44e'
                    : editorTheme === 'dark'
                    ? '#8b949e'
                    : '#57606a'
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* 代码内容 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.codeScrollView}
      >
        <SyntaxHighlighter
          language={language || 'javascript'}
          style={editorTheme === 'dark' ? vs2015 : github}
          showLineNumbers={showLineNumbers}
          customStyle={styles.syntaxHighlighter}
          fontSize={14}
          fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
        >
          {code || '// 空代码片段'}
        </SyntaxHighlighter>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 4,
    marginLeft: 8,
  },
  languageLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  codeScrollView: {
    maxHeight: 400,
  },
  syntaxHighlighter: {
    margin: 0,
    padding: 12,
    backgroundColor: 'transparent',
  },
});

export default CodeSnippet;
