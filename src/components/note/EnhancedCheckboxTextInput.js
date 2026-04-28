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
 * 增强的复选框文本输入组件
 * 支持多种卡片类型：待办事项、笔记、提醒等
 */
const EnhancedCheckboxTextInput = React.forwardRef(({
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
    if (!text) {return [];}

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
          lineIndex: index,
        };
      }

      // 重要标记格式：! 内容
      const importantMatch = line.match(/^(\s*)(!)\s*(.*)$/);
      if (importantMatch && cardType === 'important') {
        return {
          type: 'important',
          content: importantMatch[3].trim(),
          originalLine: line,
          lineIndex: index,
        };
      }

      // 提醒格式：@ 时间 内容
      const reminderMatch = line.match(/^(\s*)(@)\s*(.*)$/);
      if (reminderMatch && cardType === 'reminder') {
        return {
          type: 'reminder',
          content: reminderMatch[3].trim(),
          originalLine: line,
          lineIndex: index,
        };
      }

      // 普通文本
      return {
        type: 'text',
        content: line,
        originalLine: line,
        lineIndex: index,
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
  };

  // 添加新项目
  const addNewItem = () => {
    let newItem = '';
    switch (cardType) {
      case 'todo':
        newItem = '\n- [ ] ';
        break;
      case 'important':
        newItem = '\n! ';
        break;
      case 'reminder':
        newItem = '\n@ ';
        break;
      default:
        newItem = '\n';
    }

    const newValue = localValue + newItem;
    handleTextChange(newValue);

    // 聚焦到文本输入框末尾
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.setSelection(newValue.length, newValue.length);
      }
    }, 100);
  };

  // 删除项目
  const deleteItem = (lineIndex) => {
    const lines = localValue.split('\n');
    lines.splice(lineIndex, 1);
    const newValue = lines.join('\n');
    handleTextChange(newValue);
  };

  // 渲染待办事项切换按钮
  const renderTodoToggle = () => {
    return (
      <TouchableOpacity
        style={[
          styles.todoToggleButton,
          {
            backgroundColor: cardType === 'todo' ? '#4CAF50' + '20' : colors.surface,
            borderColor: cardType === 'todo' ? '#4CAF50' : colors.outline,
          },
        ]}
        onPress={() => {
          const newType = cardType === 'todo' ? 'note' : 'todo';
          if (onCardTypeChange) {
            onCardTypeChange(newType);
          }
        }}
      >
        <Icon
          name={cardType === 'todo' ? 'check-box' : 'check-box-outline-blank'}
          size={16}
          color={cardType === 'todo' ? '#4CAF50' : colors.onSurfaceVariant}
        />
        <Text
          style={[
            styles.todoToggleLabel,
            {
              color: cardType === 'todo' ? '#4CAF50' : colors.onSurfaceVariant,
              fontWeight: cardType === 'todo' ? '600' : '400',
            },
          ]}
        >
          {cardType === 'todo' ? '待办模式' : '普通模式'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 待办事项切换按钮 */}
      {renderTodoToggle()}

      {/* 文本输入区域 */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={(input) => {
            textInputRef.current = input;
            if (ref) {
              if (typeof ref === 'function') {
                ref(input);
              } else {
                ref.current = input;
              }
            }
          }}
          style={[
            styles.textInput,
            {
              color: colors.onSurface,
              backgroundColor: colors.surface,
              borderColor: colors.outline,
            },
          ]}
          value={localValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          multiline={multiline}
          editable={editable}
          textAlignVertical="top"
          {...props}
        />

        {/* 快捷操作按钮 */}
        {cardType !== 'note' && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={addNewItem}
          >
            <Icon name="add" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  todoToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  todoToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    minHeight: 120,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  addButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

export default EnhancedCheckboxTextInput;
