/**
 * 同步指示器组件
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@react-navigation/native';
import useSyncStatus from '../hooks/useSyncStatus';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 同步指示器组件
 * @param {Object} props 组件属性
 * @returns {JSX.Element} 组件
 */
const SyncIndicator = ({ style, showText = false, size = 24, onPress }) => {
  const theme = useTheme();
  const { 
    isSyncing, 
    lastSyncTime, 
    queueLength, 
    isOnline, 
    syncNow, 
    error 
  } = useSyncStatus();
  
  const [spinValue] = useState(new Animated.Value(0));
  const [lastSyncTimeText, setLastSyncTimeText] = useState('');

  // 旋转动画
  useEffect(() => {
    let animation;
    
    if (isSyncing) {
      // 创建旋转动画
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      
      // 启动动画
      animation.start();
    } else {
      // 停止动画
      spinValue.setValue(0);
    }
    
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isSyncing, spinValue]);

  // 格式化上次同步时间
  useEffect(() => {
    if (lastSyncTime) {
      const updateTimeText = () => {
        try {
          const syncDate = new Date(lastSyncTime);
          const timeText = formatDistanceToNow(syncDate, { 
            addSuffix: true,
            locale: zhCN,
          });
          setLastSyncTimeText(timeText);
        } catch (err) {
          setLastSyncTimeText('未知时间');
        }
      };
      
      // 立即更新
      updateTimeText();
      
      // 每分钟更新一次
      const interval = setInterval(updateTimeText, 60000);
      
      return () => clearInterval(interval);
    } else {
      setLastSyncTimeText('从未同步');
    }
  }, [lastSyncTime]);

  // 旋转动画插值
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // 获取图标和颜色
  const getIconAndColor = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-off',
        color: theme.colors.notification,
      };
    }
    
    if (error) {
      return {
        icon: 'error',
        color: theme.colors.error,
      };
    }
    
    if (isSyncing) {
      return {
        icon: 'sync',
        color: theme.colors.primary,
      };
    }
    
    if (queueLength > 0) {
      return {
        icon: 'sync-problem',
        color: theme.colors.warning || '#FFA000',
      };
    }
    
    return {
      icon: 'cloud-done',
      color: theme.colors.success || '#4CAF50',
    };
  };

  const { icon, color } = getIconAndColor();

  // 处理点击事件
  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }
    
    if (!isOnline) {
      // 离线状态下不执行同步
      return;
    }
    
    if (!isSyncing && queueLength > 0) {
      try {
        await syncNow();
      } catch (err) {
        // 错误已在钩子中处理
      }
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handlePress}
      disabled={isSyncing || (!onPress && (queueLength === 0 || !isOnline))}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Icon name={icon} size={size} color={color} />
      </Animated.View>
      
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: theme.colors.text }]}>
            {isSyncing ? '正在同步...' : 
             !isOnline ? '离线模式' :
             error ? '同步错误' :
             queueLength > 0 ? `待同步: ${queueLength}` : 
             '已同步'}
          </Text>
          
          {lastSyncTime && (
            <Text style={[styles.timeText, { color: theme.colors.text }]}>
              {`上次同步: ${lastSyncTimeText}`}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  textContainer: {
    marginLeft: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    opacity: 0.7,
  },
});

export default SyncIndicator;
