import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Share,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ReminderExportScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [format, setFormat] = useState('json');

  // 导出提醒数据
  const handleExport = async () => {
    try {
      setLoading(true);

      // 导出提醒数据
      const data = await reminderNotificationService.exportReminders({
        format,
        includeCompleted,
      });

      // 创建临时文件
      const fileExtension = format === 'json' ? 'json' : 'csv';
      const fileName = `reminders_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      // 写入文件
      await FileSystem.writeAsStringAsync(filePath, data);

      // 分享文件
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(filePath);
      } else {
        await Share.share({
          title: '导出的提醒数据',
          message: format === 'json' ? data : `请查看附件: ${fileName}`,
          url: `file://${filePath}`,
        });
      }

      Alert.alert('成功', '提醒数据导出成功');
    } catch (error) {
      console.error('导出提醒数据失败:', error);
      Alert.alert('错误', '导出提醒数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 导入提醒数据
  const handleImport = async () => {
    try {
      setLoading(true);

      // 选择文件
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/csv', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLoading(false);
        return;
      }

      // 读取文件内容
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      // 确定文件格式
      const fileFormat = fileUri.endsWith('.csv') ? 'csv' : 'json';

      // 导入提醒数据
      const importResult = await reminderNotificationService.importReminders(fileContent, fileFormat);

      // 显示导入结果
      Alert.alert(
        '导入结果',
        `总计: ${importResult.total}\n导入成功: ${importResult.imported}\n导入失败: ${importResult.failed}`,
        [
          { text: '确定' },
          {
            text: '查看详情',
            onPress: () => {
              if (importResult.errors.length > 0) {
                Alert.alert('导入错误', importResult.errors.join('\n\n'));
              } else {
                Alert.alert('导入成功', '所有提醒都已成功导入');
              }
            },
            style: 'default',
          },
        ]
      );
    } catch (error) {
      console.error('导入提醒数据失败:', error);
      Alert.alert('错误', '导入提醒数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 渲染主界面
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>处理中...</Text>
        </View>
      )}

      <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>导出选项</Text>

        <View style={styles.optionRow}>
          <Text style={[styles.optionLabel, { color: theme.text }]}>包含已完成的提醒</Text>
          <Switch
            value={includeCompleted}
            onValueChange={setIncludeCompleted}
            trackColor={{ false: theme.border, true: theme.primary + '80' }}
            thumbColor={includeCompleted ? theme.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.formatContainer}>
          <Text style={[styles.formatLabel, { color: theme.text }]}>导出格式:</Text>
          <View style={styles.formatOptions}>
            <TouchableOpacity
              style={[
                styles.formatOption,
                {
                  backgroundColor: format === 'json' ? theme.primary : theme.background,
                  borderColor: theme.primary,
                }
              ]}
              onPress={() => setFormat('json')}
            >
              <Text
                style={[
                  styles.formatText,
                  {
                    color: format === 'json' ? '#fff' : theme.primary,
                  }
                ]}
              >
                JSON
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatOption,
                {
                  backgroundColor: format === 'csv' ? theme.primary : theme.background,
                  borderColor: theme.primary,
                }
              ]}
              onPress={() => setFormat('csv')}
            >
              <Text
                style={[
                  styles.formatText,
                  {
                    color: format === 'csv' ? '#fff' : theme.primary,
                  }
                ]}
              >
                CSV
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleExport}
          disabled={loading}
        >
          <Icon name="cloud-download" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>导出提醒数据</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>导入提醒</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          从JSON或CSV文件导入提醒数据。导入的提醒将添加到您现有的提醒中。
        </Text>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={handleImport}
          disabled={loading}
        >
          <Icon name="cloud-upload" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>导入提醒数据</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>备份和恢复</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          导出的JSON文件包含所有提醒数据，可用于备份和恢复。建议定期导出备份您的提醒数据。
        </Text>

        <View style={styles.infoBox}>
          <Icon name="info" size={20} color={theme.info} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            CSV格式适合与电子表格软件（如Excel）一起使用，而JSON格式保留了所有数据细节，适合备份和恢复。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  section: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 16,
  },
  formatContainer: {
    marginBottom: 16,
  },
  formatLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  formatOptions: {
    flexDirection: 'row',
  },
  formatOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  formatText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ReminderExportScreen;
