/**
 * 搜索结果页面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { HomeSearchBar } from '../components/search';

const SearchResultsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  // 从路由参数获取搜索结果
  const initialResults = route.params?.results || [];
  const [results, setResults] = useState(initialResults);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 处理搜索
  const handleSearch = (newResults) => {
    setResults(newResults);
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
      </View>

      <HomeSearchBar onSearch={handleSearch} />

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
          data={results}
          renderItem={renderResultItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={renderEmptyState}
        />
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
});

export default SearchResultsScreen;
