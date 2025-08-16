import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UnifiedSearchBar } from '../../components/search';
import { IconButton } from '../../components/common';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const CategoryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const handleSelectCategory = (category) => {
    navigation.navigate('NoteList', { categoryId: category.id });
  };

  // 处理搜索输入
  const handleSearchInput = (text) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setFilteredCategories(allCategories);
    } else {
      const filtered = allCategories.filter(category =>
        category.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredCategories(filtered);
    }
  };

  // 处理搜索结果
  const handleSearch = (results) => {
    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results, source: 'category' });
    }
  };

  // 处理创建新分类
  const handleCreateCategory = () => {
    // TODO: 实现创建分类功能
    console.log('创建新分类');
  };

  // 接收分类数据
  const handleCategoriesLoaded = (categories) => {
    setAllCategories(categories);
    setFilteredCategories(categories);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <IconButton
            icon="add"
            text="新建"
            size="medium"
            onPress={handleCreateCategory}
          />
        </View>
      </View>
      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="category"
          resultScreenName="SearchResults"
          onSearch={handleSearch}
          initialQuery={searchQuery}
          onCancel={() => setSearchQuery('')}
          onFocus={() => {}}
          placeholder="搜索分类、标签、内容..."
        />
      </View>
      {/* TODO: 实现CategoryManager组件 */}
      <View style={styles.placeholder}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          分类管理功能正在开发中
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  placeholderText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default CategoryScreen;