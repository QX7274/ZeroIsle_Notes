import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  Share,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import RNShare from 'react-native-share';
import { exportReminders, importReminders } from '../../services/api/reminderApi';

const ReminderExportScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [format, setFormat] = useState('json');
  const [inlineHint, setInlineHint] = useState('');

  const notifyNonBlocking = (message) => {
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  };

  const parseCsvContent = (csv) => {
    if (!csv) {
      return [];
    }

    const lines = csv.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return [];
    }

    const headers = parseCsvLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i]);
      const item = {};

      headers.forEach((header, index) => {
        item[header] = values[index];
      });

      data.push(item);
    }

    return data;
  };

  // 导出提醒数据
  const handleExport = async () => {
    try {
      setLoading(true);

      // 导出提醒数据
      const response = await exportReminders({
        format,
        includeCompleted,
      });

      if (!response.success) {
        throw new Error(response.message || '导出提醒数据失败');
      }

      // 创建临时文件
      const fileExtension = format === 'json' ? 'json' : 'csv';
      const fileName = `reminders_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      const exportContent = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data, null, 2);

      // 写入文件
      await RNFS.writeFile(filePath, exportContent, 'utf8');

      // 分享文件
      if (Platform.OS === 'ios') {
        await RNShare.open({
          url: `file://${filePath}`,
          title: '导出的提醒数据',
        });
      } else {
        await Share.share({
          title: '导出的提醒数据',
          message: format === 'json' ? exportContent : `请查看附件: ${fileName}`,
          url: `file://${filePath}`,
        });
      }

      notifyNonBlocking('提醒数据导出成功');
    } catch (error) {
      console.error('导出提醒数据失败:', error);
      notifyNonBlocking('导出提醒数据失败: ' + (error?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 导入提醒数据
  const handleImport = async () => {
    try {
      setLoading(true);

      // 选择文件
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      if (!result || result.length === 0) {
        setLoading(false);
        return;
      }

      // 读取文件内容
      const fileUri = result[0].uri;
      const fileContent = await RNFS.readFile(fileUri, 'utf8');

      // 确定文件格式
      const fileFormat = fileUri.endsWith('.csv') ? 'csv' : 'json';
      const parsedData = fileFormat === 'csv'
        ? parseCsvContent(fileContent)
        : JSON.parse(fileContent);

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error('导入数据为空或格式不正确');
      }

      const importResult = await importReminders(parsedData);

      if (!importResult.success) {
        throw new Error(importResult.message || '导入提醒数据失败');
      }

      const data = importResult.data || {};
      const imported = data.imported_count ?? data.imported ?? 0;
      const failed = data.failed_count ?? data.failed ?? 0;
      const errors = data.errors ?? [];
      const total = data.total ?? imported + failed;

      // 非阻断显示导入结果
      if (errors.length > 0) {
        notifyNonBlocking(`导入完成：总计${total}，成功${imported}，失败${failed}。首个错误：${errors[0]}`);
      } else {
        notifyNonBlocking(`导入完成：总计${total}，成功${imported}，失败${failed}`);
      }
    } catch (error) {
      console.error('导入提醒数据失败:', error);
      notifyNonBlocking('导入提醒数据失败: ' + (error?.message || '未知错误'));
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

      {inlineHint ? (
        <View style={[styles.hintBanner, { backgroundColor: theme.warning + '22' }]}>
          <Text style={[styles.hintText, { color: theme.warning }]}>{inlineHint}</Text>
        </View>
      ) : null}

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
                },
              ]}
              onPress={() => setFormat('json')}
            >
              <Text
                style={[
                  styles.formatText,
                  {
                    color: format === 'json' ? '#fff' : theme.primary,
                  },
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
                },
              ]}
              onPress={() => setFormat('csv')}
            >
              <Text
                style={[
                  styles.formatText,
                  {
                    color: format === 'csv' ? '#fff' : theme.primary,
                  },
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
  hintBanner: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 13,
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
