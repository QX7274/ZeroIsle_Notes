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
import networkService from '../../services/network/networkService';

/**
 * 离线状态指示器组件
 * @param {Function} onPress - 点击回调
 * @param {Object} style - 自定义样式
 */
const OfflineIndicator = ({ onPress, style }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 状态
  const [status, setStatus] = useState({ isOnline: true });
  const [expanded, setExpanded] = useState(false);

  // 动画值
  const animatedHeight = new Animated.Value(0);
  const animatedOpacity = new Animated.Value(0);
  const syncIconRotation = new Animated.Value(0);

  // 监听网络状态变化
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkStatus = await networkService.checkConnection();
        setStatus(networkStatus);
      } catch (error) {
        console.error('检查网络状态失败:', error);
        setStatus({ isOnline: false });
      }
    };

    // 初始检查
    checkNetworkStatus();

    // 定期检查网络状态
    const interval = setInterval(checkNetworkStatus, 30000); // 每30秒检查一次

    return () => clearInterval(interval);
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
    // 先重置动画值
    syncIconRotation.setValue(0);

    // 创建并启动循环动画
    Animated.loop(
      Animated.timing(syncIconRotation, {
        toValue: 1,
        duration: 800, // 加快速度，使动画更流畅
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    console.log('旋转动画已启动');
  };

  // 停止旋转动画
  const stopRotationAnimation = () => {
    // 停止动画并重置值
    syncIconRotation.stopAnimation();
    syncIconRotation.setValue(0);
    console.log('旋转动画已停止');
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
    if (status.syncStatus === 'syncing') {return;}

    try {
      // 手动同步功能已移除，现在使用 realmService
      console.log('手动同步功能已移除');
    } catch (error) {
      console.error('手动同步失败:', error);
    }
  };

  // 获取状态图标和颜色
  const getStatusIconAndColor = () => {
    // 如果正在同步，显示同步状态
    if (status.syncStatus === 'syncing') {
      return {
        icon: 'sync',
        color: colors.primary,
        text: '正在同步...',
      };
    }

    // 如果没有网络连接，显示离线状态
    if (!status.isOnline) {
      return {
        icon: 'signal-wifi-off',
        color: colors.error,
        text: '无网络连接',
      };
    }

    // 如果有待同步的操作，显示待同步状态
    if (status.pendingOperationsCount > 0) {
      return {
        icon: 'sync',
        color: colors.warning,
        text: `${status.pendingOperationsCount}项待同步`,
      };
    }

    // 默认状态：已同步
    return {
      icon: 'cloud-done',
      color: colors.success,
      text: '已同步',
    };
  };

  const { icon, color, text } = getStatusIconAndColor();

  // 格式化最后同步时间
  const formatLastSyncTime = () => {
    if (!status.lastSyncTime) {return '从未同步';}

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
          { backgroundColor: color + '20' },
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
          },
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
              { backgroundColor: colors.primary },
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  indicatorText: {
    flex: 1,
    marginLeft: 10,
    fontWeight: '600',
    fontSize: 14,
  },
  details: {
    marginTop: 10,
    borderRadius: 16,
    padding: 18,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center', // 居中对齐
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // 居中对齐
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 120, // 增加最小宽度
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default OfflineIndicator;
