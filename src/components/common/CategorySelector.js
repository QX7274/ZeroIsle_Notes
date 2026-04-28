/**
 * 分类选择器组件
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { dimensions } from '../../utils/constants/dimensions';

/**
 * 分类选择器组件
 * @param {Object} selectedCategory - 已选择的分类
 * @param {function} onCategoryChange - 分类变化回调
 * @param {Array} availableCategories - 可用的分类列表
 * @param {boolean} canCreate - 是否可以创建新分类
 * @param {function} onCreateCategory - 创建新分类回调
 * @param {object} style - 自定义样式
 */
const CategorySelector = ({
  selectedCategory = null,
  onCategoryChange,
  availableCategories = [],
  canCreate = true,
  onCreateCategory,
  style,
}) => {
  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localSelectedCategory, setLocalSelectedCategory] = useState(null);

  // 初始化本地选中分类
  useEffect(() => {
    setLocalSelectedCategory(selectedCategory);
  }, [selectedCategory]);

  // 过滤分类
  const filteredCategories = availableCategories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 选择分类
  const selectCategory = (category) => {
    setLocalSelectedCategory(category);
  };

  // 创建新分类
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {return;}

    if (onCreateCategory) {
      onCreateCategory(newCategoryName.trim())
        .then(newCategory => {
          setLocalSelectedCategory(newCategory);
          setNewCategoryName('');
        })
        .catch(error => {
          console.error('创建分类失败:', error);
        });
    }
  };

  // 确认选择
  const confirmSelection = () => {
    if (onCategoryChange) {
      onCategoryChange(localSelectedCategory);
    }
    setIsModalVisible(false);
  };

  // 清除选择
  const clearSelection = () => {
    setLocalSelectedCategory(null);
    if (onCategoryChange) {
      onCategoryChange(null);
    }
  };

  // 渲染分类项
  const renderCategoryItem = ({ item }) => {
    const isSelected = localSelectedCategory && localSelectedCategory.id === item.id;
    return (
      <TouchableOpacity
        style={[dynamicStyles.categoryItem, isSelected && dynamicStyles.selectedCategoryItem]}
        onPress={() => selectCategory(item)}
      >
        <Text style={[dynamicStyles.categoryItemText, isSelected && dynamicStyles.selectedCategoryItemText]}>
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
      {/* 已选分类显示区域 */}
      <TouchableOpacity
        style={dynamicStyles.selectedCategoryContainer}
        onPress={() => setIsModalVisible(true)}
      >
        <View style={dynamicStyles.selectedCategoryContent}>
          <Icon name="folder" size={20} color={colors.secondary} style={dynamicStyles.folderIcon} />
          <Text style={dynamicStyles.selectedCategoryText}>
            {localSelectedCategory ? localSelectedCategory.name : '选择分类'}
          </Text>
        </View>
        {localSelectedCategory && (
          <TouchableOpacity
            style={dynamicStyles.clearButton}
            onPress={clearSelection}
          >
            <Icon name="close" size={16} color={colors.text} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* 分类选择模态框 */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>选择分类</Text>
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
                placeholder="搜索分类"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.textLight}
              />
            </View>

            <FlatList
              data={filteredCategories}
              renderItem={renderCategoryItem}
              keyExtractor={item => item.id.toString()}
              style={dynamicStyles.categoryList}
              contentContainerStyle={dynamicStyles.categoryListContent}
            />

            {canCreate && (
              <View style={dynamicStyles.createCategoryContainer}>
                <TextInput
                  style={dynamicStyles.createCategoryInput}
                  placeholder="创建新分类"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholderTextColor={colors.textLight}
                />
                <TouchableOpacity
                  style={[dynamicStyles.createCategoryButton, !newCategoryName.trim() && dynamicStyles.disabledButton]}
                  onPress={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                >
                  <Text style={dynamicStyles.createCategoryButtonText}>创建</Text>
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
    marginBottom: dimensions.spacing.medium,
  },
  selectedCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: dimensions.borderRadius.small,
    paddingVertical: dimensions.spacing.medium,
    paddingHorizontal: dimensions.spacing.medium,
    backgroundColor: colors.background,
  },
  selectedCategoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  folderIcon: {
    marginRight: dimensions.spacing.small,
  },
  selectedCategoryText: {
    color: colors.text,
    fontSize: 16,
  },
  clearButton: {
    padding: dimensions.spacing.small,
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
    height: '70%',
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
  categoryList: {
    flex: 1,
  },
  categoryListContent: {
    padding: dimensions.spacing.medium,
  },
  categoryItem: {
    padding: dimensions.spacing.medium,
    backgroundColor: colors.cardBackground,
    borderRadius: dimensions.borderRadius.small,
    marginBottom: dimensions.spacing.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCategoryItem: {
    backgroundColor: colors.secondary,
  },
  categoryItemText: {
    color: colors.text,
    fontSize: 16,
  },
  selectedCategoryItemText: {
    color: colors.white,
  },
  checkIcon: {
    marginLeft: dimensions.spacing.small,
  },
  createCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: dimensions.spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createCategoryInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: dimensions.borderRadius.small,
    paddingHorizontal: dimensions.spacing.medium,
    paddingVertical: dimensions.spacing.medium,
    color: colors.text,
    marginRight: dimensions.spacing.medium,
  },
  createCategoryButton: {
    backgroundColor: colors.secondary,
    borderRadius: dimensions.borderRadius.small,
    paddingVertical: dimensions.spacing.small,
    paddingHorizontal: dimensions.spacing.medium,
  },
  disabledButton: {
    backgroundColor: colors.disabled,
  },
  createCategoryButtonText: {
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
  selectedCategoryContainer: {},
  selectedCategoryContent: {},
  folderIcon: {},
  selectedCategoryText: {},
  clearButton: {},
  modalContainer: {},
  modalContent: {},
  modalHeader: {},
  modalTitle: {},
  closeButton: {},
  searchContainer: {},
  searchIcon: {},
  searchInput: {},
  categoryList: {},
  categoryListContent: {},
  categoryItem: {},
  selectedCategoryItem: {},
  categoryItemText: {},
  selectedCategoryItemText: {},
  checkIcon: {},
  createCategoryContainer: {},
  createCategoryInput: {},
  createCategoryButton: {},
  disabledButton: {},
  createCategoryButtonText: {},
  confirmButton: {},
  confirmButtonText: {},
});

export default CategorySelector;
