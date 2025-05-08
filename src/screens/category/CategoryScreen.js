import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CategoryManager } from '../../components/notes';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UnifiedSearchBar } from '../../components/search';

const CategoryScreen = ({ navigation }) => {
  const handleSelectCategory = (category) => {
    navigation.navigate('NoteList', { categoryId: category.id });
  };

  // 处理搜索结果
  const handleSearch = (results) => {
    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate('SearchResults', { results, source: 'category' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <UnifiedSearchBar
          searchScope="category"
          resultScreenName="SearchResults"
          onSearch={handleSearch}
        />
      </View>
      <CategoryManager onSelectCategory={handleSelectCategory} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

export default CategoryScreen;