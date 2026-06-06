/**
 * 同步设置屏幕
 * 用于配置同步策略与查看同步状态
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { syncService } from '../../services/sync/syncService';
import { configService } from '../../services/app/configService';
import { networkService } from '../../services/network/networkService';
import networkErrorService from '../../services/networkErrorService';
import { logService } from '../../utils/logService';

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
  const [dialogState, setDialogState] = useState({
    visible: false,
    tone: 'warning',
    title: '',
    message: '',
    primaryText: '确定',
    secondaryText: '',
    onPrimary: null,
  });
  const pageState = loading ? 'loading' : 'ready';

  const closeDialog = () => {
    setDialogState((current) => ({
      ...current,
      visible: false,
      onPrimary: null,
    }));
  };

  const openDialog = (nextDialog) => {
    setDialogState({
      visible: true,
      tone: nextDialog.tone || 'warning',
      title: nextDialog.title || '',
      message: nextDialog.message || '',
      primaryText: nextDialog.primaryText || '确定',
      secondaryText: nextDialog.secondaryText || '',
      onPrimary: nextDialog.onPrimary || null,
    });
  };

  const showSyncError = (title, message) => {
    openDialog({
      tone: 'error',
      title,
      message,
      primaryText: '知道了',
    });
  };

  useEffect(() => {
    navigation.setOptions({ title: '同步设置' });

    const loadData = async () => {
      try {
        await syncService.initialize();

        const config = await configService.getConfig();
        setSyncConfig({
          autoSync: config.sync?.autoSync ?? true,
          syncInterval: config.sync?.syncInterval ? config.sync.syncInterval / (60 * 1000) : 30,
          syncOnAppStart: config.sync?.syncOnAppStart ?? true,
          syncOnAppBackground: config.sync?.syncOnAppBackground ?? true,
        });

        const status = syncService.getSyncStatus();
        setSyncStatus({
          lastSyncTime: status.lastSyncTime,
          isSyncing: status.isSyncing,
          offlineQueueLength: status.offlineQueueLength,
          isOnline: networkService.isOnline(),
        });
      } catch (error) {
        logService.error('加载同步设置失败', error);
        showSyncError(
          '加载同步设置失败',
          networkErrorService.isNetworkError(error)
            ? '网络连接失败，无法加载同步设置，请稍后重试。'
            : '加载同步设置失败，请稍后重试。'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigation]);

  const updateConfig = async (key, value) => {
    const nextConfig = { ...syncConfig, [key]: value };
    setSyncConfig(nextConfig);

    try {
      await configService.updateConfig('sync', {
        autoSync: nextConfig.autoSync,
        syncInterval: nextConfig.syncInterval * 60 * 1000,
        syncOnAppStart: nextConfig.syncOnAppStart,
        syncOnAppBackground: nextConfig.syncOnAppBackground,
      });

      if (key === 'autoSync' || key === 'syncInterval') {
        if (nextConfig.autoSync) {
          syncService.setAutoSyncInterval(nextConfig.syncInterval);
        } else {
          syncService.stopAutoSync();
        }
      }

      logService.info('同步设置已更新', { [key]: value });
    } catch (error) {
      logService.error('更新同步设置失败', error);
      setSyncConfig(syncConfig);
      showSyncError('同步设置更新失败', '同步设置更新失败，请稍后重试。');
    }
  };

  const refreshStatus = () => {
    const status = syncService.getSyncStatus();
    setSyncStatus({
      lastSyncTime: status.lastSyncTime,
      isSyncing: status.isSyncing,
      offlineQueueLength: status.offlineQueueLength,
      isOnline: networkService.isOnline(),
    });
  };

  const clearOfflineQueue = async () => {
    openDialog({
      tone: 'warning',
      title: '确认清空',
      message: '确定要清空离线队列吗？这将删除所有未同步操作。',
      primaryText: '确定',
      secondaryText: '取消',
      onPrimary: async () => {
        try {
          await syncService.clearOfflineQueue();
          refreshStatus();
        } catch (error) {
          logService.error('清空离线队列失败', error);
          showSyncError('清空离线队列失败', '清空离线队列失败，请稍后重试。');
        }
      },
    });
  };

  const renderDialog = () => (
    <Modal visible={dialogState.visible} transparent animationType="fade" onRequestClose={closeDialog}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <View
            style={[
              styles.dialogIconWrap,
              dialogState.tone === 'error' ? styles.errorIconWrap : styles.warningIconWrap,
            ]}
          >
            <Icon
              name={dialogState.tone === 'error' ? 'close-octagon-outline' : 'alert-circle-outline'}
              size={28}
              color={dialogState.tone === 'error' ? '#DC2626' : '#D97706'}
            />
          </View>
          <Text style={styles.dialogTitle}>{dialogState.title}</Text>
          <Text style={styles.dialogMessage}>{dialogState.message}</Text>
          <View style={styles.dialogButtonRow}>
            {dialogState.secondaryText ? (
              <TouchableOpacity style={styles.dialogSecondaryButton} onPress={closeDialog}>
                <Text style={styles.dialogSecondaryText}>{dialogState.secondaryText}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.dialogPrimaryButton,
                dialogState.tone === 'error' ? styles.errorPrimaryButton : styles.warningPrimaryButton,
              ]}
              onPress={async () => {
                const handler = dialogState.onPrimary;
                closeDialog();
                if (handler) {
                  await handler();
                }
              }}
            >
              <Text style={styles.dialogPrimaryText}>{dialogState.primaryText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const formatLastSyncTime = () => {
    if (!syncStatus.lastSyncTime) return '从未同步';
    try {
      const date = new Date(syncStatus.lastSyncTime);
      return `${format(date, 'yyyy-MM-dd HH:mm:ss')}（${formatDistanceToNow(date, { addSuffix: true, locale: zhCN })}）`;
    } catch (error) {
      return '时间格式异常';
    }
  };

  return (
    <ScrollView style={styles.container} testID={`state.settings.sync.state.${pageState}`}>
      <View testID="state.settings.sync.visibility.visible" />
      <View testID={`state.settings.sync.online.${syncStatus.isOnline ? 'on' : 'off'}`} />
      <View testID={`state.settings.sync.autoSync.${syncConfig.autoSync ? 'on' : 'off'}`} />
      <View testID={`state.settings.sync.queue.visibility.${syncStatus.offlineQueueLength > 0 ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.sync.syncing.visibility.${syncStatus.isSyncing ? 'visible' : 'hidden'}`} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>同步状态</Text>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>网络状态</Text>
          <View style={styles.statusValueRow}>
            <Icon
              name={syncStatus.isOnline ? 'wifi' : 'wifi-off'}
              size={18}
              color={syncStatus.isOnline ? '#16A34A' : '#DC2626'}
              style={styles.statusIcon}
            />
            <Text style={styles.statusValueText}>{syncStatus.isOnline ? '在线' : '离线'}</Text>
          </View>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>上次同步</Text>
          <Text style={styles.statusValueText}>{formatLastSyncTime()}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>离线队列</Text>
          <Text style={styles.statusValueText}>{syncStatus.offlineQueueLength} 个待同步操作</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>同步进度</Text>
          <Text style={styles.statusValueText}>{syncStatus.isSyncing ? '同步中...' : '空闲'}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Icon name="information-outline" size={20} color="#1D4ED8" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            关键数据会自动同步到云端；离线期间的变更会在网络恢复后自动补传。
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>同步策略</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>自动同步</Text>
          <Switch
            value={syncConfig.autoSync}
            onValueChange={(value) => updateConfig('autoSync', value)}
            testID="action.settings.sync.toggleAutoSync"
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>同步间隔（分钟）</Text>
          <View style={styles.intervalSelector}>
            <TouchableOpacity
              style={styles.intervalButton}
              onPress={() => updateConfig('syncInterval', Math.max(5, syncConfig.syncInterval - 5))}
              testID="action.settings.sync.decreaseInterval"
            >
              <Icon name="minus" size={18} color="#1D4ED8" />
            </TouchableOpacity>
            <Text style={styles.intervalValue}>{syncConfig.syncInterval}</Text>
            <TouchableOpacity
              style={styles.intervalButton}
              onPress={() => updateConfig('syncInterval', Math.min(120, syncConfig.syncInterval + 5))}
              testID="action.settings.sync.increaseInterval"
            >
              <Icon name="plus" size={18} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>应用启动时同步</Text>
          <Switch
            value={syncConfig.syncOnAppStart}
            onValueChange={(value) => updateConfig('syncOnAppStart', value)}
            testID="action.settings.sync.toggleOnAppStart"
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>切到后台时同步</Text>
          <Switch
            value={syncConfig.syncOnAppBackground}
            onValueChange={(value) => updateConfig('syncOnAppBackground', value)}
            testID="action.settings.sync.toggleOnBackground"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>高级选项</Text>
        <TouchableOpacity
          style={styles.advancedButton}
          onPress={clearOfflineQueue}
          disabled={syncStatus.offlineQueueLength === 0}
          testID="action.settings.sync.clearOfflineQueue"
        >
          <Icon name="delete-sweep" size={20} color={syncStatus.offlineQueueLength === 0 ? '#94A3B8' : '#DC2626'} style={styles.advancedButtonIcon} />
          <Text style={[styles.advancedButtonText, syncStatus.offlineQueueLength === 0 && styles.disabledText]}>
            清空离线队列
          </Text>
        </TouchableOpacity>
      </View>
      {renderDialog()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#D4E5FF',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#102A43',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F1FF',
    paddingVertical: 9,
  },
  statusLabel: {
    color: '#486581',
    fontSize: 14,
  },
  statusValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  statusValueText: {
    color: '#102A43',
    fontSize: 14,
  },
  infoContainer: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(219,234,254,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    color: '#1E3A8A',
    lineHeight: 20,
    fontSize: 13,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F1FF',
    paddingVertical: 10,
  },
  settingLabel: {
    color: '#102A43',
    fontSize: 14,
    fontWeight: '500',
  },
  intervalSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intervalButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C9DEFF',
  },
  intervalValue: {
    minWidth: 34,
    marginHorizontal: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#102A43',
    fontWeight: '700',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  advancedButtonIcon: {
    marginRight: 8,
  },
  advancedButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.9)',
  },
  dialogIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  warningIconWrap: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
  },
  errorIconWrap: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  dialogMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 22,
  },
  dialogSecondaryButton: {
    minWidth: 84,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E4FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  dialogSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  dialogPrimaryButton: {
    minWidth: 84,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningPrimaryButton: {
    backgroundColor: '#D97706',
  },
  errorPrimaryButton: {
    backgroundColor: '#DC2626',
  },
  dialogPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledText: {
    color: '#94A3B8',
  },
});

export default SyncSettingsScreen;
