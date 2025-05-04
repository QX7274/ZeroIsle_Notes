/**
 * 搜索结果页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { HomeSearchBar } from '../../components/search';
import SearchFilters from '../../components/search/SearchFilters';
import SearchHistory from '../../components/search/SearchHistory';

const SearchResultsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 从路由参数获取搜索结果和查询
  const initialResults = route.params?.results || [];
  const initialQuery = route.params?.query || '';
  const initialSearchMode = route.params?.searchMode || 'text';

  // 状态
  const [results, setResults] = useState(initialResults);
  const [filteredResults, setFilteredResults] = useState(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(initialQuery);
  const [filters, setFilters] = useState({
    contentType: 'all',
    tags: [],
    dateFrom: null,
    dateTo: null,
    sortBy: 'relevance',
  });

  // 处理搜索
  const handleSearch = useCallback((newResults, query) => {
    setResults(newResults);
    setFilteredResults(newResults);
    setCurrentQuery(query || currentQuery);
    setShowHistory(false);

    // 记录搜索历史
    if (query) {
      dispatch({
        type: 'search/addToHistory',
        payload: {
          query,
          mode: initialSearchMode,
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [dispatch, initialSearchMode, currentQuery]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    if (currentQuery) {
      setIsRefreshing(true);
      try {
        // 重新执行搜索
        const newResults = await dispatch({
          type: 'search/search',
          payload: { query: currentQuery, mode: initialSearchMode }
        }).unwrap();

        setResults(newResults);
        applyFilters(newResults, filters);
      } catch (error) {
        setError('刷新搜索结果失败');
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [currentQuery, initialSearchMode, filters, dispatch]);

  // 应用过滤器
  const applyFilters = useCallback((resultsToFilter, currentFilters) => {
    let filtered = [...resultsToFilter];

    // 按内容类型过滤
    if (currentFilters.contentType !== 'all') {
      filtered = filtered.filter(item => item.type === currentFilters.contentType);
    }

    // 按标签过滤
    if (currentFilters.tags && currentFilters.tags.length > 0) {
      filtered = filtered.filter(item => {
        if (!item.tags) return false;
        return currentFilters.tags.some(tagId =>
          item.tags.some(tag => tag.id === tagId || tag === tagId)
        );
      });
    }

    // 按日期范围过滤
    if (currentFilters.dateFrom) {
      const fromDate = new Date(currentFilters.dateFrom);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt || item.created_at);
        return itemDate >= fromDate;
      });
    }

    if (currentFilters.dateTo) {
      const toDate = new Date(currentFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // 设置为当天结束
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt || item.created_at);
        return itemDate <= toDate;
      });
    }

    // 排序
    switch (currentFilters.sortBy) {
      case 'date_desc':
        filtered.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateB - dateA;
        });
        break;
      case 'date_asc':
        filtered.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateA - dateB;
        });
        break;
      case 'updated_desc':
        filtered.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.updated_at || 0);
          const dateB = new Date(b.updatedAt || b.updated_at || 0);
          return dateB - dateA;
        });
        break;
      case 'title_asc':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'title_desc':
        filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
      // 相关度排序是默认的，不需要额外处理
      default:
        break;
    }

    setFilteredResults(filtered);
  }, []);

  // 当过滤器变化时应用过滤
  useEffect(() => {
    applyFilters(results, filters);
  }, [filters, results, applyFilters]);

  // 处理过滤器应用
  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
  };

  // 处理历史项点击
  const handleHistoryItemPress = (historyItem) => {
    setCurrentQuery(historyItem.query);
    setIsLoading(true);

    // 执行搜索
    dispatch({
      type: 'search/search',
      payload: { query: historyItem.query, mode: historyItem.mode || 'text' }
    })
      .then(action => {
        if (action.payload) {
          handleSearch(action.payload, historyItem.query);
        }
      })
      .catch(err => {
        setError('搜索失败: ' + err.message);
      })
      .finally(() => {
        setIsLoading(false);
        setShowHistory(false);
      });
  };

  // 处理结果点击
  const handleResultPress = (result) => {
    switch (result.type) {
      case 'note':
        navigation.navigate('Note', { note: result });
        break;
      case 'tag':
        navigation.navigate('TagNotes', { tagId: result.id, tagName: result.title });
        break;
      case 'knowledge':
        navigation.navigate('NodeDetail', { nodeId: result.id });
        break;
      case 'canvas':
        navigation.navigate('Canvas', { canvasId: result.id });
        break;
      default:
        break;
    }
  };

  // 渲染结果项
  const renderResultItem = ({ item }) => {
    // 根据结果类型选择图标
    let iconName = 'description';
    if (item.type === 'tag') iconName = 'local-offer';
    else if (item.type === 'knowledge') iconName = 'bubble-chart';

    return (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.card }]}
        onPress={() => handleResultPress(item)}
      >
        <View style={[styles.resultIconContainer, { backgroundColor: colors.primaryLight }]}>
          <Icon name={iconName} size={24} color={colors.primary} />
        </View>
        <View style={styles.resultContent}>
          <Text
            variant="body"
            size="medium"
            bold
            numberOfLines={1}
            style={styles.resultTitle}
          >
            {item.title}
          </Text>
          <Text
            variant="body"
            size="small"
            color="textSecondary"
            numberOfLines={2}
            style={styles.resultExcerpt}
          >
            {item.excerpt || item.content?.substring(0, 100) || ''}
          </Text>
          <View style={styles.resultMeta}>
            <Text
              variant="caption"
              color="textTertiary"
              style={styles.resultType}
            >
              {item.type === 'note' ? '笔记' : item.type === 'tag' ? '标签' : '知识点'}
            </Text>
            {item.updatedAt && (
              <Text
                variant="caption"
                color="textTertiary"
              >
                {item.updatedAt}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染空状态
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="search-off" size={64} color={colors.textSecondary} />
      <Text
        variant="body"
        size="large"
        color="textSecondary"
        center
        style={styles.emptyTitle}
      >
        没有找到相关结果
      </Text>
      <Text
        variant="body"
        size="medium"
        color="textTertiary"
        center
        style={styles.emptySubtitle}
      >
        尝试使用不同的关键词或搜索方式
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h6"
          style={styles.headerTitle}
        >
          搜索结果
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Icon
              name="history"
              size={24}
              color={showHistory ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon
              name="filter-list"
              size={24}
              color={showFilters ? colors.primary : colors.text}
            />
            {Object.values(filters).some(v =>
              Array.isArray(v) ? v.length > 0 : v !== null && v !== 'all' && v !== 'relevance'
            ) && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <HomeSearchBar
        initialQuery={currentQuery}
        onSearch={handleSearch}
        onFocus={() => setShowHistory(true)}
      />

      {showFilters && (
        <SearchFilters
          onApplyFilters={handleApplyFilters}
          initialFilters={filters}
        />
      )}

      {showHistory && (
        <SearchHistory
          onHistoryItemPress={handleHistoryItemPress}
          visible={showHistory}
        />
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="error" size={48} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            color="error"
            center
            style={styles.errorText}
          >
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderResultItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* 结果统计 */}
      {!isLoading && !error && filteredResults.length > 0 && (
        <View style={[styles.resultsStats, { backgroundColor: colors.card }]}>
          <Text
            variant="caption"
            color="textSecondary"
          >
            找到 {filteredResults.length} 个结果
            {filteredResults.length !== results.length && ` (已过滤，共 ${results.length} 个)`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
  },
  resultsList: {
    padding: 16,
    flexGrow: 1,
  },
  resultItem: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    marginBottom: 4,
  },
  resultExcerpt: {
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultType: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  resultsStats: {
    padding: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
});

export default SearchResultsScreen;
