import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CategoryManager from '../../components/notes/CategoryManager';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UnifiedSearchBar } from '../../components/search';
import { IconButton } from '../../components/common';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const CategoryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const categoryManagerRef = useRef(null);
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
    if (categoryManagerRef.current && categoryManagerRef.current.setModalVisible) {
      categoryManagerRef.current.setModalVisible(true);
    }
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
      <CategoryManager
        ref={categoryManagerRef}
        onSelectCategory={handleSelectCategory}
        onCategoriesLoaded={handleCategoriesLoaded}
        filteredCategories={filteredCategories}
      />
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
});

export default CategoryScreen;