/**
 * 搜索建议组件
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSearchSuggestions,
  clearSuggestions,
  selectSuggestions,
  selectIsFetchingSuggestions,
  selectSuggestionsError,
} from '../../redux/slices/searchSlice';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 搜索建议组件
 * @param {string} query - 搜索关键词
 * @param {Function} onSuggestionPress - 点击建议回调
 * @param {boolean} visible - 是否可见
 */
const SearchSuggestions = ({ query, onSuggestionPress, visible = true }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();
  
  // 从Redux获取状态
  const suggestions = useSelector(selectSuggestions);
  const isLoading = useSelector(selectIsFetchingSuggestions);
  const error = useSelector(selectSuggestionsError);
  
  // 当查询变化时获取建议
  useEffect(() => {
    if (query && query.length >= 2 && visible) {
      dispatch(fetchSearchSuggestions({ query }));
    } else {
      dispatch(clearSuggestions());
    }
    
    return () => {
      dispatch(clearSuggestions());
    };
  }, [query, visible, dispatch]);
  
  // 如果不可见或没有查询，不显示
  if (!visible || !query || query.length < 2) {
    return null;
  }
  
  // 渲染建议项
  const renderSuggestionItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.suggestionItem,
        { borderBottomColor: colors.border }
      ]}
      onPress={() => onSuggestionPress(item.text)}
    >
      <Icon name="search" size={20} color={colors.textSecondary} />
      <Text
        style={[
          styles.suggestionText,
          { color: colors.text }
        ]}
        numberOfLines={1}
      >
        {item.text}
      </Text>
    </TouchableOpacity>
  );
  
  // 渲染加载状态
  if (isLoading) {
    return (
      <View style={[
        styles.container,
        { backgroundColor: colors.card }
      ]}>
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.loader}
        />
      </View>
    );
  }
  
  // 渲染错误状态
  if (error) {
    return (
      <View style={[
        styles.container,
        { backgroundColor: colors.card }
      ]}>
        <Text
          style={[
            styles.errorText,
            { color: colors.error }
          ]}
        >
          {error}
        </Text>
      </View>
    );
  }
  
  // 如果没有建议，不显示
  if (!suggestions || suggestions.length === 0) {
    return null;
  }
  
  // 渲染建议列表
  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.card }
    ]}>
      <FlatList
        data={suggestions}
        renderItem={renderSuggestionItem}
        keyExtractor={(item, index) => `suggestion-${index}-${item.text}`}
        keyboardShouldPersistTaps="always"
        style={styles.list}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60, // 根据搜索框高度调整
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 300,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  loader: {
    padding: 20,
  },
  errorText: {
    padding: 16,
    textAlign: 'center',
  },
});

export default SearchSuggestions;
