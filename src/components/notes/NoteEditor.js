/**
 * 笔记编辑器组件
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Button, Input } from '../common';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 笔记编辑器组件
 * @param {Object} note - 笔记对象
 * @param {Function} onSave - 保存回调
 * @param {Function} onCancel - 取消回调
 * @param {Array} categories - 分类列表
 * @param {Array} tags - 标签列表
 * @param {boolean} loading - 是否正在加载
 */
const NoteEditor = ({
  note = {},
  onSave,
  onCancel,
  categories = [],
  tags = [],
  loading = false,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 内容输入框引用
  const contentInputRef = useRef(null);

  // 本地状态
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [selectedCategory, setSelectedCategory] = useState(note.category_id || null);
  const [selectedTags, setSelectedTags] = useState(note.tags || []);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [template, setTemplate] = useState(note.template || 'blank');

  // 初始化状态
  useEffect(() => {
    setTitle(note.title || '');
    setContent(note.content || '');
    setSelectedCategory(note.category_id || null);
    setSelectedTags(note.tags || []);
    setTemplate(note.template || 'blank');
  }, [note]);

  // 处理保存
  const handleSave = () => {
    // 验证标题
    if (!title.trim()) {
      Alert.alert('提示', '请输入笔记标题');
      return;
    }

    // 构建笔记对象
    const updatedNote = {
      ...note,
      title: title.trim(),
      content: content.trim(),
      category_id: selectedCategory,
      tags: selectedTags,
      template: template,
      type: note.type || 'note',
    };

    // 调用保存回调
    onSave && onSave(updatedNote);
  };

  // 处理取消
  const handleCancel = () => {
    onCancel && onCancel();
  };

  // 处理选择分类
  const handleSelectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowCategoryPicker(false);
  };

  // 处理选择标签
  const handleToggleTag = (tagId) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  // 渲染分类选择器
  const renderCategoryPicker = () => {
    if (!showCategoryPicker) return null;

    return (
      <View style={[
        styles.pickerContainer,
        { backgroundColor: colors.card }
      ]}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.pickerTitle}
        >
          选择分类
        </Text>

        <ScrollView style={styles.pickerScrollView}>
          <TouchableOpacity
            style={[
              styles.pickerItem,
              !selectedCategory && styles.pickerItemSelected,
              !selectedCategory && { borderColor: colors.primary }
            ]}
            onPress={() => handleSelectCategory(null)}
          >
            <Text
              variant="body"
              size="medium"
              color={!selectedCategory ? 'primary' : undefined}
            >
              无分类
            </Text>
          </TouchableOpacity>

          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.pickerItem,
                selectedCategory === category.id && styles.pickerItemSelected,
                selectedCategory === category.id && { borderColor: colors.primary }
              ]}
              onPress={() => handleSelectCategory(category.id)}
            >
              <View style={styles.categoryItem}>
                <View
                  style={[
                    styles.categoryColor,
                    { backgroundColor: category.color || colors.primary }
                  ]}
                />
                <Text
                  variant="body"
                  size="medium"
                  color={selectedCategory === category.id ? 'primary' : undefined}
                >
                  {category.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Button
          title="关闭"
          onPress={() => setShowCategoryPicker(false)}
          type="outline"
          style={styles.pickerCloseButton}
        />
      </View>
    );
  };

  // 渲染模板选择器
  const renderTemplatePicker = () => {
    if (!showTemplatePicker) return null;

    const templateOptions = [
      { id: 'blank', name: '空白模板', icon: 'description' },
      { id: 'lined', name: '横格模板', icon: 'subject' },
      { id: 'grid', name: '方格模板', icon: 'grid-on' },
      { id: 'checklist', name: '清单模板', icon: 'check-box' },
      { id: 'diary', name: '日记模板', icon: 'event-note' },
    ];

    return (
      <View style={[
        styles.pickerContainer,
        { backgroundColor: colors.card }
      ]}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.pickerTitle}
        >
          选择模板
        </Text>

        <ScrollView style={styles.pickerScrollView}>
          {templateOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.pickerItem,
                template === option.id && styles.pickerItemSelected,
                template === option.id && { borderColor: colors.primary }
              ]}
              onPress={() => {
                setTemplate(option.id);
                setShowTemplatePicker(false);
              }}
            >
              <Icon
                name={option.icon}
                size={20}
                color={template === option.id ? colors.primary : colors.text}
                style={styles.pickerItemIcon}
              />
              <Text
                variant="body"
                size="medium"
                color={template === option.id ? 'primary' : undefined}
              >
                {option.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.pickerButtonContainer}>
          <Button
            title="取消"
            onPress={() => setShowTemplatePicker(false)}
            type="outline"
            size="small"
            style={styles.pickerButton}
          />
        </View>
      </View>
    );
  };

  // 渲染标签选择器
  const renderTagPicker = () => {
    if (!showTagPicker) return null;

    return (
      <View style={[
        styles.pickerContainer,
        { backgroundColor: colors.card }
      ]}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.pickerTitle}
        >
          选择标签
        </Text>

        <ScrollView style={styles.pickerScrollView}>
          <View style={styles.tagsContainer}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.tagItem,
                  selectedTags.includes(tag.id) && styles.tagItemSelected,
                  selectedTags.includes(tag.id) && { backgroundColor: colors.primary }
                ]}
                onPress={() => handleToggleTag(tag.id)}
              >
                <Text
                  variant="body"
                  size="small"
                  color={selectedTags.includes(tag.id) ? 'card' : undefined}
                >
                  {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Button
          title="关闭"
          onPress={() => setShowTagPicker(false)}
          type="outline"
          style={styles.pickerCloseButton}
        />
      </View>
    );
  };

  // 获取当前选中的分类名称
  const getSelectedCategoryName = () => {
    if (!selectedCategory) return '无分类';
    const category = categories.find(c => c.id === selectedCategory);
    return category ? category.name : '无分类';
  };

  // 获取当前选中的标签名称
  const getSelectedTagsText = () => {
    if (selectedTags.length === 0) return '无标签';
    const selectedTagNames = selectedTags.map(tagId => {
      const tag = tags.find(t => t.id === tagId);
      return tag ? tag.name : '';
    }).filter(Boolean);
    return selectedTagNames.join(', ');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="标题"
          value={title}
          onChangeText={setTitle}
          placeholder="请输入笔记标题"
          size="large"
          returnKeyType="next"
          onSubmitEditing={() => contentInputRef.current?.focus()}
        />

        <Text
          variant="body"
          size="medium"
          bold
          style={styles.label}
        >
          内容
        </Text>

        <TextInput
          ref={contentInputRef}
          style={[
            styles.contentInput,
            {
              color: colors.text,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
            template === 'lined' && styles.linedTemplate,
            template === 'grid' && styles.gridTemplate,
            template === 'checklist' && styles.checklistTemplate,
            template === 'diary' && styles.diaryTemplate,
          ]}
          value={content}
          onChangeText={setContent}
          placeholder="请输入笔记内容"
          placeholderTextColor={colors.textHint}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.metadataContainer}>
          <TouchableOpacity
            style={[
              styles.metadataButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setShowTemplatePicker(true)}
          >
            <Icon name="style" size={20} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={styles.metadataText}
              numberOfLines={1}
            >
              {template === 'blank' ? '空白模板' :
               template === 'lined' ? '横格模板' :
               template === 'grid' ? '方格模板' :
               template === 'checklist' ? '清单模板' :
               template === 'diary' ? '日记模板' : '选择模板'}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metadataButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Icon name="folder" size={20} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={styles.metadataText}
              numberOfLines={1}
            >
              {getSelectedCategoryName()}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metadataButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setShowTagPicker(true)}
          >
            <Icon name="local-offer" size={20} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={styles.metadataText}
              numberOfLines={1}
            >
              {getSelectedTagsText()}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="保存"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            size="large"
          />

          <Button
            title="取消"
            onPress={handleCancel}
            type="outline"
            disabled={loading}
            style={styles.cancelButton}
            size="large"
          />
        </View>
      </ScrollView>

      {renderCategoryPicker()}
      {renderTagPicker()}
      {renderTemplatePicker()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  label: {
    marginBottom: 8,
  },
  contentInput: {
    minHeight: 200,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  linedTemplate: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 0,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    backgroundImage: null,
    lineHeight: 30,
    paddingTop: 8,
  },
  gridTemplate: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: '#fff',
    backgroundImage: null,
  },
  checklistTemplate: {
    borderWidth: 0,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontFamily: 'monospace',
    lineHeight: 24,
  },
  diaryTemplate: {
    borderWidth: 0,
    borderRadius: 8,
    backgroundColor: '#fff',
    lineHeight: 24,
    fontFamily: 'serif',
  },
  metadataContainer: {
    marginBottom: 24,
  },
  metadataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  metadataText: {
    flex: 1,
    marginHorizontal: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  saveButton: {
    flex: 1,
    marginRight: 8,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 8,
  },
  pickerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: '60%',
  },
  pickerTitle: {
    marginBottom: 16,
  },
  pickerScrollView: {
    marginBottom: 16,
  },
  pickerItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    marginBottom: 8,
  },
  pickerItemSelected: {
    borderWidth: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagItem: {
    padding: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagItemSelected: {
    borderWidth: 0,
  },
  pickerCloseButton: {
    alignSelf: 'center',
  },
});

export default NoteEditor;
