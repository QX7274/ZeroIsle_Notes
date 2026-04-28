/**
 * 同步按钮组件
 * 用于手动触发同步操作
 */

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { syncService } from '../../services/sync/syncService';
import { networkService } from '../../services/network/networkService';
import { SYNC_EVENTS } from '../../services/sync/syncEvents';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const SyncButton = ({ style, iconOnly = false, showStatus = false }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isOnline, setIsOnline] = useState(networkService.isOnline());
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    // 初始化
    const init = async () => {
      await syncService.initialize();
      const status = syncService.getSyncStatus();
      setLastSyncTime(status.lastSyncTime);
      setIsSyncing(status.isSyncing);
    };

    init();

    // 监听同步事件
    const startListener = syncService.addListener(SYNC_EVENTS.SYNC_STARTED, () => {
      setIsSyncing(true);
      setSyncStatus('同步中...');
    });

    const completeListener = syncService.addListener(SYNC_EVENTS.SYNC_COMPLETED, (data) => {
      setIsSyncing(false);
      setLastSyncTime(new Date(data.timestamp));
      setSyncStatus('同步成功');
    });

    const failedListener = syncService.addListener(SYNC_EVENTS.SYNC_FAILED, (error) => {
      setIsSyncing(false);
      setSyncStatus(`同步失败: ${error.message || '未知错误'}`);
    });

    // 监听网络状态
    const networkListener = networkService.addListener('change', (status) => {
      setIsOnline(Boolean(status?.isOnline));
    });

    // 清理函数
    return () => {
      startListener();
      completeListener();
      failedListener();
      networkListener();
    };
  }, []);

  // 显示同步状态信息
  const showSyncInfo = () => {
    if (!isOnline) {
      setSyncStatus('网络离线，等待网络恢复');
      return;
    }

    if (isSyncing) {
      setSyncStatus('正在同步关键数据...');
      return;
    }

    setSyncStatus('关键数据自动同步中');
  };

  // 格式化上次同步时间
  const getFormattedLastSyncTime = () => {
    if (!lastSyncTime) {return '从未同步';}

    try {
      return formatDistanceToNow(new Date(lastSyncTime), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch (error) {
      return '未知时间';
    }
  };

  // 渲染状态指示器
  useEffect(() => {
    // 显示同步状态信息
    showSyncInfo();
  }, [isOnline, isSyncing]);

  // 渲染图标指示器
  if (iconOnly) {
    return (
      <View style={[styles.iconButton, style]}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#2196F3" />
        ) : (
          <Icon
            name={isOnline ? 'cloud-sync' : 'cloud-off-outline'}
            size={24}
            color={isOnline ? '#2196F3' : '#999'}
          />
        )}
      </View>
    );
  }

  // 渲染状态指示器
  return (
    <View style={[styles.container, style]}>
      <View style={styles.statusIndicator}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#2196F3" style={styles.icon} />
        ) : (
          <Icon
            name={isOnline ? 'cloud-sync' : 'cloud-off-outline'}
            size={20}
            color={isOnline ? '#2196F3' : '#999'}
            style={styles.icon}
          />
        )}
        <Text style={styles.statusIndicatorText}>
          {isSyncing ? '同步中...' : (isOnline ? '自动同步已启用' : '等待网络连接')}
        </Text>
      </View>

      {showStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            {syncStatus || `上次同步: ${getFormattedLastSyncTime()}`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIndicatorText: {
    color: '#0D47A1',
    fontWeight: '500',
    marginLeft: 8,
    fontSize: 14,
  },
  icon: {
    marginRight: 4,
  },
  iconButton: {
    padding: 8,
  },
  statusContainer: {
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#757575',
  },
});

export default SyncButton;
