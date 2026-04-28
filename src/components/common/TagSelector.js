/**
 * 标签选择器组件
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { dimensions } from '../../utils/constants/dimensions';

/**
 * 标签选择器组件
 * @param {Array} selectedTags - 已选择的标签数组
 * @param {function} onTagsChange - 标签变化回调
 * @param {Array} availableTags - 可用的标签列表
 * @param {boolean} canCreate - 是否可以创建新标签
 * @param {function} onCreateTag - 创建新标签回调
 * @param {object} style - 自定义样式
 */
const TagSelector = ({
  selectedTags = [],
  onTagsChange,
  availableTags = [],
  canCreate = true,
  onCreateTag,
  style,
}) => {
  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [localSelectedTags, setLocalSelectedTags] = useState([]);

  // 初始化本地选中标签
  useEffect(() => {
    setLocalSelectedTags(selectedTags);
  }, [selectedTags]);

  // 过滤标签
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 切换标签选择状态
  const toggleTag = (tag) => {
    let newSelectedTags;
    if (localSelectedTags.some(t => t.id === tag.id)) {
      newSelectedTags = localSelectedTags.filter(t => t.id !== tag.id);
    } else {
      newSelectedTags = [...localSelectedTags, tag];
    }
    setLocalSelectedTags(newSelectedTags);
  };

  // 移除标签
  const removeTag = (tagId) => {
    const newTags = localSelectedTags.filter(tag => tag.id !== tagId);
    setLocalSelectedTags(newTags);
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  // 创建新标签
  const handleCreateTag = () => {
    if (!newTagName.trim()) {return;}

    if (onCreateTag) {
      onCreateTag(newTagName.trim())
        .then(newTag => {
          const updatedTags = [...localSelectedTags, newTag];
          setLocalSelectedTags(updatedTags);
          if (onTagsChange) {
            onTagsChange(updatedTags);
          }
          setNewTagName('');
        })
        .catch(error => {
          console.error('创建标签失败:', error);
        });
    }
  };

  // 确认选择
  const confirmSelection = () => {
    if (onTagsChange) {
      onTagsChange(localSelectedTags);
    }
    setIsModalVisible(false);
  };

  // 渲染标签项
  const renderTagItem = ({ item }) => {
    const isSelected = localSelectedTags.some(tag => tag.id === item.id);
    return (
      <TouchableOpacity
        style={[dynamicStyles.tagItem, isSelected && dynamicStyles.selectedTagItem]}
        onPress={() => toggleTag(item)}
      >
        <Text style={[dynamicStyles.tagItemText, isSelected && dynamicStyles.selectedTagItemText]}>
          {item.name}
        </Text>
        {isSelected && (
          <Icon name="check" size={16} color={colors.white} style={dynamicStyles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[dynamicStyles.container, style]}>
      {/* 已选标签显示区域 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={dynamicStyles.selectedTagsContainer}
        contentContainerStyle={dynamicStyles.selectedTagsContent}
      >
        {localSelectedTags.map(tag => (
          <View key={tag.id} style={dynamicStyles.selectedTag}>
            <Text style={dynamicStyles.selectedTagText}>{tag.name}</Text>
            <TouchableOpacity
              style={dynamicStyles.removeTagButton}
              onPress={() => removeTag(tag.id)}
            >
              <Icon name="close" size={14} color={colors.white} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={dynamicStyles.addTagButton}
          onPress={() => setIsModalVisible(true)}
        >
          <Icon name="add" size={20} color={colors.primary} />
          <Text style={dynamicStyles.addTagText}>添加标签</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 标签选择模态框 */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>选择标签</Text>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={dynamicStyles.closeButton}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.searchContainer}>
              <Icon name="search" size={20} color={colors.textLight} style={dynamicStyles.searchIcon} />
              <TextInput
                style={dynamicStyles.searchInput}
                placeholder="搜索标签"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <FlatList
              data={filteredTags}
              renderItem={renderTagItem}
              keyExtractor={item => item.id.toString()}
              style={dynamicStyles.tagList}
              contentContainerStyle={dynamicStyles.tagListContent}
              numColumns={2}
            />

            {canCreate && (
              <View style={dynamicStyles.createTagContainer}>
                <TextInput
                  style={dynamicStyles.createTagInput}
                  placeholder="创建新标签"
                  value={newTagName}
                  onChangeText={setNewTagName}
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity
                  style={[dynamicStyles.createTagButton, !newTagName.trim() && dynamicStyles.disabledButton]}
                  onPress={handleCreateTag}
                  disabled={!newTagName.trim()}
                >
                  <Text style={dynamicStyles.createTagButtonText}>创建</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={dynamicStyles.confirmButton}
              onPress={confirmSelection}
            >
              <Text style={dynamicStyles.confirmButtonText}>确认</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    width: '100%',
  },
  selectedTagsContainer: {
    flexDirection: 'row',
    marginBottom: dimensions.spacing.small,
  },
  selectedTagsContent: {
    paddingVertical: dimensions.spacing.small,
    paddingHorizontal: dimensions.spacing.small,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: dimensions.borderRadius.small,
    paddingVertical: dimensions.spacing.tiny,
    paddingHorizontal: dimensions.spacing.small,
    marginRight: dimensions.spacing.small,
  },
  selectedTagText: {
    color: colors.white,
    fontSize: 14,
    marginRight: dimensions.spacing.tiny,
  },
  removeTagButton: {
    padding: 2,
  },
  addTagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: dimensions.borderRadius.small,
    paddingVertical: dimensions.spacing.tiny,
    paddingHorizontal: dimensions.spacing.small,
  },
  addTagText: {
    color: colors.primary,
    fontSize: 14,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: dimensions.borderRadius.large,
    borderTopRightRadius: dimensions.borderRadius.large,
    paddingBottom: dimensions.spacing.large + (dimensions.isIOS ? dimensions.safeAreaBottom : 0),
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: dimensions.spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: dimensions.spacing.small,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: dimensions.borderRadius.small,
    margin: dimensions.spacing.medium,
    paddingHorizontal: dimensions.spacing.small,
  },
  searchIcon: {
    marginRight: dimensions.spacing.small,
  },
  searchInput: {
    flex: 1,
    paddingVertical: dimensions.spacing.medium,
    color: colors.text,
  },
  tagList: {
    flex: 1,
  },
  tagListContent: {
    padding: dimensions.spacing.medium,
  },
  tagItem: {
    flex: 1,
    margin: dimensions.spacing.small,
    padding: dimensions.spacing.medium,
    backgroundColor: colors.cardBackground,
    borderRadius: dimensions.borderRadius.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTagItem: {
    backgroundColor: colors.primary,
  },
  tagItemText: {
    color: colors.text,
    fontSize: 14,
  },
  selectedTagItemText: {
    color: colors.white,
  },
  checkIcon: {
    marginLeft: dimensions.spacing.small,
  },
  createTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: dimensions.spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createTagInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: dimensions.borderRadius.small,
    paddingHorizontal: dimensions.spacing.medium,
    paddingVertical: dimensions.spacing.medium,
    color: colors.text,
    marginRight: dimensions.spacing.medium,
  },
  createTagButton: {
    backgroundColor: colors.primary,
    borderRadius: dimensions.borderRadius.small,
    paddingVertical: dimensions.spacing.small,
    paddingHorizontal: dimensions.spacing.medium,
  },
  disabledButton: {
    backgroundColor: colors.disabled,
  },
  createTagButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: dimensions.borderRadius.small,
    padding: dimensions.spacing.medium,
    margin: dimensions.spacing.medium,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  selectedTagsContainer: {},
  selectedTagsContent: {},
  selectedTag: {},
  selectedTagText: {},
  removeTagButton: {},
  addTagButton: {},
  addTagText: {},
  modalContainer: {},
  modalContent: {},
  modalHeader: {},
  modalTitle: {},
  closeButton: {},
  searchContainer: {},
  searchIcon: {},
  searchInput: {},
  tagList: {},
  tagListContent: {},
  tagItem: {},
  selectedTagItem: {},
  tagItemText: {},
  selectedTagItemText: {},
  checkIcon: {},
  createTagContainer: {},
  createTagInput: {},
  createTagButton: {},
  disabledButton: {},
  createTagButtonText: {},
  confirmButton: {},
  confirmButtonText: {},
});

export default TagSelector;
