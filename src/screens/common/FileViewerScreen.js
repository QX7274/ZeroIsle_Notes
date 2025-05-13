/**
 * 文件查看器屏幕
 * 根据文件类型选择合适的查看器组件
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PDFViewer from '../../components/viewers/PDFViewer';
import DocViewer from '../../components/viewers/DocViewer';
import RNFS from 'react-native-fs';
import { useNavigation } from '@react-navigation/native';

/**
 * 文件查看器屏幕
 * @param {Object} route - 路由对象
 * @param {string} route.params.uri - 文件路径
 * @param {string} route.params.name - 文件名称
 * @param {string} route.params.type - 文件类型
 */
const FileViewerScreen = ({ route }) => {
  // 获取主题
  const { colors } = useTheme();
  
  // 导航
  const navigation = useNavigation();
  
  // 状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  
  // 获取路由参数
  const { uri, name, type } = route.params || {};
  
  // 加载文件信息
  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError('未提供文件路径');
      return;
    }
    
    const loadFileInfo = async () => {
      try {
        setLoading(true);
        
        // 检查文件是否存在
        const fileExists = await RNFS.exists(uri);
        if (!fileExists) {
          throw new Error('文件不存在');
        }
        
        // 获取文件信息
        const stats = await RNFS.stat(uri);
        
        // 确定文件类型
        let fileType = type;
        if (!fileType) {
          // 根据文件扩展名确定类型
          const extension = uri.split('.').pop().toLowerCase();
          if (['pdf'].includes(extension)) {
            fileType = 'pdf';
          } else if (['doc', 'docx'].includes(extension)) {
            fileType = 'doc';
          } else if (['xls', 'xlsx'].includes(extension)) {
            fileType = 'excel';
          } else if (['ppt', 'pptx'].includes(extension)) {
            fileType = 'powerpoint';
          } else if (['txt', 'md'].includes(extension)) {
            fileType = 'text';
          } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
            fileType = 'image';
          } else {
            fileType = 'unknown';
          }
        }
        
        // 设置文件信息
        setFileInfo({
          uri,
          name: name || stats.name || '未命名文件',
          size: stats.size,
          type: fileType,
          lastModified: stats.mtime,
        });
        
        setLoading(false);
      } catch (err) {
        console.error('加载文件信息错误:', err);
        setError(err.message || '加载文件失败');
        setLoading(false);
      }
    };
    
    loadFileInfo();
  }, [uri, name, type]);
  
  // 渲染文件查看器
  const renderFileViewer = () => {
    if (!fileInfo) return null;
    
    switch (fileInfo.type) {
      case 'pdf':
        return <PDFViewer route={{ params: fileInfo }} />;
        
      case 'doc':
      case 'docx':
        return <DocViewer route={{ params: fileInfo }} />;
        
      case 'image':
        // 图片查看器
        return (
          <View style={styles.unsupportedContainer}>
            <Icon name="image" size={48} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={{ marginTop: 16, color: colors.text }}
            >
              图片查看器正在开发中
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text
                variant="body"
                size="medium"
                style={{ color: colors.onPrimary }}
              >
                返回
              </Text>
            </TouchableOpacity>
          </View>
        );
        
      default:
        // 不支持的文件类型
        return (
          <View style={styles.unsupportedContainer}>
            <Icon name="insert-drive-file" size={48} color={colors.error} />
            <Text
              variant="heading"
              level="h6"
              style={{ marginTop: 16, color: colors.text }}
            >
              不支持的文件类型
            </Text>
            <Text
              variant="body"
              size="medium"
              style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center' }}
            >
              当前应用无法查看此类型的文件。您可以尝试使用其他应用打开。
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text
                variant="body"
                size="medium"
                style={{ color: colors.onPrimary }}
              >
                返回
              </Text>
            </TouchableOpacity>
          </View>
        );
    }
  };
  
  // 如果正在加载，显示加载指示器
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            variant="body"
            size="medium"
            style={{ marginTop: 16, color: colors.textSecondary }}
          >
            加载中...
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // 如果有错误，显示错误信息
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            style={{ marginTop: 16, color: colors.error }}
          >
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text
              variant="body"
              size="medium"
              style={{ color: colors.onPrimary }}
            >
              返回
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  // 渲染文件查看器
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderFileViewer()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});

export default FileViewerScreen;
