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
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineStorageService } from '../../services/offline';
import { Button } from '../../components/common';

const OfflineDataScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 状态
  const [status, setStatus] = useState(offlineStorageService.getStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 监听离线存储服务状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (['connectionChange', 'offlineModeChange', 'syncStarted', 'syncCompleted', 'syncError', 'pendingOperationAdded', 'offlineDataCleared'].includes(event.type)) {
        setStatus(offlineStorageService.getStatus());
      }
    });

    return () => unsubscribe();
  }, []);

  // 处理离线模式切换
  const handleOfflineModeToggle = async (value) => {
    setIsLoading(true);
    try {
      await offlineStorageService.setOfflineMode(value);
    } catch (error) {
      console.error('切换离线模式失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理同步
  const handleSync = async () => {
    setIsLoading(true);
    try {
      const result = await offlineStorageService.manualSync();
      if (result.success) {
        Alert.alert('同步成功', result.message);
      } else {
        Alert.alert('同步失败', result.error);
      }
    } catch (error) {
      console.error('同步失败:', error);
      Alert.alert('同步失败', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理清除离线数据
  const handleClearOfflineData = () => {
    Alert.alert(
      '清除离线数据',
      '确定要清除所有离线数据吗？这将删除所有未同步的更改。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '清除',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await offlineStorageService.clearOfflineData();
              if (result.success) {
                Alert.alert('清除成功', '所有离线数据已清除');
                setRefreshKey(prev => prev + 1);
              } else {
                Alert.alert('清除失败', result.error);
              }
            } catch (error) {
              console.error('清除离线数据失败:', error);
              Alert.alert('清除失败', error.message);
            } finally {
              setIsLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // 格式化最后同步时间
  const formatLastSyncTime = () => {
    if (!status.lastSyncTime) return '从未同步';

    const lastSync = new Date(status.lastSyncTime);
    return lastSync.toLocaleString();
  };

  // 格式化存储使用量
  const formatStorageUsage = () => {
    const { current, limit, percentage } = status.storageUsage;
    const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
    return `${mb(current)}MB / ${mb(limit)}MB (${percentage.toFixed(1)}%)`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} key={refreshKey}>
        {/* 离线模式设置 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="cloud-off" size={24} color={colors.primary} />
            <Text
              variant="heading"
              level="h6"
              style={styles.sectionTitle}
            >
              离线模式
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text
                variant="body"
                size="medium"
              >
                启用离线模式
              </Text>
              <Text
                variant="caption"
                color="hint"
              >
                在离线模式下，应用不会尝试连接服务器
              </Text>
            </View>

            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={status.offlineMode}
                onValueChange={handleOfflineModeToggle}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={status.offlineMode ? colors.primary : colors.card}
              />
            )}
          </View>
        </View>

        {/* 同步状态 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="sync" size={24} color={colors.primary} />
            <Text
              variant="heading"
              level="h6"
              style={styles.sectionTitle}
            >
              同步状态
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text
              variant="body"
              size="medium"
              color="hint"
            >
              网络状态
            </Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: status.isOnline ? colors.success : colors.error }
                ]}
              />
              <Text
                variant="body"
                size="medium"
              >
                {status.isOnline ? '在线' : '离线'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text
              variant="body"
              size="medium"
              color="hint"
            >
              最后同步时间
            </Text>
            <Text
              variant="body"
              size="medium"
            >
              {formatLastSyncTime()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text
              variant="body"
              size="medium"
              color="hint"
            >
              待同步项
            </Text>
            <Text
              variant="body"
              size="medium"
            >
              {status.pendingOperationsCount}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text
              variant="body"
              size="medium"
              color="hint"
            >
              同步状态
            </Text>
            <Text
              variant="body"
              size="medium"
              style={status.syncStatus === 'error' && { color: colors.error }}
            >
              {status.syncStatus === 'idle' ? '空闲' :
               status.syncStatus === 'syncing' ? '同步中' :
               `错误: ${status.syncError}`}
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

        {/* 存储使用 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="storage" size={24} color={colors.primary} />
            <Text
              variant="heading"
              level="h6"
              style={styles.sectionTitle}
            >
              存储使用
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text
              variant="body"
              size="medium"
              color="hint"
            >
              离线存储使用量
            </Text>
            <Text
              variant="body"
              size="medium"
            >
              {formatStorageUsage()}
            </Text>
          </View>

          <View
            style={[
              styles.storageBar,
              { backgroundColor: colors.border }
            ]}
          >
            <View
              style={[
                styles.storageUsed,
                {
                  width: `${Math.min(status.storageUsage.percentage, 100)}%`,
                  backgroundColor: status.storageUsage.percentage > 90 ? colors.error :
                                  status.storageUsage.percentage > 70 ? colors.warning :
                                  colors.success
                }
              ]}
            />
          </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    borderBottomColor: '#f0f0f0',
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
  },
  storageUsed: {
    height: '100%',
  },
  clearButton: {
    margin: 16,
  },
});

export default OfflineDataScreen;
