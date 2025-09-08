import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  search,
  clearSearchResults,
  addToSearchHistory,
  selectSearchResults,
  selectIsLoading,
  selectError,
} from '../../redux/slices/searchSlice';
import {
  MultiModalSearch,
  SearchResults,
  SearchHistory,
  UnifiedSearchBar
} from '../../components/search';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import networkErrorService from '../../services/networkErrorService';

/**
 * 社区搜索屏幕
 * 用于在社区内容中进行搜索
 */
const CommunitySearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const results = useSelector(selectSearchResults);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 本地状态
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const initialQuery = route.params?.query || '';

  // 清理搜索结果
  useEffect(() => {
    return () => {
      dispatch(clearSearchResults());
    };
  }, [dispatch]);

  // 处理搜索
  const handleSearch = (searchResults) => {
    setSearchPerformed(true);
    setShowHistory(false);

    // 如果搜索成功，添加到搜索历史
    if (searchResults && searchResults.query) {
      dispatch(addToSearchHistory({
        query: searchResults.query,
        timestamp: new Date().toISOString(),
      }));
    }
  };

  // 处理取消
  const handleCancel = () => {
    navigation.goBack();
  };

  // 处理搜索结果点击
  const handleResultPress = (item) => {
    // 根据结果类型导航到不同页面
    if (item.type === 'post') {
      navigation.navigate('PostDetail', { postId: item.id, title: item.title });
    } else if (item.type === 'user') {
      navigation.navigate('UserProfile', { userId: item.id });
    } else if (item.type === 'tag') {
      navigation.navigate('Community', { tag: item.name });
    }
  };

  // 处理历史记录项点击
  const handleHistoryItemPress = (historyItem) => {
    // 使用历史记录中的查询进行搜索
    dispatch(search({
      mode: 'text',
      query: historyItem.query,
      options: {
        scope: 'community',
      }
    }));
    setSearchPerformed(true);
    setShowHistory(false);
  };

  // 过滤社区相关结果
  const communityResults = results.filter(item =>
    item.type === 'post' || item.type === 'user' || item.type === 'tag'
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.searchContainer}>
          <UnifiedSearchBar
            searchScope="community"
            resultScreenName="CommunitySearch"
            onSearch={handleSearch}
            onCancel={handleCancel}
            initialQuery={initialQuery}
          />
        </View>

        {searchPerformed ? (
          <View style={styles.resultsContainer}>
            <SearchResults
              results={communityResults}
              isLoading={isLoading}
              error={error}
              onResultPress={handleResultPress}
              navigation={navigation}
            />
          </View>
        ) : showHistory && (
          <View style={styles.historyContainer}>
            <SearchHistory
              onHistoryItemPress={handleHistoryItemPress}
              visible={true}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export default CommunitySearchScreen;
