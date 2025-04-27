/**
 * 备份与恢复屏幕
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { pick, types } from '@react-native-documents/picker';
import { STORAGE_KEYS } from '../../utils/constants/config';
import { offlineStorageService } from '../../services/offlineStorage';
import { analyticsService } from '../../services/analytics';

const BackupRestoreScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const user = useSelector(state => state.auth.user);

  // 本地状态
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // 加载备份列表
  useEffect(() => {
    loadBackups();
  }, []);

  // 加载备份列表
  const loadBackups = async () => {
    setIsLoading(true);
    try {
      // 获取备份信息
      const backupInfoJson = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_INFO);
      const backupInfo = backupInfoJson ? JSON.parse(backupInfoJson) : [];

      // 检查备份文件是否存在
      const validBackups = [];
      for (const backup of backupInfo) {
        try {
          const exists = await RNFS.exists(backup.path);
          if (exists) {
            validBackups.push(backup);
          }
        } catch (error) {
          console.error('检查备份文件失败:', error);
        }
      }

      setBackups(validBackups);
    } catch (error) {
      console.error('加载备份列表失败:', error);
      Alert.alert('错误', '加载备份列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 请求存储权限（仅Android）
  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: '存储权限',
          message: '应用需要访问您的存储以创建备份',
          buttonNeutral: '稍后再说',
          buttonNegative: '取消',
          buttonPositive: '确定',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('请求存储权限失败:', error);
      return false;
    }
  };

  // 创建备份
  const createBackup = async () => {
    // 请求存储权限
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('权限被拒绝', '无法创建备份，因为存储权限被拒绝');
      return;
    }

    setIsCreatingBackup(true);
    try {
      // 获取所有存储键
      const keys = await AsyncStorage.getAllKeys();

      // 过滤需要备份的键
      const keysToBackup = keys.filter(key =>
        key.startsWith('notes_') ||
        key.startsWith('tags_') ||
        key.startsWith('categories_') ||
        key === STORAGE_KEYS.NOTES_CACHE ||
        key === STORAGE_KEYS.SETTINGS
      );

      // 获取所有数据
      const data = {};
      for (const key of keysToBackup) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          data[key] = value;
        }
      }

      // 创建备份文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `zeroislenotes_backup_${timestamp}.json`;

      // 确定备份路径
      const backupDir = Platform.OS === 'android'
        ? `${RNFS.ExternalDirectoryPath}/backups`
        : `${RNFS.DocumentDirectoryPath}/backups`;

      // 创建备份目录
      await RNFS.mkdir(backupDir);

      // 备份文件路径
      const backupPath = `${backupDir}/${fileName}`;

      // 写入备份文件
      await RNFS.writeFile(
        backupPath,
        JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          user: user ? { id: user.id, username: user.username } : null,
          data,
        }),
        'utf8'
      );

      // 更新备份信息
      const newBackup = {
        id: Date.now().toString(),
        name: fileName,
        path: backupPath,
        timestamp: new Date().toISOString(),
        size: (await RNFS.stat(backupPath)).size,
      };

      const updatedBackups = [...backups, newBackup];
      setBackups(updatedBackups);

      // 保存备份信息
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO, JSON.stringify(updatedBackups));

      // 显示成功提示
      Alert.alert('备份成功', `备份已保存到: ${backupPath}`);

      // 记录分析事件
      analyticsService.trackEvent('backup_created', {
        size: newBackup.size,
        items_count: keysToBackup.length,
      });
    } catch (error) {
      console.error('创建备份失败:', error);
      Alert.alert('错误', `创建备份失败: ${error.message}`);

      // 记录错误
      analyticsService.trackError(error, { operation: 'create_backup' });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // 恢复备份
  const restoreBackup = async (backup) => {
    Alert.alert(
      '恢复备份',
      '恢复备份将覆盖当前的所有数据。确定要继续吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '恢复',
          onPress: async () => {
            setIsRestoringBackup(true);
            try {
              // 读取备份文件
              const backupContent = await RNFS.readFile(backup.path, 'utf8');
              const backupData = JSON.parse(backupContent);

              // 验证备份版本
              if (!backupData.version || backupData.version !== 1) {
                throw new Error('不支持的备份版本');
              }

              // 恢复数据
              for (const [key, value] of Object.entries(backupData.data)) {
                await AsyncStorage.setItem(key, value);
              }

              // 清除离线操作
              await offlineStorageService.clearOfflineData();

              // 显示成功提示
              Alert.alert('恢复成功', '备份已成功恢复，应用将重新启动');

              // 记录分析事件
              analyticsService.trackEvent('backup_restored', {
                backup_id: backup.id,
                backup_timestamp: backup.timestamp,
              });

              // 重启应用（实际应用中可能需要使用特定的重启机制）
              // 这里简单地返回到主屏幕
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            } catch (error) {
              console.error('恢复备份失败:', error);
              Alert.alert('错误', `恢复备份失败: ${error.message}`);

              // 记录错误
              analyticsService.trackError(error, { operation: 'restore_backup' });
            } finally {
              setIsRestoringBackup(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // 导入备份
  const importBackup = async () => {
    try {
      // 选择文件
      const [file] = await pick({
        type: [types.allFiles],
      });

      // 验证文件类型
      if (!file.name.endsWith('.json')) {
        Alert.alert('错误', '请选择有效的备份文件 (.json)');
        return;
      }

      setIsLoading(true);

      // 读取文件内容
      const content = await RNFS.readFile(file.uri, 'utf8');

      // 验证备份格式
      try {
        const backupData = JSON.parse(content);
        if (!backupData.version || !backupData.timestamp || !backupData.data) {
          throw new Error('无效的备份文件格式');
        }
      } catch (error) {
        Alert.alert('错误', '无效的备份文件格式');
        setIsLoading(false);
        return;
      }

      // 复制文件到备份目录
      const backupDir = Platform.OS === 'android'
        ? `${RNFS.ExternalDirectoryPath}/backups`
        : `${RNFS.DocumentDirectoryPath}/backups`;

      // 创建备份目录
      await RNFS.mkdir(backupDir);

      // 生成新文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `zeroislenotes_imported_${timestamp}.json`;
      const destPath = `${backupDir}/${fileName}`;

      // 复制文件
      await RNFS.copyFile(file.uri, destPath);

      // 更新备份信息
      const newBackup = {
        id: Date.now().toString(),
        name: fileName,
        path: destPath,
        timestamp: new Date().toISOString(),
        size: (await RNFS.stat(destPath)).size,
        imported: true,
      };

      const updatedBackups = [...backups, newBackup];
      setBackups(updatedBackups);

      // 保存备份信息
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO, JSON.stringify(updatedBackups));

      // 显示成功提示
      Alert.alert('导入成功', '备份文件已成功导入');

      // 记录分析事件
      analyticsService.trackEvent('backup_imported', {
        size: newBackup.size,
        file_name: file.name,
      });
    } catch (error) {
      console.error('导入备份失败:', error);
      if (error.code === 'DOCUMENT_PICKER_CANCELED') {
        // 用户取消了选择
        console.log('用户取消了文件选择');
      } else {
        Alert.alert('错误', `导入备份失败: ${error.message}`);

        // 记录错误
        analyticsService.trackError(error, { operation: 'import_backup' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 删除备份
  const deleteBackup = async (backup) => {
    Alert.alert(
      '删除备份',
      '确定要删除此备份吗？此操作无法撤销。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          onPress: async () => {
            setIsLoading(true);
            try {
              // 删除文件
              await RNFS.unlink(backup.path);

              // 更新备份列表
              const updatedBackups = backups.filter(b => b.id !== backup.id);
              setBackups(updatedBackups);

              // 保存备份信息
              await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO, JSON.stringify(updatedBackups));

              // 记录分析事件
              analyticsService.trackEvent('backup_deleted', {
                backup_id: backup.id,
                backup_timestamp: backup.timestamp,
              });
            } catch (error) {
              console.error('删除备份失败:', error);
              Alert.alert('错误', `删除备份失败: ${error.message}`);

              // 记录错误
              analyticsService.trackError(error, { operation: 'delete_backup' });
            } finally {
              setIsLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  // 导出备份
  const exportBackup = async (backup) => {
    // 这里可以实现导出备份到其他应用的功能
    // 例如使用Share API或DocumentPicker
    Alert.alert('导出备份', '此功能尚未实现');
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // 渲染备份项
  const renderBackupItem = (backup) => (
    <View
      key={backup.id}
      style={[styles.backupItem, { backgroundColor: colors.card }]}
    >
      <View style={styles.backupInfo}>
        <View style={styles.backupHeader}>
          <Icon name="backup" size={20} color={colors.primary} />
          <Text
            variant="body"
            size="medium"
            bold
            style={styles.backupName}
          >
            {backup.imported ? '导入的备份' : '本地备份'}
          </Text>
        </View>

        <Text
          variant="caption"
          color="hint"
        >
          创建于: {formatDate(backup.timestamp)}
        </Text>

        <Text
          variant="caption"
          color="hint"
        >
          大小: {formatFileSize(backup.size)}
        </Text>
      </View>

      <View style={styles.backupActions}>
        <TouchableOpacity
          style={[styles.backupAction, { backgroundColor: colors.primary + '20' }]}
          onPress={() => restoreBackup(backup)}
          disabled={isRestoringBackup}
        >
          <Icon name="restore" size={16} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backupAction, { backgroundColor: colors.success + '20' }]}
          onPress={() => exportBackup(backup)}
        >
          <Icon name="share" size={16} color={colors.success} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.backupAction, { backgroundColor: colors.error + '20' }]}
          onPress={() => deleteBackup(backup)}
          disabled={isLoading}
        >
          <Icon name="delete" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 操作按钮 */}
        <View style={styles.actions}>
          <Button
            title="创建备份"
            onPress={createBackup}
            icon="backup"
            style={styles.actionButton}
            disabled={isCreatingBackup || isRestoringBackup}
            loading={isCreatingBackup}
          />

          <Button
            title="导入备份"
            onPress={importBackup}
            icon="file-upload"
            type="outline"
            style={styles.actionButton}
            disabled={isLoading || isCreatingBackup || isRestoringBackup}
          />
        </View>

        {/* 备份列表 */}
        <View style={styles.backupsContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            备份列表
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                color="hint"
                style={styles.loadingText}
              >
                加载备份中...
              </Text>
            </View>
          ) : backups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="cloud-off" size={48} color={colors.textSecondary} />
              <Text
                variant="body"
                size="medium"
                color="hint"
                style={styles.emptyText}
              >
                暂无备份
              </Text>
              <Text
                variant="caption"
                color="hint"
              >
                点击"创建备份"按钮创建您的第一个备份
              </Text>
            </View>
          ) : (
            backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(renderBackupItem)
          )}
        </View>

        {/* 备份说明 */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text
            variant="body"
            size="medium"
            bold
            style={styles.infoTitle}
          >
            关于备份
          </Text>

          <Text
            variant="body"
            size="small"
            color="hint"
            style={styles.infoText}
          >
            备份包含您的笔记、标签、分类和应用设置。备份不包含账户信息和云端同步数据。
          </Text>

          <Text
            variant="body"
            size="small"
            color="hint"
            style={styles.infoText}
          >
            建议定期创建备份，以防数据丢失。您可以将备份导出到其他应用或云存储服务进行额外保护。
          </Text>

          <Text
            variant="body"
            size="small"
            color="hint"
            style={styles.infoText}
          >
            恢复备份将覆盖当前的所有数据，此操作无法撤销。
          </Text>
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
  actions: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  backupsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    marginLeft: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
  },
  backupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  backupInfo: {
    flex: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  backupName: {
    marginLeft: 8,
  },
  backupActions: {
    flexDirection: 'row',
  },
  backupAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  infoTitle: {
    marginBottom: 8,
  },
  infoText: {
    marginBottom: 8,
  },
});

export default BackupRestoreScreen;
