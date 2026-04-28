/**
 * 分类管理组件
 * 综合管理分类的主组件
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { Loading } from '../common';
import { useTheme } from '../../context/ThemeContext';

// 导入分类相关组件
import CategoryList from './CategoryList';
import CategoryTree from './CategoryTree';
import CategoryEditor from './CategoryEditor';
import CategoryStatistics from './CategoryStatistics';

// 导入Redux相关
import {
  fetchCategories,
  fetchCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  setCurrentCategory,
  selectCategories,
  selectCategoryTree,
  selectCurrentCategory,
  selectIsLoading,
  selectIsCreating,
  selectIsUpdating,
  selectIsDeleting,
  selectError,
  selectSuccessMessage,
  clearError,
  clearSuccessMessage,
} from '../../redux/slices/categorySlice';
import { showToast } from '../../redux/slices/uiSlice';

/**
 * 分类管理组件
 * @param {Function} onCategorySelect - 分类选择回调
 * @param {string} viewMode - 视图模式 ('list' | 'tree')
 */
const CategoryManager = ({ onCategorySelect, viewMode: initialViewMode = 'list' }) => {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // Redux状态
  const categories = useSelector(selectCategories);
  const categoryTree = useSelector(selectCategoryTree);
  const currentCategory = useSelector(selectCurrentCategory);
  const isLoading = useSelector(selectIsLoading);
  const isCreating = useSelector(selectIsCreating);
  const isUpdating = useSelector(selectIsUpdating);
  const isDeleting = useSelector(selectIsDeleting);
  const error = useSelector(selectError);
  const successMessage = useSelector(selectSuccessMessage);

  // 本地状态
  const [viewMode, setViewMode] = useState(initialViewMode);
  const [showEditor, setShowEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState(null);

  // 加载分类数据
  useEffect(() => {
    loadCategories();
  }, []);

  // 监听视图模式变化，加载相应数据
  useEffect(() => {
    if (viewMode === 'tree') {
      dispatch(fetchCategoryTree());
    }
  }, [viewMode]);

  // 显示错误和成功消息
  useEffect(() => {
    if (error) {
      dispatch(showToast({ message: error, type: 'error' }));
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    if (successMessage) {
      dispatch(showToast({ message: successMessage, type: 'success' }));
      dispatch(clearSuccessMessage());
    }
  }, [successMessage, dispatch]);

  // 加载分类列表
  const loadCategories = () => {
    dispatch(fetchCategories());
  };

  // 刷新数据
  const handleRefresh = () => {
    if (viewMode === 'list') {
      loadCategories();
    } else {
      dispatch(fetchCategoryTree());
    }
  };

  // 处理分类点击
  const handleCategoryPress = (category) => {
    dispatch(setCurrentCategory(category));
    onCategorySelect && onCategorySelect(category);
  };

  // 处理分类长按
  const handleCategoryLongPress = (category) => {
    Alert.alert('分类操作', `选择对 "${category.name}" 的操作`, [
      {
        text: '编辑',
        onPress: () => handleEditCategory(category),
      },
      {
        text: '删除',
        onPress: () => handleDeleteCategory(category),
        style: 'destructive',
      },
      {
        text: '取消',
        style: 'cancel',
      },
    ]);
  };

  // 打开创建分类对话框
  const handleCreateCategory = () => {
    setEditingCategory(null);
    setShowEditor(true);
  };

  // 打开编辑分类对话框
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setShowEditor(true);
  };

  // 处理删除分类
  const handleDeleteCategory = (category) => {
    Alert.alert(
      '确认删除',
      `确定要删除分类 "${category.name}" 吗？\n\n注意：该分类下的笔记不会被删除，但会失去分类关联。`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteCategory(category.id));
          },
        },
      ]
    );
  };

  // 保存分类（创建或更新）
  const handleSaveCategory = (categoryData) => {
    if (editingCategory) {
      // 更新分类
      dispatch(updateCategory({ id: categoryData.id, data: categoryData }));
    } else {
      // 创建分类
      dispatch(createCategory(categoryData));
    }
    setShowEditor(false);
  };

  // 切换视图模式
  const toggleViewMode = () => {
    setViewMode(viewMode === 'list' ? 'tree' : 'list');
  };

  // 计算统计数据
  const calculateStatistics = () => {
    // 确保 categories 是数组
    const validCategories = Array.isArray(categories) ? categories : [];

    if (validCategories.length === 0) {
      setStatistics({
        totalCategories: 0,
        totalNotes: 0,
        totalWords: 0,
        mostUsedCategory: null,
      });
      setShowStatistics(true);
      return;
    }

    const totalCategories = validCategories.length;
    const totalNotes = validCategories.reduce(
      (sum, cat) => sum + (cat.note_count || cat.noteCount || 0),
      0
    );
    const totalWords = validCategories.reduce(
      (sum, cat) => sum + (cat.total_words || 0),
      0
    );
    const mostUsedCategory = validCategories.reduce((max, cat) => {
      const noteCount = cat.note_count || cat.noteCount || 0;
      const maxCount = max ? max.note_count || max.noteCount || 0 : 0;
      return noteCount > maxCount ? cat : max;
    }, null);

    setStatistics({
      totalCategories,
      totalNotes,
      totalWords,
      mostUsedCategory,
    });
    setShowStatistics(true);
  };

  // 渲染顶部工具栏
  const renderToolbar = () => (
    <View style={styles.toolbar}>
      {/* 视图切换按钮 */}
      <TouchableOpacity style={styles.toolbarButton} onPress={toggleViewMode}>
        <Icon
          name={viewMode === 'list' ? 'view-list' : 'account-tree'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* 统计按钮 */}
      <TouchableOpacity
        style={styles.toolbarButton}
        onPress={calculateStatistics}
      >
        <Icon name="bar-chart" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* 刷新按钮 */}
      <TouchableOpacity style={styles.toolbarButton} onPress={handleRefresh}>
        <Icon name="refresh" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  // 渲染分类视图
  const renderCategoryView = () => {
    if (viewMode === 'list') {
      return (
        <CategoryList
          categories={categories}
          onCategoryPress={handleCategoryPress}
          onCategoryLongPress={handleCategoryLongPress}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          onRefresh={handleRefresh}
          isRefreshing={isLoading}
          isLoading={isLoading}
          selectedCategoryId={currentCategory?.id}
        />
      );
    } else {
      return (
        <CategoryTree
          tree={categoryTree}
          onCategoryPress={handleCategoryPress}
          onCategoryLongPress={handleCategoryLongPress}
          onEditCategory={handleEditCategory}
          onDeleteCategory={handleDeleteCategory}
          selectedCategoryId={currentCategory?.id}
        />
      );
    }
  };

  // 如果正在执行操作，显示加载指示器
  if (isCreating || isUpdating || isDeleting) {
    return <Loading text="处理中..." />;
  }

  return (
    <View style={styles.container}>
      {/* 工具栏 */}
      {renderToolbar()}

      {/* 分类视图 */}
      {renderCategoryView()}

      {/* 分类编辑器 */}
      <CategoryEditor
        visible={showEditor}
        category={editingCategory}
        allCategories={categories}
        onSave={handleSaveCategory}
        onCancel={() => setShowEditor(false)}
      />

      {/* 统计信息 */}
      {showStatistics && statistics && (
        <View style={styles.statisticsContainer}>
          <TouchableOpacity
            style={styles.closeStatisticsButton}
            onPress={() => setShowStatistics(false)}
          >
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <CategoryStatistics statistics={statistics} />
        </View>
      )}
    </View>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    toolbarButton: {
      padding: 6,
      marginLeft: 6,
    },
    statisticsContainer: {
      position: 'absolute',
      top: 60,
      left: 0,
      right: 0,
      backgroundColor: colors.background,
      zIndex: 1000,
    },
    closeStatisticsButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1001,
      padding: 4,
    },
  });

export default CategoryManager;





