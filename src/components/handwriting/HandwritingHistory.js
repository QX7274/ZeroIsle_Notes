/**
 * 手写历史记录组件
 * 显示用户的手写识别历史记录
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../common/Typography';
import { Button, EmptyState } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 手写历史记录组件
 * @param {Function} onSelect - 选择历史记录回调
 * @param {Function} onClear - 清除历史记录回调
 * @param {Object} style - 自定义样式
 */
const HandwritingHistory = ({ onSelect, onClear, style }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      const data = await offlineStorageService.getCachedData('handwriting_history') || [];
      setHistory(data);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadHistory();
  }, []);

  // 刷新历史记录
  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  // 选择历史记录
  const handleSelect = (item) => {
    if (onSelect) {
      onSelect(item);
    }
  };

  // 删除历史记录
  const handleDelete = async (id) => {
    try {
      // 获取历史记录
      const data = await offlineStorageService.getCachedData('handwriting_history') || [];
      
      // 过滤掉要删除的记录
      const updatedHistory = data.filter(item => item.id !== id);
      
      // 更新存储
      await offlineStorageService.cacheData('handwriting_history', updatedHistory);
      
      // 更新状态
      setHistory(updatedHistory);
    } catch (error) {
      console.error('删除历史记录失败:', error);
    }
  };

  // 确认删除
  const confirmDelete = (id) => {
    Alert.alert(
      '删除记录',
      '确定要删除这条历史记录吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => handleDelete(id) },
      ],
      { cancelable: true }
    );
  };

  // 清除所有历史记录
  const handleClearAll = () => {
    Alert.alert(
      '清除历史记录',
      '确定要清除所有历史记录吗？此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '清除', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await offlineStorageService.cacheData('handwriting_history', []);
              setHistory([]);
              
              if (onClear) {
                onClear();
              }
            } catch (error) {
              console.error('清除历史记录失败:', error);
            }
          } 
        },
      ],
      { cancelable: true }
    );
  };

  // 格式化日期
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return format(date, 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
    } catch (error) {
      return dateString;
    }
  };

  // 渲染历史记录项
  const renderItem = ({ item }) => {
    // 构建图像URI
    const imageUri = `data:image/png;base64,${item.image}`;
    
    return (
      <TouchableOpacity
        style={[styles.historyItem, { backgroundColor: colors.card }]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.historyImage}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.historyContent}>
          <Text variant="subtitle1" numberOfLines={2} style={styles.historyText}>
            {item.text || '(无文本)'}
          </Text>
          
          <View style={styles.historyMeta}>
            <Text variant="caption" color="textSecondary">
              {formatDate(item.timestamp)}
            </Text>
            
            {item.offline && (
              <View style={styles.offlineTag}>
                <Icon name="cloud-off" size={12} color={colors.warning} />
                <Text variant="caption" color="warning" style={styles.offlineText}>
                  离线识别
                </Text>
              </View>
            )}
            
            <View style={styles.confidenceTag}>
              <Text variant="caption" color="textSecondary">
                置信度: {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDelete(item.id)}
        >
          <Icon name="delete" size={20} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // 渲染空状态
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="body2" color="textSecondary" style={styles.emptyText}>
            加载历史记录...
          </Text>
        </View>
      );
    }
    
    return (
      <EmptyState
        icon="history"
        title="暂无历史记录"
        message="您的手写识别历史记录将显示在这里"
      />
    );
  };

  // 渲染列表头部
  const renderHeader = () => {
    if (history.length === 0) return null;
    
    return (
      <View style={styles.header}>
        <Text variant="h6">历史记录</Text>
        <Button
          title="清除全部"
          type="text"
          color="error"
          onPress={handleClearAll}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  historyImage: {
    width: '100%',
    height: '100%',
  },
  historyContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  historyText: {
    marginBottom: 4,
  },
  historyMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  offlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  offlineText: {
    marginLeft: 4,
  },
  confidenceTag: {
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
});

export default HandwritingHistory;
