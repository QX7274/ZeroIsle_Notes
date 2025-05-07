import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Text,
  Platform,
  Share
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';

const DocViewer = ({ route, navigation }) => {
  const { uri, title, noteId } = route.params;
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const [previewGenerated, setPreviewGenerated] = useState(false);
  const [previewPath, setPreviewPath] = useState(null);
  const webViewRef = useRef(null);
  const viewShotRef = useRef(null);

  useEffect(() => {
    // 设置导航标题
    navigation.setOptions({
      title: title || '查看文档',
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

    // 加载文档
    loadDocument();

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

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 检查URI格式
      if (!uri) {
        throw new Error('无效的文档URI');
      }

      console.log('加载文档:', uri);

      // 由于React Native没有内置的Word查看器，我们使用一个简单的方法：
      // 1. 将文档内容显示为文本（如果是纯文本文档）
      // 2. 或者使用WebView加载一个简单的HTML页面，显示"无法直接查看Word文档"的消息

      // 检查文件类型
      const isWordDoc = uri.toLowerCase().endsWith('.docx') || uri.toLowerCase().endsWith('.doc');

      if (isWordDoc) {
        // 对于Word文档，我们创建一个简单的HTML页面
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 20px;
                line-height: 1.6;
                color: ${colors.text};
                background-color: ${colors.background};
              }
              .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: ${colors.card};
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 {
                color: ${colors.primary};
              }
              .icon {
                font-size: 48px;
                color: ${colors.primary};
                text-align: center;
                margin: 20px 0;
              }
              .message {
                text-align: center;
                margin-bottom: 20px;
              }
              .file-info {
                background-color: rgba(0,0,0,0.05);
                padding: 10px;
                border-radius: 4px;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${title || '文档查看器'}</h1>
              <div class="icon">📄</div>
              <div class="message">
                <p>Word文档无法直接在应用内查看。</p>
                <p>您可以使用外部应用打开此文档，或将其导出到其他格式。</p>
              </div>
              <div class="file-info">
                <p><strong>文件名:</strong> ${title || '未命名文档'}</p>
                <p><strong>文件路径:</strong> ${uri}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        setHtmlContent(html);
      } else {
        // 对于其他类型的文档，尝试读取文本内容
        try {
          const content = await RNFS.readFile(uri, 'utf8');
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: monospace;
                  margin: 20px;
                  line-height: 1.6;
                  color: ${colors.text};
                  background-color: ${colors.background};
                  white-space: pre-wrap;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: ${colors.card};
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                h1 {
                  color: ${colors.primary};
                  font-family: Arial, sans-serif;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${title || '文本文档'}</h1>
                ${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </div>
            </body>
            </html>
          `;

          setHtmlContent(html);
        } catch (readError) {
          console.error('读取文件内容失败:', readError);
          throw new Error('无法读取文件内容');
        }
      }
    } catch (error) {
      console.error('加载文档失败:', error);
      setError(error.message || '加载文档失败');
      Alert.alert('错误', error.message || '加载文档失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成文档预览图片
  const generatePreview = async () => {
    try {
      if (!webViewRef.current || !viewShotRef.current || previewGenerated) {
        return;
      }

      console.log('开始生成文档预览图片');

      // 等待WebView加载完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 使用ViewShot捕获WebView内容
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

  // 分享文档
  const handleShare = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可分享的文件');
      }

      const filePath = localFilePath || uri;

      // 使用React Native的Share API分享文件
      await Share.share({
        title: title || '分享文档',
        message: '分享文档',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
      });
    } catch (error) {
      console.error('分享文档失败:', error);
      Alert.alert('错误', error.message || '分享文档失败');
    }
  };

  // 导出文档
  const handleExport = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可导出的文件');
      }

      const filePath = localFilePath || uri;
      const fileName = title || '导出的文档';

      // 确定文件扩展名
      let fileExt = 'txt';
      if (uri.toLowerCase().endsWith('.docx')) {
        fileExt = 'docx';
      } else if (uri.toLowerCase().endsWith('.doc')) {
        fileExt = 'doc';
      }

      // 导出到下载目录
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}.${fileExt}`;

      await RNFS.copyFile(filePath, destPath);

      Alert.alert('成功', `文件已导出到: ${destPath}`);
    } catch (error) {
      console.error('导出文档失败:', error);
      Alert.alert('错误', error.message || '导出文档失败');
    }
  };

  // 重命名文档
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
      console.error('重命名文档失败:', error);
      Alert.alert('错误', error.message || '重命名文档失败');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>加载文档中...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadDocument}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {htmlContent && !error && (
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.8 }}>
          <WebView
            ref={webViewRef}
            source={{ html: htmlContent }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            onLoad={() => {
              // 生成预览图片
              if (noteId && !previewGenerated) {
                setTimeout(() => {
                  generatePreview();
                }, 1500);
              }
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView错误:', nativeEvent);
              setError(nativeEvent.description || 'WebView加载错误');
            }}
          />
        </ViewShot>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
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
});

export default DocViewer;
