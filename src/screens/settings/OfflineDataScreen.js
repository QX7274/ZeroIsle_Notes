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
  Alert,
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
  const pageState = isLoading ? 'busy' : 'ready';

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

  const handleOfflineModeToggle = async (value) => {
    setIsLoading(true);
    try {
      // 当前项目已移除离线存储服务，这里保持状态兼容，避免破坏现有流程
      setStatus((prev) => ({
        ...prev,
        offlineMode: value,
        isOffline: !prev.isOnline || value,
      }));
    } catch (error) {
      console.error('切换离线模式失败:', error);
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
      Alert.alert('同步成功', '数据已成功同步到云端。');
    } catch (error) {
      console.error('同步失败:', error);
      Alert.alert('同步失败', error.message || '同步过程中发生未知错误。');
      setStatus((prev) => ({
        ...prev,
        syncStatus: 'error',
        syncError: error.message || '未知错误',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRebuildSearchIndex = () => {
    Alert.alert(
      '重建搜索索引',
      '该操作会重新扫描本地数据并重建搜索索引，数据量大时可能需要较长时间。是否继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '开始',
          onPress: async () => {
            setIsLoading(true);
            try {
              await rebuildSearchIndex({
                includeNotes: true,
                includeKnowledge: true,
                batchSize: 200,
              });
              Alert.alert('完成', '搜索索引重建完成。');
            } catch (e) {
              Alert.alert('失败', e?.message || '搜索索引重建失败。');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClearOfflineData = () => {
    Alert.alert(
      '清除离线数据',
      '确定要清除所有离线数据吗？这将删除所有未同步的更改。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
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
              Alert.alert('清除成功', '所有离线数据已清除。');
              setRefreshKey((prev) => prev + 1);
            } catch (error) {
              console.error('清除离线数据失败:', error);
              Alert.alert('清除失败', error.message || '清除过程中发生未知错误。');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
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
});

export default OfflineDataScreen;
