import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
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
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import useHideMainTabBar from './useHideMainTabBar';

/**
 * 社区搜索屏幕
 * 用于在社区内容中进行搜索
 */
const CommunitySearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
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
      navigation.navigate('UserProfile', {
        userId: item.id,
        initialUser: {
          id: item.id,
          username: item.nickname || item.username || item.displayTitle || item.name,
          nickname: item.nickname || item.username || item.displayTitle || item.name,
          avatar: item.avatar || item.authorAvatar || '',
          bio: item.displayContent || '',
          isFollowing: item.isFollowing || item.is_following || false,
        },
      });
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
      testID="screen.community.search"
    >
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
        <View style={[styles.headerCard, { borderColor: `${colors.primary}20` }]} testID="panel.community.search.header">
          <ScreenHeaderBackButton onPress={handleCancel} testID="action.community.search.back" />
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>社区搜索</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>搜索帖子、用户和标签</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerHint, { borderColor: `${colors.primary}24`, backgroundColor: `${colors.primary}10` }]}
            disabled
            testID="state.community.search.scope.community"
          >
            <Icon name="travel-explore" size={16} color={colors.primary} />
            <Text style={[styles.headerHintText, { color: colors.primary }]}>社区</Text>
          </TouchableOpacity>
        </View>

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
          <>
            <View style={[styles.helperCard, { borderColor: `${colors.primary}18` }]} testID="panel.community.search.helper">
              <View style={[styles.helperIcon, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}24` }]}>
                <Icon name="manage-search" size={26} color={colors.primary} />
              </View>
              <Text style={[styles.helperTitle, { color: colors.text }]}>从这里开始找社区内容</Text>
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                可直接输入关键词，或从历史记录快速回到之前查过的帖子、用户和标签。
              </Text>
            </View>
            <View style={[styles.historyContainer, styles.glassContainer]} testID="panel.community.search.history">
              <SearchHistory
                onHistoryItemPress={handleHistoryItemPress}
                visible={true}
              />
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  headerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  headerHintText: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 10,
    marginHorizontal: 16,
    marginTop: 0,
    borderRadius: 18,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
  },
  helperCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  helperIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  helperTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
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
