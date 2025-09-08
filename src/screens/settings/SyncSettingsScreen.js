/**
 * 同步设置屏幕
 * 用于配置同步选项和查看同步状态
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { syncService } from '../../services/sync/syncService';
import { configService } from '../../services/app/configService';
import { networkService } from '../../services/network/networkService';
import { logService } from '../../services/utils/logService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import networkErrorService from '../../services/networkErrorService';
import SyncButton from '../../components/common/SyncButton';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const SyncSettingsScreen = ({ navigation }) => {
  const [syncConfig, setSyncConfig] = useState({
    autoSync: true,
    syncInterval: 30,
    syncOnAppStart: true,
    syncOnAppBackground: true,
  });
  const [syncStatus, setSyncStatus] = useState({
    lastSyncTime: null,
    isSyncing: false,
    offlineQueueLength: 0,
    isOnline: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 设置导航标题
    navigation.setOptions({
      title: '同步设置',
    });

    // 加载配置和状态
    const loadData = async () => {
      try {
        // 初始化同步服务
        await syncService.initialize();

        // 获取配置
        const config = await configService.getConfig();
        setSyncConfig({
          autoSync: config.sync?.autoSync ?? true,
          syncInterval: config.sync?.syncInterval ? config.sync.syncInterval / (60 * 1000) : 30,
          syncOnAppStart: config.sync?.syncOnAppStart ?? true,
          syncOnAppBackground: config.sync?.syncOnAppBackground ?? true,
        });

        // 获取同步状态
        const status = syncService.getSyncStatus();
        setSyncStatus({
          lastSyncTime: status.lastSyncTime,
          isSyncing: status.isSyncing,
          offlineQueueLength: status.offlineQueueLength,
          isOnline: networkService.isOnline(),
        });

        setLoading(false);
      } catch (error) {
        logService.error('加载同步设置失败', error);
        
        // 使用网络错误服务处理错误
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '加载同步设置',
            customMessage: '网络连接失败，无法加载同步设置'
          });
        } else {
          Alert.alert('错误', '加载同步设置失败');
        }
        
        setLoading(false);
      }
    };

    loadData();
  }, [navigation]);

  // 更新配置
  const updateConfig = async (key, value) => {
    try {
      // 更新本地状态
      setSyncConfig(prev => ({
        ...prev,
        [key]: value,
      }));

      // 准备新配置
      const newConfig = {
        ...syncConfig,
        [key]: value,
      };

      // 转换为毫秒
      const syncIntervalMs = newConfig.syncInterval * 60 * 1000;

      // 更新配置服务
      await configService.updateConfig('sync', {
        autoSync: newConfig.autoSync,
        syncInterval: syncIntervalMs,
        syncOnAppStart: newConfig.syncOnAppStart,
        syncOnAppBackground: newConfig.syncOnAppBackground,
      });

      // 如果更新了自动同步或同步间隔，更新同步服务
      if (key === 'autoSync' || key === 'syncInterval') {
        if (newConfig.autoSync) {
          syncService.setAutoSyncInterval(newConfig.syncInterval);
        } else {
          syncService.stopAutoSync();
        }
      }

      logService.info('同步设置已更新', { [key]: value });
    } catch (error) {
      logService.error('更新同步设置失败', error);
      Alert.alert('错误', '更新同步设置失败');
    }
  };

  // 清空离线队列
  const clearOfflineQueue = async () => {
    try {
      Alert.alert(
        '确认清空',
        '确定要清空离线队列吗？这将删除所有未同步的操作。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            style: 'destructive',
            onPress: async () => {
              await syncService.clearOfflineQueue();

              // 更新状态
              const status = syncService.getSyncStatus();
              setSyncStatus(prev => ({
                ...prev,
                offlineQueueLength: status.offlineQueueLength,
              }));

              Alert.alert('成功', '离线队列已清空');
            },
          },
        ]
      );
    } catch (error) {
      logService.error('清空离线队列失败', error);
      Alert.alert('错误', '清空离线队列失败');
    }
  };

  // 格式化上次同步时间
  const formatLastSyncTime = () => {
    if (!syncStatus.lastSyncTime) return '从未同步';

    try {
      const date = new Date(syncStatus.lastSyncTime);
      return `${format(date, 'yyyy-MM-dd HH:mm:ss')} (${formatDistanceToNow(date, { addSuffix: true, locale: zhCN })})`;
    } catch (error) {
      return '未知时间';
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 同步状态 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>同步状态</Text>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>网络状态:</Text>
          <View style={styles.statusValue}>
            <Icon
              name={syncStatus.isOnline ? 'wifi' : 'wifi-off'}
              size={18}
              color={syncStatus.isOnline ? '#4CAF50' : '#F44336'}
              style={styles.statusIcon}
            />
            <Text>{syncStatus.isOnline ? '在线' : '离线'}</Text>
          </View>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>上次同步:</Text>
          <Text style={styles.statusValue}>{formatLastSyncTime()}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>离线队列:</Text>
          <Text style={styles.statusValue}>{syncStatus.offlineQueueLength} 个操作</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>同步状态:</Text>
          <Text style={styles.statusValue}>
            {syncStatus.isSyncing ? '同步中...' : '关键信息自动同步'}
          </Text>
        </View>
        <View style={styles.infoContainer}>
          <Icon name="information" size={20} color="#2196F3" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            关键信息（如用户数据和设置）会自动同步到云端，无需手动操作
          </Text>
        </View>
      </View>

      {/* 同步设置 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>同步设置</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>自动同步</Text>
          <Switch
            value={syncConfig.autoSync}
            onValueChange={(value) => updateConfig('autoSync', value)}
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>同步间隔 (分钟)</Text>
          <View style={styles.intervalSelector}>
            <TouchableOpacity
              style={styles.intervalButton}
              onPress={() => updateConfig('syncInterval', Math.max(5, syncConfig.syncInterval - 5))}
            >
              <Icon name="minus" size={18} color="#2196F3" />
            </TouchableOpacity>
            <Text style={styles.intervalValue}>{syncConfig.syncInterval}</Text>
            <TouchableOpacity
              style={styles.intervalButton}
              onPress={() => updateConfig('syncInterval', Math.min(120, syncConfig.syncInterval + 5))}
            >
              <Icon name="plus" size={18} color="#2196F3" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>应用启动时同步</Text>
          <Switch
            value={syncConfig.syncOnAppStart}
            onValueChange={(value) => updateConfig('syncOnAppStart', value)}
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>应用切换到后台时同步</Text>
          <Switch
            value={syncConfig.syncOnAppBackground}
            onValueChange={(value) => updateConfig('syncOnAppBackground', value)}
          />
        </View>
      </View>

      {/* 高级选项 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>高级选项</Text>
        <TouchableOpacity
          style={styles.advancedButton}
          onPress={clearOfflineQueue}
          disabled={syncStatus.offlineQueueLength === 0}
        >
          <Icon name="delete-sweep" size={20} color="#F44336" style={styles.advancedButtonIcon} />
          <Text style={[styles.advancedButtonText, syncStatus.offlineQueueLength === 0 && styles.disabledText]}>
            清空离线队列
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0D47A1',
    flex: 1,
    lineHeight: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
  },
  intervalSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intervalButton: {
    padding: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
  },
  intervalValue: {
    marginHorizontal: 8,
    fontSize: 14,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  advancedButtonIcon: {
    marginRight: 8,
  },
  advancedButtonText: {
    color: '#F44336',
    fontSize: 14,
  },
  disabledText: {
    color: '#BDBDBD',
  },
});

export default SyncSettingsScreen;
