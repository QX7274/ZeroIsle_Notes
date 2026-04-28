/**
 * 搜索历史组件
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSearchHistory,
  clearSearchHistoryAsync,
  selectSearchHistory,
  selectIsLoading,
} from '../../redux/slices/searchSlice';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 搜索历史组件
 * @param {Function} onHistoryItemPress - 点击历史项回调
 * @param {boolean} visible - 是否可见
 * @param {string} searchScope - 搜索范围，可选值：'home', 'category', 'community'
 */
const SearchHistory = ({ onHistoryItemPress, visible = true, searchScope = 'home' }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const searchHistory = useSelector(selectSearchHistory);
  const isLoading = useSelector(selectIsLoading);

  // 本地状态
  const [isInitialized, setIsInitialized] = useState(false);
  const [localError, setLocalError] = useState(null);

  // 使用本地存储的历史记录，避免每次都从服务器加载
  useEffect(() => {
    if (visible && !isInitialized) {
      try {
        // 使用本地存储的历史记录，避免不必要的网络请求
        const localHistory = { scope: searchScope, limit: 5, useLocalOnly: true };
        dispatch(fetchSearchHistory(localHistory));
        setIsInitialized(true);
      } catch (error) {
        console.error('获取搜索历史失败:', error);
        setLocalError('获取搜索历史失败');
      }
    }
  }, [visible, dispatch, searchScope, isInitialized]);

  // 如果不可见，不显示
  if (!visible) {
    return null;
  }

  // 清除搜索历史
  const handleClearHistory = () => {
    Alert.alert(
      '清除搜索历史',
      '确定要清除所有搜索历史吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          onPress: () => dispatch(clearSearchHistoryAsync()),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  // 渲染历史项
  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => onHistoryItemPress(item)}
    >
      <View style={styles.historyItemContent}>
        <Icon
          name={
            item.mode === 'text' ? 'search' :
            item.mode === 'voice' ? 'mic' :
            item.mode === 'image' ? 'image-search' :
            item.mode === 'knowledge' ? 'account-tree' : 'search'
          }
          size={20}
          color={colors.textSecondary}
        />
        <Text
          style={[
            styles.historyItemText,
            { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {item.query}
        </Text>
      </View>
      <Text
        style={[
          styles.historyItemTime,
          { color: colors.textSecondary },
        ]}
      >
        {formatTime(item.timestamp)}
      </Text>
    </TouchableOpacity>
  );

  // 如果没有历史记录
  if (!searchHistory || searchHistory.length === 0) {
    return (
      <View style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}>
        <Text
          style={[
            styles.emptyText,
            { color: colors.textSecondary },
          ]}
        >
          暂无搜索历史
        </Text>
      </View>
    );
  }

  // 渲染历史列表
  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.background },
    ]}>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
          ]}
        >
          搜索历史
        </Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearHistory}
        >
          <Text
            style={[
              styles.clearButtonText,
              { color: colors.primary },
            ]}
          >
            清除
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={searchHistory}
        renderItem={renderHistoryItem}
        keyExtractor={(item, index) => `history-${index}-${item.timestamp}`}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) {
    return diffDay === 1 ? '昨天' : `${diffDay}天前`;
  }

  if (diffHour > 0) {
    return `${diffHour}小时前`;
  }

  if (diffMin > 0) {
    return `${diffMin}分钟前`;
  }

  return '刚刚';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  historyItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyItemText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  historyItemTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
});

export default SearchHistory;
