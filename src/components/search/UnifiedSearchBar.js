/**
 * 统一搜索栏组件
 * 整合了HomeSearchBar、CategorySearchBar和CommunitySearchBar的功能
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  BackHandler,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import MultiModalSearch from './MultiModalSearch';
import useOrientation from '../../utils/hooks/useOrientation';
import { getCurrentRouteName } from '../../navigation/navigationRef';
import debugLog from '../../native/debugLog';

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
  disableAutoNavigate = false,
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showSearch, setShowSearch] = useState(false);
  const mountAtRef = useRef(Date.now());
  const openReasonRef = useRef('idle');
  const debugScopeLabel = `${searchScope || 'unknown'}:${resultScreenName || 'default'}`;

  // 获取屏幕方向信息
  const { isLandscape } = useOrientation();

  const emitDebugLog = (event, payload = {}, level = 'info') => {
    if (!__DEV__) {
      return;
    }

    const message = {
      event,
      scope: debugScopeLabel,
      ...payload,
    };

    console.log(`[UnifiedSearchBar] ${event}`, message);
    debugLog(level, 'UnifiedSearchBar', message);
  };

  // 根据搜索范围获取占位文本
  const getPlaceholder = () => {
    if (placeholder) {return placeholder;}

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
    if (resultScreenName) {return resultScreenName;}

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

  const closeSearchModal = (reason = 'unknown', shouldNotifyCancel = false) => {
    openReasonRef.current = reason;

    if (__DEV__) {
      emitDebugLog('close modal requested', {
        currentRoute: getCurrentRouteName(),
        reason,
        shouldNotifyCancel,
        visibleBeforeClose: showSearch,
      });
    }

    setShowSearch(false);

    if (shouldNotifyCancel) {
      onCancel?.();
    }
  };

  // 处理搜索结果
  const handleSearchResult = (results, query, options = {}) => {
    if (__DEV__) {
      emitDebugLog('handleSearchResult -> close modal', {
        currentRoute: getCurrentRouteName(),
        resultsCount: Array.isArray(results) ? results.length : 0,
        query,
        mode: options.searchMode || 'text',
      });
    }

    setShowSearch(false);
    openReasonRef.current = 'search-complete';
    onSearch?.(results, query, options);

    const resolvedResultScreenName = getResultScreenName();
    const shouldNavigate = !disableAutoNavigate && (
      (resolvedResultScreenName === 'CommunitySearch' && Array.isArray(results))
      || (Array.isArray(results) && results.length > 0)
    );

    if (shouldNavigate) {
      navigation.navigate(getResultScreenName(), {
        results: Array.isArray(results) ? results : [],
        query,
        searchMode: options.searchMode || 'text',
        isOfflineSearch: options.isOfflineSearch || false,
        source: searchScope,
        searchPerformed: true,
      });
    }
  };

  useEffect(() => {
    if (__DEV__) {
      emitDebugLog('mounted', {
        currentRoute: getCurrentRouteName(),
        initialQuery,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (__DEV__) {
      const message = {
        event: 'visibility changed',
        scope: debugScopeLabel,
        visible: showSearch,
        reason: openReasonRef.current,
        currentRoute: getCurrentRouteName(),
        elapsedMsSinceMount: Date.now() - mountAtRef.current,
      };

      console.log('[UnifiedSearchBar] visibility changed', message);
      debugLog('info', 'UnifiedSearchBar', message);
    }
  }, [showSearch, debugScopeLabel]);

  useEffect(() => {
    if (!showSearch) {
      return undefined;
    }

    const handleHardwareBackPress = () => {
      closeSearchModal('hardware-back', true);
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBackPress);
    return () => subscription.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch]);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.border}80`,
          },
          // 横屏模式下的样式调整
          isLandscape && {
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 24,
          },
          style,
        ]}
        onPress={() => {
          openReasonRef.current = 'touchable-press';

          if (__DEV__) {
            emitDebugLog('open modal requested', {
              currentRoute: getCurrentRouteName(),
              elapsedMsSinceMount: Date.now() - mountAtRef.current,
              initialQuery,
            });
          }

          setShowSearch(true);
          onFocus?.();
        }}
        activeOpacity={0.7}
      >
        <View style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: `${colors.primary}15`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 8,
        }}>
          <Icon name="search" size={18} color={colors.primary} />
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
        onRequestClose={() => closeSearchModal('request-close', true)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <MultiModalSearch
            navigation={navigation}
            onSearch={handleSearchResult}
            onCancel={() => closeSearchModal('cancel', true)}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginVertical: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  placeholder: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
});

export default UnifiedSearchBar;
