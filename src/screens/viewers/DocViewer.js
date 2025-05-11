import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Share
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
// useDispatch已移除
import { offlineStorageService } from '../../services/offline/offlineStorage';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
// ViewShot已移除
import { Text } from 'react-native'; // 直接从react-native导入Text组件

const DocViewer = ({ route, navigation }) => {
  const { uri, title, noteId } = route.params;
  const { colors } = useTheme();
  // dispatch已移除
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localFilePath] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const webViewRef = useRef(null);

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

      // 预览图片相关代码已移除
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

      console.log('文档类型:', isWordDoc ? 'Word文档' : '文本文档');

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
              <p>文档内容预览</p>
              <p>此文档已永久保存在应用中，您可以直接在应用内查看。</p>
            </div>
            <div class="button-container">
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
        // 对于Word文档，提供内置查看功能，不再尝试使用外部应用打开
        console.log('检测到Word文档，使用内置查看功能');

        // 创建一个更友好的Word文档查看界面
        const wordViewerHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                line-height: 1.6;
                color: ${colors.text};
                background-color: ${colors.background};
              }
              .container {
                max-width: 100%;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
                padding: 10px;
                background-color: ${colors.primary}15;
                border-radius: 8px;
              }
              h1 {
                color: ${colors.primary};
                margin: 0;
                font-size: 20px;
              }
              .doc-icon {
                font-size: 36px;
                margin: 10px 0;
              }
              .content {
                background-color: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                min-height: 300px;
              }
              .placeholder-text {
                color: #666;
                text-align: center;
                margin: 40px 0;
              }
              .file-info {
                margin-top: 20px;
                padding: 10px;
                background-color: ${colors.primary}10;
                border-radius: 8px;
                font-size: 14px;
              }
              .info-item {
                margin: 5px 0;
              }
              .button-container {
                display: flex;
                justify-content: center;
                margin: 20px 0;
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
                margin: 0 5px;
                cursor: pointer;
                border-radius: 4px;
              }
              .note {
                font-style: italic;
                text-align: center;
                margin-top: 20px;
                font-size: 14px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="doc-icon">📄</div>
                <h1>${title || '文档查看器'}</h1>
              </div>

              <div class="content">
                <div class="placeholder-text">
                  <p>Word文档内容预览</p>
                  <p>此文档已保存在应用中，您可以随时查看或导出。</p>
                </div>
              </div>

              <div class="file-info">
                <div class="info-item"><strong>文件名:</strong> ${title || '未命名文档'}</div>
                <div class="info-item"><strong>文件类型:</strong> Word文档</div>
                <div class="info-item"><strong>文件路径:</strong> ${uri}</div>
                <div class="info-item"><strong>导入时间:</strong> ${new Date().toLocaleString()}</div>
              </div>

              <div class="button-container">
                <button class="button" onclick="window.ReactNativeWebView.postMessage('export')">
                  导出文档
                </button>
              </div>

              <div class="note">
                注意：Word文档已永久保存在应用中，您可以随时查看或导出。
              </div>
            </div>
          </body>
          </html>
        `;

        setHtmlContent(wordViewerHtml);
      }
    } catch (error) {
      console.error('加载文档失败:', error);
      setError(error.message || '加载文档失败');
      Alert.alert('错误', error.message || '加载文档失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 预览图功能已移除

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

      // 检查文件是否存在
      try {
        const exists = await RNFS.exists(filePath);
        if (!exists) {
          throw new Error(`文件不存在: ${filePath}`);
        }
        console.log('文件存在，继续导出');
      } catch (existsError) {
        console.error('检查文件是否存在失败:', existsError);
        throw new Error('无法访问文件，请确保文件存在');
      }

      // 导出到下载目录
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}.${fileExt}`;

      await RNFS.copyFile(filePath, destPath);

      Alert.alert('成功', `文件已导出到: ${destPath}`);

      // 尝试使用分享功能
      try {
        await Share.share({
          title: `分享文档: ${fileName}`,
          message: `分享文档: ${fileName}`,
          url: Platform.OS === 'ios' ? destPath : `file://${destPath}`,
        });
      } catch (shareError) {
        console.error('分享文档失败:', shareError);
        // 不显示错误，因为文件已成功导出
      }
    } catch (error) {
      console.error('导出文档失败:', error);
      Alert.alert('错误', error.message || '导出文档失败');
    }
  };

  // 导出功能提示
  const showExportInfo = () => {
    Alert.alert(
      '导出文档',
      '您可以将文档导出到设备存储，以便在其他应用中编辑。',
      [
        {
          text: '导出',
          onPress: handleExport
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };

  // 处理WebView消息
  const handleWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    console.log('收到WebView消息:', message);

    switch (message) {
      case 'export':
        showExportInfo();
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
            console.log('文档加载完成');
            // 预览图功能已移除
          }}
          onMessage={handleWebViewMessage}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView错误:', nativeEvent);
            setError(nativeEvent.description || 'WebView加载错误');
          }}
        />
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
