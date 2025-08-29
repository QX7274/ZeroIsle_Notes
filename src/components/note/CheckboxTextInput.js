import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * 支持复选框的文本输入组件
 * 支持多种卡片类型：待办事项、笔记、提醒等
 */
const CheckboxTextInput = React.forwardRef(({
  value = '',
  onChangeText,
  placeholder = '输入内容...',
  style,
  multiline = true,
  editable = true,
  cardType = 'note', // 'todo', 'note', 'reminder', 'important'
  onCardTypeChange,
  ...props
}, ref) => {
  const { colors } = useTheme();
  const [localValue, setLocalValue] = useState(value);
  const [parsedContent, setParsedContent] = useState([]);
  const textInputRef = useRef(null);

  // 同步外部value变化
  useEffect(() => {
    setLocalValue(value);
    setParsedContent(parseContent(value));
  }, [value, cardType]);

  // 处理文本变化
  const handleTextChange = (text) => {
    setLocalValue(text);
    setParsedContent(parseContent(text));
    if (onChangeText) {
      onChangeText(text);
    }
  };

  // 解析不同类型的内容
  const parseContent = (text) => {
    if (!text) return [];

    const lines = text.split('\n');
    return lines.map((line, index) => {
      // 待办事项格式：- [ ] 或 - [x]
      const todoMatch = line.match(/^(\s*)(- \[[ x]\])\s*(.*)$/);
      if (todoMatch && cardType === 'todo') {
        const [, indent, checkbox, content] = todoMatch;
        const isChecked = checkbox.includes('x');
        return {
          type: 'todo',
          indent,
          isChecked,
          content: content.trim(),
          originalLine: line,
          lineIndex: index
        };

      // 重要标记格式：! 内容
      const importantMatch = line.match(/^(\s*)(!)\s*(.*)$/);
      if (importantMatch && cardType === 'important') {
        return {
          type: 'important',
          content: importantMatch[3].trim(),
          originalLine: line,
          lineIndex: index
        };
      }

      // 提醒格式：@ 时间 内容
      const reminderMatch = line.match(/^(\s*)(@)\s*(.*)$/);
      if (reminderMatch && cardType === 'reminder') {
        return {
          type: 'reminder',
          content: reminderMatch[3].trim(),
          originalLine: line,
          lineIndex: index
        };
      }

      // 普通文本
      return {
        type: 'text',
        content: line,
        originalLine: line,
        lineIndex: index
      };
    });
  };

  // 切换待办事项状态
  const toggleTodo = (lineIndex) => {
    const lines = localValue.split('\n');
    const line = lines[lineIndex];

    if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]')) {
      lines[lineIndex] = line.replace('- [x]', '- [ ]');
    }

    const newValue = lines.join('\n');
    handleTextChange(newValue);
    
    onChangeText(newValue);
  };

  // 渲染复选框项目
  const renderCheckboxItem = (item) => {
    const { index, text, isChecked, isCanceled } = item;
    
    let iconName, iconColor, textStyle;
    if (isChecked) {
      iconName = 'check-box';
      iconColor = colors.primary;
      textStyle = { textDecorationLine: 'line-through', color: colors.textSecondary };
    } else if (isCanceled) {
      iconName = 'cancel';
      iconColor = colors.error;
      textStyle = { textDecorationLine: 'line-through', color: colors.error };
    } else {
      iconName = 'check-box-outline-blank';
      iconColor = colors.textSecondary;
      textStyle = { color: colors.text };
    }

    return (
      <TouchableOpacity
        key={`checkbox-${index}`}
        style={styles.checkboxItem}
        onPress={() => toggleCheckbox(index)}
        activeOpacity={0.7}
      >
        <Icon name={iconName} size={20} color={iconColor} />
        <Text style={[styles.checkboxText, textStyle]}>
          {text || '点击编辑...'}
        </Text>
      </TouchableOpacity>
    );
  };

  // 渲染混合内容
  const renderContent = () => {
    if (checkboxItems.length === 0) {
      // 没有复选框，直接显示TextInput
      return (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          style={[styles.textInput, { color: colors.text }, style]}
          placeholderTextColor={colors.textSecondary}
          {...props}
        />
      );
    }

    // 有复选框，需要混合渲染
    const lines = processedText.split('\n');
    const elements = [];

    lines.forEach((line, index) => {
      const checkboxMatch = line.match(/^__CHECKBOX_(\d+)__$/);
      if (checkboxMatch) {
        const itemIndex = parseInt(checkboxMatch[1]);
        const item = checkboxItems.find(item => item.index === itemIndex);
        if (item) {
          elements.push(renderCheckboxItem(item));
        }
      } else if (line.trim()) {
        elements.push(
          <Text key={`text-${index}`} style={[styles.normalText, { color: colors.text }]}>
            {line}
          </Text>
        );
      }
    });

    return (
      <View style={styles.mixedContent}>
        {elements}
        <TextInput
          value=""
          onChangeText={(text) => {
            // 在末尾添加新内容
            const newValue = value ? `${value}\n${text}` : text;
            onChangeText(newValue);
          }}
          placeholder="继续输入..."
          multiline={multiline}
          style={[styles.textInput, { color: colors.text }, style]}
          placeholderTextColor={colors.textSecondary}
          {...props}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderContent()}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 100,
  },
  mixedContent: {
    flex: 1,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  checkboxText: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 8,
    flex: 1,
  },
  normalText: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 2,
  },
});

export default CheckboxTextInput;
