import React, { useState, useEffect, useLayoutEffect } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { Text } from '../../components/common/Typography';
import { UnifiedSearchBar } from '../../components/search';
import { useTheme } from '../../context/ThemeContext';
import { CategoryManager, CategoryEditor } from '../../components/category';

// Redux
import {
  fetchCategories,
  selectCategories,
  setCurrentCategory,
} from '../../redux/slices/categorySlice';

const CategoryScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const categories = useSelector(selectCategories);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // 处理创建新分类
  const handleCreateCategory = () => {
    setShowCreateDialog(true);
  };

  // 配置导航栏右侧按钮
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleCreateCategory}
        >
          <Icon name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors.primary]);

  // 加载分类数据
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // 处理分类选择
  const handleSelectCategory = (category) => {
    dispatch(setCurrentCategory(category));
    // 导航到该分类的笔记列表
    navigation.navigate('HomeStack', {
      screen: 'Home',
      params: { categoryId: category.id, categoryName: category.name },
    });
  };

  // 处理搜索结果
  const handleSearch = (results) => {
    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results, source: 'category' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="category"
          resultScreenName="SearchResults"
          onSearch={handleSearch}
          initialQuery={searchQuery}
          onCancel={() => setSearchQuery('')}
          onFocus={() => {}}
          placeholder="搜索分类..."
        />
      </View>

      {/* 分类管理组件 */}
      <CategoryManager
        onCategorySelect={handleSelectCategory}
      />

      {/* 创建分类对话框 */}
      <CategoryEditor
        visible={showCreateDialog}
        category={null}
        allCategories={categories}
        onSave={() => setShowCreateDialog(false)}
        onCancel={() => setShowCreateDialog(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export default CategoryScreen;
