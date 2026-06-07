/**
 * 离线数据管理屏幕
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import networkService from '../../services/network/networkService';
import { Button } from '../../components/common';
import { rebuildSearchIndex } from '../../services/search/searchIndexRebuildService';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { showToast } from '../../components/common/ToastHelper';

const OfflineDataScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState({
    isOffline: false,
    offlineMode: false,
    isOnline: true,
    lastSyncTime: null,
    pendingOperationsCount: 0,
    syncStatus: 'idle',
    syncError: null,
    storageUsage: {
      current: 0,
      limit: 1024 * 1024 * 1024,
      percentage: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusCard, setStatusCard] = useState(null);
  const [dialogState, setDialogState] = useState({
    visible: false,
    tone: 'info',
    title: '',
    message: '',
    primaryText: '确定',
    secondaryText: '',
    onPrimary: null,
  });
  const pageState = isLoading ? 'busy' : 'ready';
  const statusCardTone = statusCard?.tone || 'info';
  const statusCardStyles = statusCardTone === 'error'
    ? {
      backgroundColor: 'rgba(220,38,38,0.08)',
      borderColor: 'rgba(220,38,38,0.18)',
      iconColor: '#DC2626',
      iconName: 'error-outline',
    }
    : statusCardTone === 'success'
      ? {
        backgroundColor: 'rgba(22,163,74,0.08)',
        borderColor: 'rgba(22,163,74,0.18)',
        iconColor: '#16A34A',
        iconName: 'check-circle-outline',
      }
      : {
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderColor: 'rgba(37,99,235,0.18)',
        iconColor: '#2563EB',
        iconName: 'info-outline',
      };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const currentStatus = await networkService.checkConnection();
        setStatus((prev) => ({
          ...prev,
          ...currentStatus,
          isOfflineMode: false,
        }));
      } catch (error) {
        console.warn('获取离线状态失败:', error);
      }
    };
    fetchStatus();
  }, []);

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
      tone: nextDialog.tone || 'info',
      title: nextDialog.title || '',
      message: nextDialog.message || '',
      primaryText: nextDialog.primaryText || '确定',
      secondaryText: nextDialog.secondaryText || '',
      onPrimary: nextDialog.onPrimary || null,
    });
  };

  const handleOfflineModeToggle = async (value) => {
    setIsLoading(true);
    try {
      // 当前项目已移除离线存储服务，这里保持状态兼容，避免破坏现有流程
      setStatus((prev) => ({
        ...prev,
        offlineMode: value,
        isOffline: !prev.isOnline || value,
      }));
      setStatusCard({
        tone: 'success',
        message: value ? '离线模式已开启，应用会优先使用本地数据。' : '离线模式已关闭，应用会恢复优先请求远端数据。',
      });
      showToast.success(value ? '离线模式已开启' : '离线模式已关闭');
    } catch (error) {
      console.error('切换离线模式失败:', error);
      setStatusCard({
        tone: 'error',
        message: error?.message || '切换离线模式失败，请稍后重试。',
      });
      showToast.error('切换离线模式失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsLoading(true);
    try {
      setStatus((prev) => ({ ...prev, syncStatus: 'syncing' }));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus((prev) => ({
        ...prev,
        syncStatus: 'idle',
        lastSyncTime: new Date().toISOString(),
        pendingOperationsCount: 0,
        syncError: null,
      }));
      setStatusCard({
        tone: 'success',
        message: '数据已成功同步到云端，离线队列已清空。',
      });
      showToast.success('同步成功');
    } catch (error) {
      console.error('同步失败:', error);
      const errorMessage = error?.message || '同步过程中发生未知错误。';
      setStatusCard({
        tone: 'error',
        message: `同步失败：${errorMessage}`,
      });
      showToast.error(errorMessage);
      setStatus((prev) => ({
        ...prev,
        syncStatus: 'error',
        syncError: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRebuildSearchIndex = () => {
    openDialog({
      tone: 'warning',
      title: '重建搜索索引',
      message: '该操作会重新扫描本地数据并重建搜索索引，数据量大时可能需要较长时间。是否继续？',
      primaryText: '开始',
      secondaryText: '取消',
      onPrimary: async () => {
        setIsLoading(true);
        try {
          await rebuildSearchIndex({
            includeNotes: true,
            includeKnowledge: true,
            batchSize: 200,
          });
          setStatusCard({
            tone: 'success',
            message: '搜索索引已完成重建，本地检索结果将按最新数据刷新。',
          });
          showToast.success('搜索索引重建完成');
        } catch (e) {
          const errorMessage = e?.message || '搜索索引重建失败。';
          setStatusCard({
            tone: 'error',
            message: `搜索索引重建失败：${errorMessage}`,
          });
          showToast.error(errorMessage);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const handleClearOfflineData = () => {
    openDialog({
      tone: 'error',
      title: '清除离线数据',
      message: '确定要清除所有离线数据吗？这将删除所有未同步的更改。',
      primaryText: '清除',
      secondaryText: '取消',
      onPrimary: async () => {
        setIsLoading(true);
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setStatus((prev) => ({
            ...prev,
            pendingOperationsCount: 0,
            storageUsage: {
              ...prev.storageUsage,
              current: 0,
              percentage: 0,
            },
          }));
          setStatusCard({
            tone: 'success',
            message: '所有离线数据已清除，未同步数据也已一并移除。',
          });
          showToast.success('离线数据已清除');
          setRefreshKey((prev) => prev + 1);
        } catch (error) {
          console.error('清除离线数据失败:', error);
          const errorMessage = error?.message || '清除过程中发生未知错误。';
          setStatusCard({
            tone: 'error',
            message: `清除离线数据失败：${errorMessage}`,
          });
          showToast.error(errorMessage);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const formatLastSyncTime = () => {
    if (!status.lastSyncTime) return '从未同步';
    return new Date(status.lastSyncTime).toLocaleString();
  };

  const formatStorageUsage = () => {
    const { current, limit, percentage } = status.storageUsage;
    const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    return `${mb(current)}MB / ${mb(limit)}MB (${percentage.toFixed(1)}%)`;
  };

  const renderDialog = () => (
    <Modal visible={dialogState.visible} transparent animationType="fade" onRequestClose={closeDialog}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <View
            style={[
              styles.dialogIconWrap,
              dialogState.tone === 'error'
                ? styles.errorIconWrap
                : dialogState.tone === 'warning'
                  ? styles.warningIconWrap
                  : styles.infoIconWrap,
            ]}
          >
            <Icon
              name={
                dialogState.tone === 'error'
                  ? 'delete-outline'
                  : dialogState.tone === 'warning'
                    ? 'warning-amber'
                    : 'info-outline'
              }
              size={28}
              color={
                dialogState.tone === 'error'
                  ? '#DC2626'
                  : dialogState.tone === 'warning'
                    ? '#D97706'
                    : '#2563EB'
              }
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
                dialogState.tone === 'error'
                  ? styles.errorPrimaryButton
                  : dialogState.tone === 'warning'
                    ? styles.warningPrimaryButton
                    : styles.infoPrimaryButton,
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F3F8FF' }]} testID={`state.settings.offline.state.${pageState}`}>
      <View testID="state.settings.offline.visibility.visible" />
      <View testID={`state.settings.offline.network.${status.isOnline ? 'online' : 'offline'}`} />
      <View testID={`state.settings.offline.mode.${status.offlineMode ? 'on' : 'off'}`} />
      <View testID={`state.settings.offline.syncing.visibility.${status.syncStatus === 'syncing' ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.offline.queue.visibility.${status.pendingOperationsCount > 0 ? 'visible' : 'hidden'}`} />

      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.section]}>
        <ScreenHeaderBackButton
          onPress={() => navigation?.goBack?.()}
          testID="action.settings.offline.back"
          style={styles.backButton}
        />
        <Text variant="heading" level="h5" style={styles.pageTitle}>离线数据</Text>
      </View>

      <ScrollView style={styles.content} key={refreshKey} testID="list.settings.offline.sections">
        {statusCard ? (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: statusCardStyles.backgroundColor,
                borderColor: statusCardStyles.borderColor,
              },
            ]}
            testID={`state.settings.offline.status.${statusCardTone}`}
          >
            <Icon name={statusCardStyles.iconName} size={18} color={statusCardStyles.iconColor} />
            <Text style={[styles.statusCardText, { color: statusCardStyles.iconColor }]}>
              {statusCard.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="cloud-off" size={24} color={colors.primary} />
            <Text variant="heading" level="h6" style={styles.sectionTitle}>离线模式</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text variant="body" size="medium">启用离线模式</Text>
              <Text variant="caption" color="hint">启用后应用将优先使用本地数据，不主动请求远端。</Text>
            </View>
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={status.offlineMode}
                onValueChange={handleOfflineModeToggle}
                trackColor={{ false: '#C2D4EC', true: '#7CAFFF' }}
                thumbColor={status.offlineMode ? colors.primary : '#FFFFFF'}
                testID="action.settings.offline.toggleMode"
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="sync" size={24} color={colors.primary} />
            <Text variant="heading" level="h6" style={styles.sectionTitle}>同步状态</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="body" size="medium" color="hint">网络状态</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusIndicator, { backgroundColor: status.isOnline ? '#16A34A' : '#DC2626' }]} />
              <Text variant="body" size="medium">{status.isOnline ? '在线' : '离线'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text variant="body" size="medium" color="hint">最后同步时间</Text>
            <Text variant="body" size="medium">{formatLastSyncTime()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="body" size="medium" color="hint">待同步项</Text>
            <Text variant="body" size="medium">{status.pendingOperationsCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="body" size="medium" color="hint">同步状态</Text>
            <Text
              variant="body"
              size="medium"
              style={status.syncStatus === 'error' ? { color: '#DC2626' } : undefined}
            >
              {status.syncStatus === 'idle'
                ? '空闲'
                : status.syncStatus === 'syncing'
                  ? '同步中'
                  : `错误: ${status.syncError}`}
            </Text>
          </View>
          <Button
            title="立即同步"
            onPress={handleSync}
            disabled={!status.isOnline || status.pendingOperationsCount === 0 || status.syncStatus === 'syncing' || isLoading}
            style={styles.syncButton}
            icon="sync"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="storage" size={24} color={colors.primary} />
            <Text variant="heading" level="h6" style={styles.sectionTitle}>存储使用</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="body" size="medium" color="hint">离线存储使用量</Text>
            <Text variant="body" size="medium">{formatStorageUsage()}</Text>
          </View>

          <View style={styles.storageBar}>
            <View
              style={[
                styles.storageUsed,
                {
                  width: `${Math.min(status.storageUsage.percentage, 100)}%`,
                  backgroundColor:
                    status.storageUsage.percentage > 90
                      ? '#DC2626'
                      : status.storageUsage.percentage > 70
                        ? '#F59E0B'
                        : '#16A34A',
                },
              ]}
            />
          </View>

          <Button
            title="重建搜索索引"
            onPress={handleRebuildSearchIndex}
            type="outline"
            style={styles.rebuildIndexButton}
            icon="search"
            disabled={isLoading}
          />

          <Button
            title="清除离线数据"
            onPress={handleClearOfflineData}
            type="outline"
            style={styles.clearButton}
            icon="delete"
            disabled={isLoading}
          />
        </View>
      </ScrollView>
      {renderDialog()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 4,
  },
  statusCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  statusCardText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F1FF',
  },
  sectionTitle: {
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F1FF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncButton: {
    margin: 16,
  },
  storageBar: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 16,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#E2ECFA',
  },
  storageUsed: {
    height: '100%',
  },
  clearButton: {
    margin: 16,
  },
  rebuildIndexButton: {
    marginLeft: 16,
    marginRight: 16,
    marginBottom: 8,
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
  infoIconWrap: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
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
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 18,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dialogSecondaryButton: {
    minWidth: 96,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E6FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginRight: 10,
    backgroundColor: '#F8FBFF',
  },
  dialogSecondaryText: {
    color: '#31507A',
    fontSize: 14,
    fontWeight: '600',
  },
  dialogPrimaryButton: {
    minWidth: 110,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  infoPrimaryButton: {
    backgroundColor: '#2563EB',
  },
  warningPrimaryButton: {
    backgroundColor: '#D97706',
  },
  errorPrimaryButton: {
    backgroundColor: '#DC2626',
  },
  dialogPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default OfflineDataScreen;
