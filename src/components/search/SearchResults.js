import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Card } from '../common';

/**
 * 搜索结果组件
 * 显示搜索结果，支持多种结果类型和过滤
 */
const SearchResults = ({
  results,
  isLoading,
  error,
  onResultPress,
  onFilterChange,
  navigation,
}) => {
  const { theme } = useTheme();
  const [activeFilter, setActiveFilter] = useState('all');

  // 过滤结果
  const filteredResults = results.filter((result) => {
    if (activeFilter === 'all') return true;
    return result.type === activeFilter;
  });

  // 处理过滤器变化
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    if (onFilterChange) {
      onFilterChange(filter);
    }
  };

  // 处理结果点击
  const handleResultPress = (result) => {
    if (onResultPress) {
      onResultPress(result);
    } else {
      // 默认导航行为
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
    }
  };

  // 获取结果图标
  const getResultIcon = (type) => {
    switch (type) {
      case 'note':
        return 'description';
      case 'tag':
        return 'label';
      case 'knowledge':
        return 'bubble-chart';
      default:
        return 'help';
    }
  };

  // 获取结果类型标签
  const getResultTypeLabel = (type) => {
    switch (type) {
      case 'note':
        return '笔记';
      case 'tag':
        return '标签';
      case 'knowledge':
        return '知识点';
      default:
        return type;
    }
  };

  // 渲染过滤器
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'all' && [
              styles.activeFilterButton,
              { backgroundColor: theme.primary },
            ],
          ]}
          onPress={() => handleFilterChange('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              { color: activeFilter === 'all' ? '#FFFFFF' : theme.text },
            ]}
          >
            全部
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'note' && [
              styles.activeFilterButton,
              { backgroundColor: theme.primary },
            ],
          ]}
          onPress={() => handleFilterChange('note')}
        >
          <Icon
            name="description"
            size={16}
            color={activeFilter === 'note' ? '#FFFFFF' : theme.text}
          />
          <Text
            style={[
              styles.filterButtonText,
              { color: activeFilter === 'note' ? '#FFFFFF' : theme.text },
            ]}
          >
            笔记
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'tag' && [
              styles.activeFilterButton,
              { backgroundColor: theme.primary },
            ],
          ]}
          onPress={() => handleFilterChange('tag')}
        >
          <Icon
            name="label"
            size={16}
            color={activeFilter === 'tag' ? '#FFFFFF' : theme.text}
          />
          <Text
            style={[
              styles.filterButtonText,
              { color: activeFilter === 'tag' ? '#FFFFFF' : theme.text },
            ]}
          >
            标签
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'knowledge' && [
              styles.activeFilterButton,
              { backgroundColor: theme.primary },
            ],
          ]}
          onPress={() => handleFilterChange('knowledge')}
        >
          <Icon
            name="bubble-chart"
            size={16}
            color={activeFilter === 'knowledge' ? '#FFFFFF' : theme.text}
          />
          <Text
            style={[
              styles.filterButtonText,
              { color: activeFilter === 'knowledge' ? '#FFFFFF' : theme.text },
            ]}
          >
            知识点
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // 渲染结果项
  const renderResultItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleResultPress(item)}>
      <Card style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <View style={styles.resultTypeContainer}>
            <Icon name={getResultIcon(item.type)} size={20} color={theme.primary} />
            <Text style={[styles.resultType, { color: theme.textSecondary }]}>
              {getResultTypeLabel(item.type)}
            </Text>
          </View>

          <Text style={[styles.resultDate, { color: theme.textSecondary }]}>
            {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.resultTitle, { color: theme.text }]}>
          {item.title}
        </Text>

        {item.preview && (
          <Text
            style={[styles.resultPreview, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {item.preview}
          </Text>
        )}

        {item.matchedText && (
          <View style={[styles.matchContainer, { backgroundColor: theme.primary + '10' }]}>
            <Text style={[styles.matchLabel, { color: theme.primary }]}>
              匹配内容:
            </Text>
            <Text style={[styles.matchText, { color: theme.text }]}>
              {item.matchedText}
            </Text>
          </View>
        )}

        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, index) => (
              <View
                key={index}
                style={[styles.tagBadge, { backgroundColor: theme.primary + '20' }]}
              >
                <Text style={[styles.tagText, { color: theme.primary }]}>
                  {tag}
                </Text>
              </View>
            ))}

            {item.tags.length > 3 && (
              <Text style={[styles.moreTagsText, { color: theme.textSecondary }]}>
                +{item.tags.length - 3}
              </Text>
            )}
          </View>
        )}

        {item.relevance && (
          <View style={styles.relevanceContainer}>
            <Text style={[styles.relevanceLabel, { color: theme.textSecondary }]}>
              相关度:
            </Text>
            <View style={styles.relevanceBar}>
              <View
                style={[
                  styles.relevanceFill,
                  {
                    backgroundColor: theme.primary,
                    width: `${item.relevance * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  // 渲染加载状态
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          搜索中...
        </Text>
      </View>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Icon name="error" size={48} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.text }]}>
          搜索失败
        </Text>
        <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
          {error}
        </Text>
      </View>
    );
  }

  // 渲染空结果
  if (results.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Icon name="search-off" size={48} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.text }]}>
          未找到匹配结果
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
          尝试使用不同的搜索词或搜索方式
        </Text>
      </View>
    );
  }

  // 渲染结果列表
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderFilters()}

      <FlatList
        data={filteredResults}
        renderItem={renderResultItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={[styles.resultsCount, { color: theme.text }]}>
            找到 {filteredResults.length} 个结果
            {activeFilter !== 'all' ? ` (${getResultTypeLabel(activeFilter)})` : ''}
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activeFilterButton: {
    borderColor: 'transparent',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  filterButtonText: {
    fontSize: 15,
    marginLeft: 6,
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  resultsCount: {
    fontSize: 15,
    marginBottom: 20,
    fontWeight: '500',
  },
  resultCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultType: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  resultDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 24,
  },
  resultPreview: {
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  matchContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  matchLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  matchText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 13,
    alignSelf: 'center',
    fontWeight: '500',
  },
  relevanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  relevanceLabel: {
    fontSize: 13,
    marginRight: 10,
    fontWeight: '500',
  },
  relevanceBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  relevanceFill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default SearchResults;
