import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
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
  SearchResults,
  SearchHistory,
  UnifiedSearchBar,
} from '../../components/search';
import useHideMainTabBar from './useHideMainTabBar';

/**
 * 社区搜索屏幕
 * 用于在社区内容中进行搜索
 */
const CommunitySearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();

  useHideMainTabBar();

  const results = useSelector(selectSearchResults);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const initialQuery = route.params?.query || '';

  useEffect(() => {
    return () => {
      dispatch(clearSearchResults());
    };
  }, [dispatch]);

  const handleSearch = (searchResults) => {
    setSearchPerformed(true);
    setShowHistory(false);

    if (searchResults && searchResults.query) {
      dispatch(addToSearchHistory({
        query: searchResults.query,
        timestamp: new Date().toISOString(),
      }));
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleResultPress = (item) => {
    if (item.type === 'post') {
      navigation.navigate('PostDetail', { postId: item.id, title: item.title });
    } else if (item.type === 'user') {
      navigation.navigate('UserProfile', { userId: item.id });
    } else if (item.type === 'tag') {
      navigation.navigate('Community', { tag: item.name });
    }
  };

  const handleHistoryItemPress = (historyItem) => {
    dispatch(search({
      mode: 'text',
      query: historyItem.query,
      options: {
        scope: 'community',
      },
    }));
    setSearchPerformed(true);
    setShowHistory(false);
  };

  const communityResults = results.filter(
    (item) => item.type === 'post' || item.type === 'user' || item.type === 'tag'
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="screen.community.search">
      <View testID={`state.community.search.performed.${searchPerformed ? 'true' : 'false'}`} />
      <View testID={`state.community.search.history.visibility.${showHistory ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.search.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.search.error.visibility.${error ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.search.results.count.${communityResults.length}`} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={[styles.searchContainer, styles.glassContainer]} testID="panel.community.search.input">
          <UnifiedSearchBar
            searchScope="community"
            resultScreenName="CommunitySearch"
            onSearch={handleSearch}
            onCancel={handleCancel}
            initialQuery={initialQuery}
          />
        </View>

        {searchPerformed ? (
          <View style={[styles.resultsContainer, styles.glassContainer]} testID="panel.community.search.results">
            <SearchResults
              results={communityResults}
              isLoading={isLoading}
              error={error}
              onResultPress={handleResultPress}
              navigation={navigation}
            />
          </View>
        ) : showHistory ? (
          <View style={[styles.historyContainer, styles.glassContainer]} testID="panel.community.search.history">
            <SearchHistory
              onHistoryItemPress={handleHistoryItemPress}
              visible={true}
            />
          </View>
        ) : null}
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
    marginHorizontal: 10,
    marginTop: 8,
    borderRadius: 14,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 14,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 14,
  },
  glassContainer: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.18)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
});

export default CommunitySearchScreen;
