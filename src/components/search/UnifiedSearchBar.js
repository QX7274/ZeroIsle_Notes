/**
 * 统一搜索栏组件
 * 整合了HomeSearchBar、CategorySearchBar和CommunitySearchBar的功能
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import MultiModalSearch from './MultiModalSearch';

/**
 * 统一搜索栏组件
 * @param {Object} props - 组件属性
 * @param {Function} props.onSearch - 搜索回调函数
 * @param {Function} props.onCancel - 取消回调函数
 * @param {Function} props.onFocus - 聚焦回调函数
 * @param {string} props.searchScope - 搜索范围，可选值：'home', 'category', 'community'
 * @param {string} props.placeholder - 搜索框占位文本
 * @param {string} props.initialQuery - 初始搜索关键词
 * @param {Object} props.style - 自定义样式
 * @param {string} props.resultScreenName - 搜索结果页面名称
 */
const UnifiedSearchBar = ({
  onSearch,
  onCancel,
  onFocus,
  searchScope = 'home',
  placeholder,
  initialQuery = '',
  style,
  resultScreenName,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showSearch, setShowSearch] = useState(false);

  // 根据搜索范围获取占位文本
  const getPlaceholder = () => {
    if (placeholder) return placeholder;

    switch (searchScope) {
      case 'home':
        return '搜索笔记、标签、内容...';
      case 'category':
        return '搜索分类、标签、内容...';
      case 'community':
        return '搜索帖子、用户、标签...';
      case 'mind_map':
        return '搜索思维导图...';
      case 'knowledge_graph':
        return '搜索知识节点...';
      default:
        return '搜索...';
    }
  };

  // 根据搜索范围获取结果页面名称
  const getResultScreenName = () => {
    if (resultScreenName) return resultScreenName;

    switch (searchScope) {
      case 'home':
        return 'SearchResults';
      case 'category':
        return 'SearchResults';
      case 'community':
        return 'CommunitySearch';
      case 'mind_map':
        return 'MindMapScreen';
      case 'knowledge_graph':
        return 'KnowledgeGraphScreen';
      default:
        return 'SearchResults';
    }
  };

  // 处理搜索结果
  const handleSearchResult = (results, query, options = {}) => {
    setShowSearch(false);
    onSearch?.(results, query, options);

    // 如果有结果，导航到搜索结果页面
    if (results && results.length > 0) {
      navigation.navigate(getResultScreenName(), {
        results,
        query,
        searchMode: options.searchMode || 'text',
        isOfflineSearch: options.isOfflineSearch || false,
        source: searchScope
      });
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.border}80`,
          },
          style
        ]}
        onPress={() => {
          setShowSearch(true);
          onFocus?.();
        }}
        activeOpacity={0.7}
      >
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${colors.primary}10`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
        }}>
          <Icon name="search" size={20} color={colors.primary} />
        </View>
        <Text
          variant="body"
          size="medium"
          color="textSecondary"
          style={styles.placeholder}
        >
          {getPlaceholder()}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showSearch}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowSearch(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <MultiModalSearch
            onSearch={handleSearchResult}
            onCancel={() => {
              setShowSearch(false);
              onCancel?.();
            }}
            initialQuery={initialQuery}
            searchScope={searchScope}
          />
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  placeholder: {
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
});

export default UnifiedSearchBar;
