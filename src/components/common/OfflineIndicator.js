/**
 * 离线状态指示器组件
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from './Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineStorageService } from '../../services/offline/offlineStorage';

/**
 * 离线状态指示器组件
 * @param {Function} onPress - 点击回调
 * @param {Object} style - 自定义样式
 */
const OfflineIndicator = ({ onPress, style }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 状态
  const [status, setStatus] = useState(offlineStorageService.getStatus());
  const [expanded, setExpanded] = useState(false);
  
  // 动画值
  const animatedHeight = new Animated.Value(0);
  const animatedOpacity = new Animated.Value(0);
  const syncIconRotation = new Animated.Value(0);
  
  // 监听离线存储服务状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (['connectionChange', 'offlineModeChange', 'syncStarted', 'syncCompleted', 'syncError', 'pendingOperationAdded'].includes(event.type)) {
        setStatus(offlineStorageService.getStatus());
      }
      
      // 如果同步开始，启动旋转动画
      if (event.type === 'syncStarted') {
        startRotationAnimation();
      }
      
      // 如果同步完成或出错，停止旋转动画
      if (event.type === 'syncCompleted' || event.type === 'syncError') {
        stopRotationAnimation();
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // 展开/收起动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: expanded ? 1 : 0,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(animatedOpacity, {
        toValue: expanded ? 1 : 0,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [expanded]);
  
  // 启动旋转动画
  const startRotationAnimation = () => {
    syncIconRotation.setValue(0);
    Animated.loop(
      Animated.timing(syncIconRotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };
  
  // 停止旋转动画
  const stopRotationAnimation = () => {
    syncIconRotation.stopAnimation();
    syncIconRotation.setValue(0);
  };
  
  // 计算旋转角度
  const spin = syncIconRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // 计算展开高度
  const height = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });
  
  // 处理点击
  const handlePress = () => {
    if (onPress) {
      onPress(status);
    } else {
      setExpanded(!expanded);
    }
  };
  
  // 处理同步按钮点击
  const handleSyncPress = async () => {
    if (status.syncStatus === 'syncing') return;
    
    try {
      await offlineStorageService.manualSync();
    } catch (error) {
      console.error('手动同步失败:', error);
    }
  };
  
  // 获取状态图标和颜色
  const getStatusIconAndColor = () => {
    if (status.offlineMode) {
      return {
        icon: 'cloud-off',
        color: colors.warning,
        text: '离线模式',
      };
    }
    
    if (!status.isOnline) {
      return {
        icon: 'signal-wifi-off',
        color: colors.error,
        text: '无网络连接',
      };
    }
    
    if (status.pendingOperationsCount > 0) {
      return {
        icon: 'sync',
        color: colors.warning,
        text: `${status.pendingOperationsCount}项待同步`,
      };
    }
    
    return {
      icon: 'cloud-done',
      color: colors.success,
      text: '已同步',
    };
  };
  
  const { icon, color, text } = getStatusIconAndColor();
  
  // 格式化最后同步时间
  const formatLastSyncTime = () => {
    if (!status.lastSyncTime) return '从未同步';
    
    const lastSync = new Date(status.lastSyncTime);
    const now = new Date();
    const diffMs = now - lastSync;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return '刚刚同步';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前同步`;
    } else if (diffMinutes < 24 * 60) {
      return `${Math.floor(diffMinutes / 60)}小时前同步`;
    } else {
      return `${Math.floor(diffMinutes / (24 * 60))}天前同步`;
    }
  };
  
  // 格式化存储使用量
  const formatStorageUsage = () => {
    const { current, limit } = status.storageUsage;
    const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    return `${mb(current)}MB / ${mb(limit)}MB`;
  };
  
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.indicator,
          { backgroundColor: color + '20' }
        ]}
        onPress={handlePress}
      >
        {status.syncStatus === 'syncing' ? (
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Icon name="sync" size={16} color={color} />
          </Animated.View>
        ) : (
          <Icon name={icon} size={16} color={color} />
        )}
        <Text
          variant="caption"
          color="text"
          style={styles.indicatorText}
        >
          {text}
        </Text>
        <Icon
          name={expanded ? 'expand-less' : 'expand-more'}
          size={16}
          color={colors.text}
        />
      </TouchableOpacity>
      
      <Animated.View
        style={[
          styles.details,
          {
            height,
            opacity: animatedOpacity,
            backgroundColor: colors.card,
          }
        ]}
      >
        <View style={styles.detailRow}>
          <Text
            variant="caption"
            color="hint"
          >
            状态:
          </Text>
          <Text
            variant="caption"
            color="text"
          >
            {status.isOnline ? '在线' : '离线'}
            {status.offlineMode ? ' (手动)' : ''}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text
            variant="caption"
            color="hint"
          >
            最后同步:
          </Text>
          <Text
            variant="caption"
            color="text"
          >
            {formatLastSyncTime()}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text
            variant="caption"
            color="hint"
          >
            待同步项:
          </Text>
          <Text
            variant="caption"
            color="text"
          >
            {status.pendingOperationsCount}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text
            variant="caption"
            color="hint"
          >
            存储使用:
          </Text>
          <Text
            variant="caption"
            color="text"
          >
            {formatStorageUsage()}
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.primary }
            ]}
            onPress={handleSyncPress}
            disabled={!status.isOnline || status.pendingOperationsCount === 0 || status.syncStatus === 'syncing'}
          >
            <Icon name="sync" size={16} color="#FFFFFF" />
            <Text
              variant="caption"
              color="card"
              style={styles.actionButtonText}
            >
              立即同步
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  indicatorText: {
    flex: 1,
    marginLeft: 8,
  },
  details: {
    marginTop: 8,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionButtonText: {
    marginLeft: 4,
  },
});

export default OfflineIndicator;
