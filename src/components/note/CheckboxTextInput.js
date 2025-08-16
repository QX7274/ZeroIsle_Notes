import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * 支持复选框功能的文本输入组件
 */
const CheckboxTextInput = ({ 
  value, 
  onChangeText, 
  placeholder = '开始输入内容...',
  multiline = true,
  style,
  ...props 
}) => {
  const { colors } = useTheme();
  const [processedText, setProcessedText] = useState('');
  const [checkboxItems, setCheckboxItems] = useState([]);

  // 处理文本中的复选框
  useEffect(() => {
    if (value) {
      const lines = value.split('\n');
      const items = [];
      let processedLines = [];

      lines.forEach((line, index) => {
        // 检测复选框模式：□ 或 ☑ 或 ✓ 或 ×
        const checkboxMatch = line.match(/^(□|☑|✓|×)\s*(.*)$/);
        if (checkboxMatch) {
          const [, checkbox, text] = checkboxMatch;
          const isChecked = checkbox === '☑' || checkbox === '✓';
          const isCanceled = checkbox === '×';
          
          items.push({
            index,
            text: text.trim(),
            isChecked,
            isCanceled,
            originalLine: line,
          });
          
          // 替换为可点击的组件占位符
          processedLines.push(`__CHECKBOX_${index}__`);
        } else {
          processedLines.push(line);
        }
      });

      setCheckboxItems(items);
      setProcessedText(processedLines.join('\n'));
    } else {
      setProcessedText('');
      setCheckboxItems([]);
    }
  }, [value]);

  // 切换复选框状态
  const toggleCheckbox = (itemIndex) => {
    const item = checkboxItems.find(item => item.index === itemIndex);
    if (!item) return;

    let newCheckbox;
    if (item.isChecked) {
      newCheckbox = '×'; // 已完成 -> 取消
    } else if (item.isCanceled) {
      newCheckbox = '□'; // 取消 -> 未完成
    } else {
      newCheckbox = '☑'; // 未完成 -> 已完成
    }

    // 更新原始文本
    const lines = value.split('\n');
    lines[itemIndex] = `${newCheckbox} ${item.text}`;
    const newValue = lines.join('\n');
    
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
};

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
