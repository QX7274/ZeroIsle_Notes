import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { SPACING } from '../utils/constants/dimensions';
import MultiModalSearch from '../components/search/MultiModalSearch';
import SearchResults from '../components/search/SearchResults';
import { search, clearSearchResults } from '../redux/slices/searchSlice';

/**
 * 搜索屏幕
 * 集成多模态搜索和搜索结果展示
 */
const SearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const { results, isLoading, error } = useSelector((state) => state.search);
  
  const initialQuery = route.params?.query || '';
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // 清理搜索结果
  useEffect(() => {
    return () => {
      dispatch(clearSearchResults());
    };
  }, [dispatch]);
  
  // 处理搜索
  const handleSearch = (searchData) => {
    dispatch(search(searchData));
    setSearchPerformed(true);
  };
  
  // 处理取消
  const handleCancel = () => {
    navigation.goBack();
  };
  
  // 处理结果点击
  const handleResultPress = (result) => {
    switch (result.type) {
      case 'note':
        navigation.navigate('NoteDetail', { noteId: result.id });
        break;
      case 'tag':
        navigation.navigate('TagNotes', { tagId: result.id, tagName: result.title });
        break;
      case 'knowledge':
        navigation.navigate('NodeDetail', { nodeId: result.id });
        break;
      default:
        break;
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.searchContainer}>
          <MultiModalSearch
            onSearch={handleSearch}
            onCancel={handleCancel}
            initialQuery={initialQuery}
          />
        </View>
        
        {searchPerformed && (
          <View style={styles.resultsContainer}>
            <SearchResults
              results={results}
              isLoading={isLoading}
              error={error}
              onResultPress={handleResultPress}
              navigation={navigation}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  searchContainer: {
    padding: SPACING.MEDIUM,
  },
  resultsContainer: {
    flex: 1,
  },
});

export default SearchScreen;
