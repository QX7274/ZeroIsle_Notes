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
import { PDFViewer as EnhancedPDFViewer, DocViewer as EnhancedDocViewer, MarkdownViewer as EnhancedMarkdownViewer, PPTViewer as EnhancedPPTViewer } from '../../screens/viewers';
import RNFS from 'react-native-fs';
import { downloadCacheService } from '../../services/files/downloadCacheService';
import { fileService } from '../../services/files';
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
  const [isHandwritingMode, setIsHandwritingMode] = useState(false);

  // 获取路由参数
  const { uri, name, type } = route.params || {};

  // 加载文件信息
  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError('未提供文件路径');
      return;
    }

    console.log('Component mount/unmount:', { component: 'FileViewerScreen', state: 'mount' });

    const loadFileInfo = async () => {
      try {
        setLoading(true);
        console.log('开始加载文件信息:', uri);

        // 处理文件路径
        let processedUri = uri;
        let isRemote = uri.startsWith('http://') || uri.startsWith('https://');

        if (isRemote) {
          console.log('[FileViewer] 检测到远程 URL，正在检查缓存:', uri);
          const cachedPath = await downloadCacheService.getCachePath(uri);
          if (cachedPath) {
            console.log('[FileViewer] 命中缓存:', cachedPath);
            processedUri = cachedPath;
            isRemote = false; // 已转换为本地路径
          } else {
            console.log('[FileViewer] 未命中缓存，准备下载...');
            setLoading(true);
            // 这里可以添加进度监听
            const destPath = `${RNFS.CachesDirectoryPath}/temp_${Date.now()}_${name || 'file'}`;
            const success = await fileService.downloadFileFromURL(uri, destPath, (progress) => {
              console.log(`[FileViewer] 下载进度: ${Math.round(progress * 100)}%`);
            });

            if (success) {
              processedUri = await downloadCacheService.saveToCache(uri, destPath, {
                name,
                extension: uri.split('.').pop().toLowerCase(),
                size: (await RNFS.stat(destPath)).size,
              });
              isRemote = false;
              // 清理临时文件
              await RNFS.unlink(destPath).catch(() => {});
            } else {
              throw new Error('下载文件失败');
            }
          }
        }

        if (processedUri.startsWith('file://')) {
          processedUri = processedUri.replace('file://', '');
        } else if (processedUri.startsWith('content://')) {
          // 对于content:// URI，尝试复制到缓存目录
          try {
            const fileName = `file_${Date.now()}.${uri.split('.').pop() || 'tmp'}`;
            const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.copyFile(uri, destPath);
            processedUri = destPath;
            console.log('已将content URI文件复制到:', destPath);
          } catch (copyError) {
            console.error('复制content URI文件失败:', copyError);
            // 如果复制失败，直接使用原始URI
            processedUri = uri;
          }
        }
        console.log('处理后的文件路径:', processedUri);

        // 检查文件是否存在
        let fileExists;
        if (processedUri.startsWith('content://')) {
          // 对于content:// URI，无法直接检查存在性，假设存在
          fileExists = true;
        } else {
          fileExists = await RNFS.exists(processedUri);
        }
        console.log('文件是否存在:', fileExists);
        if (!fileExists) {
          throw new Error('文件不存在');
        }

        // 获取文件信息
        let stats;
        if (processedUri.startsWith('content://')) {
          // 对于content:// URI，无法直接获取文件信息，使用默认值
          stats = {
            size: 0,
            name: name || '未命名文件',
            mtime: new Date(),
          };
        } else {
          stats = await RNFS.stat(processedUri);
        }
        console.log('文件信息:', stats);

        // 确定文件类型
        let fileType = type;
        if (!fileType) {
          // 根据文件扩展名确定类型
          const extension = uri.includes('.') ? uri.split('.').pop().toLowerCase() : '';
          if (extension === 'pdf') {
            fileType = 'pdf';
          } else if (extension === 'docx') {
            fileType = 'docx';
          } else if (extension === 'doc') {
            fileType = 'doc';
          } else if (extension === 'ppt' || extension === 'pptx') {
            fileType = 'powerpoint';
          } else if (extension === 'md' || extension === 'markdown' || extension === 'txt') {
            fileType = (extension === 'md' || extension === 'markdown') ? 'markdown' : 'text';
          } else {
            // 无扩展名时，根据上游传入的 type 再次兜底
            fileType = type || 'unknown';
          }
        }

        console.log('File type detection:', { fileName: name, fileType, fileUri: uri, detectedType: fileType, routingDecision: 'renderViewer' });

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

    return () => {
      console.log('Component mount/unmount:', { component: 'FileViewerScreen', state: 'unmount' });
    };
  }, [uri, name, type]);

  // 切换手写模式
  const toggleHandwritingMode = () => {
    setIsHandwritingMode(!isHandwritingMode);
  };

  // 渲染文件查看器
  const renderFileViewer = () => {
    if (!fileInfo) {return null;}

    switch (fileInfo.type) {
      case 'pdf':
        console.log('Navigation params:', { screen: 'PDFViewer(inner)', params: { uri: fileInfo.uri, title: fileInfo.name, noteId: route.params.noteId } });

        // 检查文件大小
        if (fileInfo.size === 0) {
          return (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={48} color={colors.error} />
              <Text
                variant="body"
                size="medium"
                style={{ marginTop: 16, color: colors.error }}
              >
                PDF文件大小为0，可能已损坏
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

        // 检查是否需要在线转换
        if (fileInfo.requires_online_conversion && fileInfo.conversion_status === 'pending') {
          return (
            <View style={styles.errorContainer}>
              <Icon name="cloud-off" size={48} color={colors.warning} />
              <Text
                variant="body"
                size="medium"
                style={{ marginTop: 16, color: colors.warning, textAlign: 'center' }}
              >
                此文档需要网络连接才能转换为PDF格式
              </Text>
              <Text
                variant="body"
                size="small"
                style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center' }}
              >
                请连接网络后重新打开此文档
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 16 }]}
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

        return (
          <View style={styles.pdfContainer}>
            <EnhancedPDFViewer
              route={{
                params: {
                  uri: fileInfo.uri,
                  title: fileInfo.name,
                  noteId: route.params.noteId,
                  isHandwritingMode,
                },
              }}
            />
          </View>
        );

      case 'doc':
      case 'docx':
        return <EnhancedDocViewer route={{ params: {
          uri: fileInfo.uri,
          title: fileInfo.name,
          noteId: route.params.noteId,
          type: fileInfo.type,
          isHandwritingMode,
        }}} />;

      case 'markdown':
      case 'text':
        return <EnhancedMarkdownViewer route={{ params: {
          uri: fileInfo.uri,
          title: fileInfo.name,
          noteId: route.params.noteId,
        }}} />;

      case 'powerpoint':
        return <EnhancedPPTViewer route={{ params: {
          uri: fileInfo.uri,
          title: fileInfo.name,
          noteId: route.params.noteId,
        }}} />;


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
      <View style={styles.contentContainer}>
        {renderFileViewer()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
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
  pdfContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
});

export default FileViewerScreen;
