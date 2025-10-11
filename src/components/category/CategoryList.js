/**
 * 分类列表组件
 * 显示分类的列表视图
 */

import React from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import CategoryCard from './CategoryCard';
import { EmptyState } from '../common';
import { useTheme } from '../../context/ThemeContext';

/**
 * 分类列表组件
 * @param {Array} categories - 分类数组
 * @param {Function} onCategoryPress - 分类点击回调
 * @param {Function} onCategoryLongPress - 分类长按回调
 * @param {Function} onEditCategory - 编辑分类回调
 * @param {Function} onDeleteCategory - 删除分类回调
 * @param {Function} onRefresh - 下拉刷新回调
 * @param {boolean} isRefreshing - 是否正在刷新
 * @param {boolean} isLoading - 是否正在加载
 * @param {string} selectedCategoryId - 选中的分类ID
 */
const CategoryList = ({
  categories = [],
  onCategoryPress,
  onCategoryLongPress,
  onEditCategory,
  onDeleteCategory,
  onRefresh,
  isRefreshing = false,
  isLoading = false,
  selectedCategoryId = null,
}) => {
  const { colors } = useTheme();
  
  // 确保 categories 是数组
  const validCategories = Array.isArray(categories) ? categories : [];

  // 渲染单个分类项
  const renderCategory = ({ item }) => (
    <CategoryCard
      category={item}
      onPress={onCategoryPress}
      onLongPress={onCategoryLongPress}
      onEdit={onEditCategory}
      onDelete={onDeleteCategory}
      isSelected={selectedCategoryId === item.id}
    />
  );

  // 渲染空状态
  const renderEmptyState = () => {
    if (isLoading) {
      return null;
    }
    return (
      <EmptyState
        icon="folder-open"
        title="暂无分类"
        description="点击右上角的 + 按钮创建第一个分类"
      />
    );
  };

  // 列表分隔符
  const ItemSeparator = () => <View style={styles.separator} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={validCategories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id || item._id}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={[
          styles.listContent,
          validCategories.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 0,
  },
});

export default CategoryList;





