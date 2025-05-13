import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Text,
  Platform,
  Share
} from 'react-native';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import RNFS from 'react-native-fs';
import ViewShot from 'react-native-view-shot';

const PDFViewer = ({ route, navigation }) => {
  const { uri, title, noteId } = route.params;
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfSource, setPdfSource] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(null);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [previewPath, setPreviewPath] = useState(null);
  const pdfRef = useRef(null);
  const viewShotRef = useRef(null);

  useEffect(() => {
    // 设置导航标题
    navigation.setOptions({
      title: title || '查看PDF',
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShare}
          >
            <Icon name="share-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleExport}
          >
            <Icon name="download-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleRename}
          >
            <Icon name="create-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      ),
    });

    // 加载PDF文件
    loadPDF();

    return () => {
      // 清理临时文件
      if (localFilePath && localFilePath.startsWith(RNFS.CachesDirectoryPath)) {
        RNFS.unlink(localFilePath).catch(err => console.error('清理临时文件失败:', err));
      }

      // 清理预览图片临时文件
      if (previewPath && previewPath.startsWith(RNFS.CachesDirectoryPath)) {
        RNFS.unlink(previewPath).catch(err => console.error('清理预览图片临时文件失败:', err));
      }
    };
  }, []);

  const loadPDF = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 检查URI格式
      if (!uri) {
        throw new Error('无效的PDF文件URI');
      }

      console.log('加载PDF文件:', uri);

      // 处理不同类型的URI
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        // 网络URI，直接使用
        setPdfSource({ uri, cache: true });
      } else if (uri.startsWith('content://') || uri.startsWith('file://')) {
        // 内容URI或文件URI，需要复制到应用缓存目录
        const fileName = `pdf_${Date.now()}.pdf`;
        const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        // 复制文件
        await RNFS.copyFile(uri, destPath);
        setLocalFilePath(destPath);
        setPdfSource({ uri: `file://${destPath}`, cache: true });

        // 生成并保存首页预览图
        if (noteId) {
          // 这里可以添加生成预览图的逻辑
          // 例如使用react-native-view-shot捕获PDF首页
        }
      } else {
        // 尝试作为本地路径处理
        setPdfSource({ uri: `file://${uri}`, cache: true });
      }
    } catch (error) {
      console.error('加载PDF失败:', error);
      setError(error.message || '加载PDF失败');
      Alert.alert('错误', error.message || '加载PDF失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成PDF首页预览图
  const generatePreview = async () => {
    try {
      if (!pdfRef.current || !viewShotRef.current || previewGenerated) {
        return;
      }

      console.log('开始生成PDF首页预览图');

      // 等待PDF加载完成并渲染第一页
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 使用ViewShot捕获PDF首页
      const uri = await viewShotRef.current.capture();
      console.log('预览图片已生成:', uri);

      // 保存预览图片到缓存目录
      const fileName = `preview_${Date.now()}.jpg`;
      const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.copyFile(uri, destPath);
      setPreviewPath(destPath);
      setPreviewGenerated(true);

      // 如果有笔记ID，更新笔记的预览图片
      if (noteId) {
        try {
          // 获取笔记
          const notes = await offlineStorageService.getNotes();
          const noteIndex = notes.findIndex(note => note.id === noteId);

          if (noteIndex >= 0) {
            // 更新笔记的预览图片
            notes[noteIndex].preview_image = `file://${destPath}`;

            // 保存更新后的笔记
            await offlineStorageService.saveNote(notes[noteIndex]);
            console.log('笔记预览图片已更新');
          }
        } catch (error) {
          console.error('更新笔记预览图片失败:', error);
        }
      }

      return destPath;
    } catch (error) {
      console.error('生成预览图片失败:', error);
      return null;
    }
  };

  // 分享PDF文件
  const handleShare = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可分享的文件');
      }

      const filePath = localFilePath || uri;

      // 使用React Native的Share API分享文件
      await Share.share({
        title: title || '分享PDF文件',
        message: '分享PDF文件',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
      });
    } catch (error) {
      console.error('分享PDF失败:', error);
      Alert.alert('错误', error.message || '分享PDF失败');
    }
  };

  // 导出PDF文件
  const handleExport = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可导出的文件');
      }

      const filePath = localFilePath || uri;
      const fileName = title || '导出的PDF文件';

      // 导出到下载目录
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;

      await RNFS.copyFile(filePath, destPath);

      Alert.alert('成功', `文件已导出到: ${destPath}`);
    } catch (error) {
      console.error('导出PDF失败:', error);
      Alert.alert('错误', error.message || '导出PDF失败');
    }
  };

  // 重命名PDF文件
  const handleRename = async () => {
    try {
      // 显示重命名对话框
      Alert.prompt(
        '重命名文件',
        '请输入新的文件名',
        [
          {
            text: '取消',
            style: 'cancel'
          },
          {
            text: '确定',
            onPress: async (newName) => {
              if (!newName || newName.trim() === '') {
                Alert.alert('错误', '文件名不能为空');
                return;
              }

              if (!noteId) {
                Alert.alert('错误', '无法重命名文件，笔记ID不存在');
                return;
              }

              try {
                // 获取笔记
                const notes = await offlineStorageService.getNotes();
                const noteIndex = notes.findIndex(note => note.id === noteId);

                if (noteIndex >= 0) {
                  // 更新笔记的标题和文件名
                  notes[noteIndex].title = newName;

                  if (notes[noteIndex].file_name) {
                    const fileExt = notes[noteIndex].file_name.split('.').pop();
                    notes[noteIndex].file_name = `${newName}.${fileExt}`;
                  }

                  // 保存更新后的笔记
                  await offlineStorageService.saveNote(notes[noteIndex]);

                  // 更新导航标题
                  navigation.setOptions({ title: newName });

                  Alert.alert('成功', '文件已重命名');
                } else {
                  throw new Error('找不到笔记');
                }
              } catch (error) {
                console.error('重命名文件失败:', error);
                Alert.alert('错误', error.message || '重命名文件失败');
              }
            }
          }
        ],
        'plain-text',
        title || ''
      );
    } catch (error) {
      console.error('重命名PDF失败:', error);
      Alert.alert('错误', error.message || '重命名PDF失败');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>加载PDF中...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadPDF}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {pdfSource && !error && (
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.8 }}>
          <Pdf
            ref={pdfRef}
            source={pdfSource}
            onLoadComplete={(numberOfPages, filePath) => {
              console.log(`PDF加载完成: ${numberOfPages}页`);
              setTotalPages(numberOfPages);
              setIsLoading(false);

              // 生成预览图片
              if (noteId && !previewGenerated) {
                setTimeout(() => {
                  generatePreview();
                }, 1500);
              }
            }}
            onPageChanged={(page) => {
              console.log(`当前页: ${page}`);
              setCurrentPage(page);
            }}
            onError={(error) => {
              console.error('PDF加载错误:', error);
              setError(error.message || 'PDF加载错误');
              setIsLoading(false);
            }}
            onPressLink={(uri) => {
              console.log(`链接点击: ${uri}`);
            }}
            style={styles.pdf}
            enablePaging={false}
            horizontal={false}
            enableRTL={false}
            trustAllCerts={false}
            page={1} // 始终显示第一页，用于生成预览图片
            renderActivityIndicator={() => <ActivityIndicator color={colors.primary} />}
          />
        </ViewShot>
      )}

      {pdfSource && !error && (
        <View style={[styles.pageIndicator, { backgroundColor: colors.card }]}>
          <Text style={[styles.pageText, { color: colors.text }]}>
            {currentPage} / {totalPages}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    marginHorizontal: 8,
    padding: 4,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    opacity: 0.8,
  },
  pageText: {
    fontSize: 14,
  },
});

export default PDFViewer;
