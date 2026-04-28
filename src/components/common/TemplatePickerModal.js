import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * 模板选择模态框
 * 用于选择笔记模板并创建新笔记
 */
const TemplatePickerModal = ({ visible, onClose, onSelectTemplate }) => {
  const { colors } = useTheme();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  // 默认模板列表
  const defaultTemplates = [
    {
      id: 'blank',
      title: '空白笔记',
      description: '创建一个空白笔记',
      icon: 'note',
      color: '#2196F3',
      content: '',
    },
    {
      id: 'meeting',
      title: '会议纪要',
      description: '记录会议要点和决议',
      icon: 'group',
      color: '#FF9800',
      content: `# 会议纪要

**日期**: {{date}}
**参与人**: 
**地点**: 

## 议程

1. 

## 讨论要点

- 

## 决议

- 

## 后续行动

| 任务 | 负责人 | 截止日期 |
|------|--------|---------|
|  |  |  |
`,
    },
    {
      id: 'todo',
      title: '待办清单',
      description: '管理任务和待办事项',
      icon: 'check-box',
      color: '#4CAF50',
      content: `# 待办清单

## 今日任务

- [ ] 
- [ ] 
- [ ] 

## 本周任务

- [ ] 
- [ ] 

## 优先级

### 高优先级
- [ ] 

### 中优先级
- [ ] 

### 低优先级
- [ ] 
`,
    },
    {
      id: 'diary',
      title: '日记模板',
      description: '记录日常生活和感想',
      icon: 'book',
      color: '#E91E63',
      content: `# 日记 - {{date}}

## 今日总结

### 发生的事
- 

### 感受和思考
- 

### 收获和学习
- 

## 明天计划

- 

## 心情指数
😊 😐 😢
`,
    },
    {
      id: 'project',
      title: '项目计划',
      description: '规划项目目标和任务',
      icon: 'assignment',
      color: '#9C27B0',
      content: `# 项目计划

**项目名称**: 
**开始日期**: {{date}}
**预期完成日期**: 
**项目负责人**: 

## 项目目标

1. 
2. 
3. 

## 主要任务

### 阶段1
- [ ] 
- [ ] 

### 阶段2
- [ ] 
- [ ] 

## 资源需求

- 人力: 
- 预算: 
- 工具: 

## 风险评估

| 风险 | 影响 | 应对措施 |
|------|------|--------|
|  |  |  |
`,
    },
    {
      id: 'brainstorm',
      title: '头脑风暴',
      description: '创意发散和想法整理',
      icon: 'lightbulb',
      color: '#FFC107',
      content: `# 头脑风暴 - {{date}}

## 主题
- 

## 初步想法

### 想法1
- 

### 想法2
- 

### 想法3
- 

## 可行性分析

| 想法 | 优点 | 缺点 | 可行性 |
|------|------|------|--------|
|  |  |  |  |

## 下一步行动

- 
`,
    },
  ];

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // 这里可以从API加载模板，暂时使用默认模板
      setTemplates(defaultTemplates);
      setSelectedTemplate(defaultTemplates[0]);
    } catch (error) {
      console.error('加载模板失败:', error);
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = () => {
    if (!selectedTemplate) {
      return;
    }

    const template = {
      ...selectedTemplate,
      title: customTitle || selectedTemplate.title,
    };

    onSelectTemplate(template);
    setCustomTitle('');
    setSelectedTemplate(null);
  };

  const handleClose = () => {
    setCustomTitle('');
    setSelectedTemplate(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* 顶部标题栏 */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={handleClose}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            选择模板
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* 模板列表 */}
            <ScrollView
              style={styles.templateList}
              contentContainerStyle={styles.templateListContent}
            >
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateItem,
                    {
                      backgroundColor:
                        selectedTemplate?.id === template.id
                          ? colors.primary + '20'
                          : colors.surface,
                      borderColor:
                        selectedTemplate?.id === template.id
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <View
                    style={[
                      styles.templateIcon,
                      { backgroundColor: template.color },
                    ]}
                  >
                    <Icon name={template.icon} size={32} color="#fff" />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text
                      style={[styles.templateTitle, { color: colors.text }]}
                    >
                      {template.title}
                    </Text>
                    <Text
                      style={[
                        styles.templateDescription,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {template.description}
                    </Text>
                  </View>
                  {selectedTemplate?.id === template.id && (
                    <Icon name="check-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 自定义标题输入 */}
            {selectedTemplate && (
              <View
                style={[
                  styles.customTitleSection,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.customTitleLabel, { color: colors.text }]}>
                  自定义标题（可选）
                </Text>
                <TextInput
                  style={[
                    styles.customTitleInput,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="输入笔记标题"
                  placeholderTextColor={colors.textSecondary}
                  value={customTitle}
                  onChangeText={setCustomTitle}
                />
              </View>
            )}

            {/* 底部按钮 */}
            <View
              style={[
                styles.footer,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  { backgroundColor: colors.background },
                ]}
                onPress={handleClose}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  取消
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: selectedTemplate ? 1 : 0.5,
                  },
                ]}
                onPress={handleSelectTemplate}
                disabled={!selectedTemplate}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>
                  创建笔记
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateList: {
    flex: 1,
  },
  templateListContent: {
    padding: 16,
    gap: 12,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    gap: 12,
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 13,
  },
  customTitleSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  customTitleLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  customTitleInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TemplatePickerModal;

