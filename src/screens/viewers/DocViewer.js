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
  Share,
  Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import DocumentOpener from 'react-native-document-opener';

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

      // 检查文件类型
      const isWordDoc = uri.toLowerCase().endsWith('.docx') || uri.toLowerCase().endsWith('.doc') ||
                        (title && (title.toLowerCase().endsWith('.docx') || title.toLowerCase().endsWith('.doc')));

      // 对于Word文档，我们创建一个简单的HTML页面，并提供打开外部应用的选项
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
            .button {
              background-color: ${colors.primary};
              color: white;
              border: none;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              display: inline-block;
              font-size: 16px;
              margin: 10px 5px;
              cursor: pointer;
              border-radius: 4px;
            }
            .button-container {
              text-align: center;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title || '文档查看器'}</h1>
            <div class="icon">${isWordDoc ? '📄' : '📝'}</div>
            <div class="message">
              ${isWordDoc ?
                '<p>Word文档无法直接在应用内查看。</p>' :
                '<p>文档内容预览</p>'
              }
              <p>您可以使用以下选项操作此文档：</p>
            </div>
            <div class="button-container">
              <button class="button" onclick="window.ReactNativeWebView.postMessage('open_external')">
                使用外部应用打开
              </button>
              <button class="button" onclick="window.ReactNativeWebView.postMessage('export')">
                导出文档
              </button>
            </div>
            <div class="file-info">
              <p><strong>文件名:</strong> ${title || '未命名文档'}</p>
              <p><strong>文件类型:</strong> ${isWordDoc ? 'Word文档' : '文本文档'}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      setHtmlContent(html);

      // 如果不是Word文档，尝试读取文本内容并添加到页面
      if (!isWordDoc) {
        try {
          // 尝试读取文件内容，但使用base64编码避免UTF-8解析错误
          const base64Content = await RNFS.readFile(uri, 'base64');

          // 使用try-catch包装解码过程，以防止UTF-8解码错误
          let content;
          try {
            content = Buffer.from(base64Content, 'base64').toString('utf8');
          } catch (decodeError) {
            console.error('UTF-8解码失败，尝试使用其他编码:', decodeError);
            // 尝试使用ASCII编码
            content = Buffer.from(base64Content, 'base64').toString('ascii');
          }

          // 创建包含文本内容的HTML
          const htmlWithContent = `
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
                .content {
                  font-family: monospace;
                  white-space: pre-wrap;
                  background-color: rgba(0,0,0,0.05);
                  padding: 15px;
                  border-radius: 4px;
                  overflow-x: auto;
                }
                .button {
                  background-color: ${colors.primary};
                  color: white;
                  border: none;
                  padding: 10px 20px;
                  text-align: center;
                  text-decoration: none;
                  display: inline-block;
                  font-size: 16px;
                  margin: 10px 5px;
                  cursor: pointer;
                  border-radius: 4px;
                }
                .button-container {
                  text-align: center;
                  margin: 20px 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${title || '文本文档'}</h1>
                <div class="button-container">
                  <button class="button" onclick="window.ReactNativeWebView.postMessage('open_external')">
                    使用外部应用打开
                  </button>
                  <button class="button" onclick="window.ReactNativeWebView.postMessage('export')">
                    导出文档
                  </button>
                </div>
                <div class="content">
                  ${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
              </div>
            </body>
            </html>
          `;

          setHtmlContent(htmlWithContent);
        } catch (readError) {
          console.error('读取文件内容失败:', readError);
          // 如果读取失败，继续使用默认HTML，不抛出错误
          console.log('使用默认HTML显示文档信息');
        }
      } else {
        // 对于Word文档，直接尝试使用外部应用打开
        console.log('检测到Word文档，准备使用外部应用打开');
        // 延迟一秒后自动触发外部应用打开
        setTimeout(() => {
          handleOpenExternal();
        }, 1000);
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

      // 等待WebView加载完成，增加等待时间
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 使用try-catch包装ViewShot捕获过程
      let uri;
      try {
        // 使用ViewShot捕获WebView内容
        uri = await viewShotRef.current.capture();
        console.log('预览图片已生成:', uri);
      } catch (captureError) {
        console.error('ViewShot捕获失败，使用默认预览图:', captureError);

        // 使用默认预览图
        const isWordDoc = route.params.uri.toLowerCase().endsWith('.docx') ||
                          route.params.uri.toLowerCase().endsWith('.doc');

        // 根据文档类型选择默认预览图
        if (isWordDoc) {
          uri = 'https://img-blog.csdnimg.cn/20200627111426602.png';
        } else {
          uri = 'https://img-blog.csdnimg.cn/20200627111426602.png';
        }
      }

      // 如果uri是网络图片，直接使用URL而不尝试保存到本地
      if (uri.startsWith('http')) {
        setPreviewPath(uri);
        setPreviewGenerated(true);

        // 如果有笔记ID，更新笔记的预览图片
        if (noteId) {
          try {
            // 获取笔记
            const notes = await offlineStorageService.getNotes();
            const noteIndex = notes.findIndex(note => note.id === noteId);

            if (noteIndex >= 0) {
              // 更新笔记的预览图片
              notes[noteIndex].preview_image = uri;

              // 保存更新后的笔记
              await offlineStorageService.saveNote(notes[noteIndex]);
              console.log('笔记预览图片已更新(使用网络图片)');
            }
          } catch (error) {
            console.error('更新笔记预览图片失败:', error);
          }
        }

        return uri;
      }

      // 保存预览图片到缓存目录
      try {
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
      } catch (saveError) {
        console.error('保存预览图片失败:', saveError);

        // 如果保存失败但有URI，直接使用URI
        if (uri) {
          setPreviewPath(uri);
          setPreviewGenerated(true);
          return uri;
        }
      }

      return null;
    } catch (error) {
      console.error('生成预览图片失败:', error);

      // 使用默认预览图
      const defaultPreview = 'https://img-blog.csdnimg.cn/20200627111426602.png';

      // 如果有笔记ID，更新笔记的预览图片
      if (noteId) {
        try {
          // 获取笔记
          const notes = await offlineStorageService.getNotes();
          const noteIndex = notes.findIndex(note => note.id === noteId);

          if (noteIndex >= 0) {
            // 更新笔记的预览图片
            notes[noteIndex].preview_image = defaultPreview;

            // 保存更新后的笔记
            await offlineStorageService.saveNote(notes[noteIndex]);
            console.log('笔记预览图片已更新(使用默认图片)');
          }
        } catch (updateError) {
          console.error('更新笔记预览图片失败:', updateError);
        }
      }

      return defaultPreview;
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
      } else if (title) {
        // 从标题中提取扩展名
        const titleParts = title.split('.');
        if (titleParts.length > 1) {
          fileExt = titleParts[titleParts.length - 1].toLowerCase();
        }
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

  // 使用外部应用打开文档
  const handleOpenExternal = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可打开的文件');
      }

      const filePath = localFilePath || uri;

      // 对于Android，需要确保文件路径以file://开头
      const fileUri = Platform.OS === 'android' && !filePath.startsWith('file://')
        ? `file://${filePath}`
        : filePath;

      console.log('尝试使用外部应用打开文件:', fileUri);

      // 检查文件是否存在
      try {
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          throw new Error(`文件不存在: ${filePath}`);
        }
        console.log('文件存在，继续打开');
      } catch (existsError) {
        console.error('检查文件是否存在失败:', existsError);
        // 继续尝试打开，可能是权限问题
      }

      // 对于Word文档，先尝试复制到临时目录
      const isWordDoc = fileUri.toLowerCase().endsWith('.docx') || fileUri.toLowerCase().endsWith('.doc');
      if (isWordDoc) {
        try {
          const tempDir = `${RNFS.CachesDirectoryPath}/temp_docs`;

          // 确保临时目录存在
          const dirExists = await RNFS.exists(tempDir);
          if (!dirExists) {
            await RNFS.mkdir(tempDir);
          }

          // 生成临时文件路径
          const fileName = title || `document_${Date.now()}`;
          const fileExt = fileUri.toLowerCase().endsWith('.docx') ? 'docx' : 'doc';
          const tempFilePath = `${tempDir}/${fileName}.${fileExt}`;

          // 复制文件到临时目录
          await RNFS.copyFile(filePath, tempFilePath);
          console.log('文件已复制到临时目录:', tempFilePath);

          // 使用临时文件路径
          const tempFileUri = Platform.OS === 'android' ? `file://${tempFilePath}` : tempFilePath;

          // 尝试使用DocumentOpener打开临时文件
          try {
            await DocumentOpener.openAsync(tempFileUri);
            console.log('文件已使用DocumentOpener打开');
            return;
          } catch (tempDocOpenerError) {
            console.warn('使用临时文件的DocumentOpener打开失败:', tempDocOpenerError);
            // 继续尝试其他方法
          }
        } catch (tempFileError) {
          console.error('创建临时文件失败:', tempFileError);
          // 继续尝试直接打开原始文件
        }
      }

      // 尝试使用DocumentOpener打开文件
      try {
        await DocumentOpener.openAsync(fileUri);
        console.log('文件已使用DocumentOpener打开');
        return;
      } catch (docOpenerError) {
        console.warn('DocumentOpener打开失败，尝试使用Linking:', docOpenerError);
      }

      // 如果DocumentOpener失败，尝试使用Linking
      if (await Linking.canOpenURL(fileUri)) {
        await Linking.openURL(fileUri);
        console.log('文件已使用Linking打开');
      } else {
        throw new Error('没有找到可以打开此类型文件的应用');
      }
    } catch (error) {
      console.error('使用外部应用打开文档失败:', error);
      Alert.alert('错误', error.message || '无法打开文档');
    }
  };

  // 处理WebView消息
  const handleWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    console.log('收到WebView消息:', message);

    switch (message) {
      case 'open_external':
        handleOpenExternal();
        break;
      case 'export':
        handleExport();
        break;
      default:
        console.log('未知的WebView消息:', message);
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
            onMessage={handleWebViewMessage}
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
