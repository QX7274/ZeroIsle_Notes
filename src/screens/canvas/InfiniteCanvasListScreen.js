import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import infiniteCanvasStorage from '../../services/offline/infiniteCanvasStorage';
import analyticsService from '../../services/analytics/analyticsService';
import { formatDate } from '../../utils/dateUtils';

/**
 * 无限画布列表屏幕
 * 显示用户的所有无限画布，支持创建、编辑和删除
 */
const InfiniteCanvasListScreen = ({ navigation }) => {
  // 主题
  const { colors } = useTheme();
  
  // 状态
  const [canvases, setCanvases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 加载画布列表
  const loadCanvases = useCallback(async () => {
    try {
      setIsLoading(true);
      const userCanvases = await infiniteCanvasStorage.getUserCanvases();
      setCanvases(userCanvases);
    } catch (error) {
      console.error('加载画布列表失败:', error);
      Alert.alert('错误', '加载画布列表失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  // 当屏幕获得焦点时重新加载
  useFocusEffect(
    useCallback(() => {
      loadCanvases();
      analyticsService.trackScreen('infinite_canvas_list');
    }, [loadCanvases])
  );
  
  // 创建新画布
  const handleCreateCanvas = () => {
    navigation.navigate('InfiniteCanvas');
  };
  
  // 打开画布
  const handleOpenCanvas = (canvas) => {
    navigation.navigate('InfiniteCanvas', {
      canvasId: canvas.id,
      title: canvas.title,
    });
  };
  
  // 删除画布
  const handleDeleteCanvas = (canvas) => {
    Alert.alert(
      '删除画布',
      `确定要删除"${canvas.title}"吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const success = await infiniteCanvasStorage.deleteCanvas(canvas.id);
              if (success) {
                // 重新加载画布列表
                loadCanvases();
                analyticsService.trackUserAction('delete_infinite_canvas', { canvasId: canvas.id });
              } else {
                throw new Error('删除画布失败');
              }
            } catch (error) {
              console.error('删除画布失败:', error);
              Alert.alert('错误', '删除画布失败');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };
  
  // 渲染画布项
  const renderCanvasItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.canvasItem, { backgroundColor: colors.card }]}
      onPress={() => handleOpenCanvas(item)}
      onLongPress={() => handleDeleteCanvas(item)}
    >
      {/* 缩略图 */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholderThumbnail, { backgroundColor: colors.border }]}>
            <Icon name="brush-outline" size={32} color={colors.text} />
          </View>
        )}
      </View>
      
      {/* 信息 */}
      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.date, { color: colors.text }]}>
          {formatDate(item.updatedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  // 渲染空状态
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="brush-outline" size={64} color={colors.text} />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        没有无限草稿
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.text }]}>
        点击右下角的按钮创建新草稿
      </Text>
    </View>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 加载指示器 */}
      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      
      {/* 画布列表 */}
      <FlatList
        data={canvases}
        renderItem={renderCanvasItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={!isLoading && renderEmptyState()}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadCanvases();
            }}
            colors={[colors.primary]}
          />
        }
      />
      
      {/* 创建按钮 */}
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={handleCreateCanvas}
      >
        <Icon name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  canvasItem: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  createButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default InfiniteCanvasListScreen;
