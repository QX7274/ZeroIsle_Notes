import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
  ScrollView,
  Dimensions,
  Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { DocViewer as RNDocViewer } from 'react-native-doc-viewer';
import { offlineStorageService } from '../../services/offline';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';
import { Text } from 'react-native';
import HandwritingCanvas from '../../components/handwriting/HandwritingCanvas';
import { AllInOneToolbar } from '../../components/common';

const DocViewer = ({ route, navigation }) => {
  const { uri, title, noteId } = route.params;
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(null);
  const [txtContent, setTxtContent] = useState('');
  const [docType, setDocType] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const webViewRef = useRef(null);

  // 手写相关状态
  const [isHandwritingMode, setIsHandwritingMode] = useState(false); // 默认关闭手写模式
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedTool, setSelectedTool] = useState('pen');
  const [annotations, setAnnotations] = useState({});

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);

  // 引用
  const handwritingRef = useRef(null);

  // 读取文本文件内容
  const loadTextContent = async () => {
    try {
      if (docType === 'txt' && localFilePath) {
        const content = await RNFS.readFile(localFilePath, 'utf8');
        setTxtContent(content);
        // 文本文件通常是单页显示
        setTotalPages(1);
        console.log('文本文件加载完成，设置总页数为1');
      }
    } catch (error) {
      console.error('读取文本文件失败:', error);
    }
  };

  useEffect(() => {
    const prepareFile = async () => {
      try {
        if (!uri) {
          throw new Error('无效的文档URI');
        }

        // 检测文档类型
        let type = '';
        if (uri.toLowerCase().endsWith('.pdf')) {
          type = 'pdf';
        } else if (uri.toLowerCase().endsWith('.docx')) {
          type = 'docx';
        } else if (uri.toLowerCase().endsWith('.doc')) {
          type = 'doc';
        } else if (uri.toLowerCase().endsWith('.txt')) {
          type = 'txt';
        } else {
          type = 'unknown';
        }
        setDocType(type);

        // 处理不同类型的URI
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          // 网络URI，直接使用
          setLocalFilePath(uri);
        } else if (uri.startsWith('content://') || uri.startsWith('file://')) {
          // 内容URI或文件URI，需要复制到应用缓存目录
          const fileName = `doc_${Date.now()}.${uri.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'}`;
          const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

          // 复制文件
          await RNFS.copyFile(uri, destPath);
          setLocalFilePath(destPath);
        } else {
          // 尝试作为本地路径处理
          setLocalFilePath(uri);
        }
      } catch (error) {
        console.error('准备文档失败:', error);
        setError(error.message || '准备文档失败');
        Alert.alert('错误', error.message || '准备文档失败');
      } finally {
        setIsLoading(false);
      }
    };

    prepareFile();
  }, [uri]);


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

      // 检测文档类型
      let type = '';
      if (uri.toLowerCase().endsWith('.pdf')) {
        type = 'pdf';
      } else if (uri.toLowerCase().endsWith('.docx')) {
        type = 'docx';
      } else if (uri.toLowerCase().endsWith('.doc')) {
        type = 'doc';
      } else if (uri.toLowerCase().endsWith('.txt')) {
        type = 'txt';
      } else {
        type = 'unknown';
      }
      setDocType(type);

      // 如果是文本文件，加载文本内容
      if (type === 'txt') {
        await loadTextContent();
      }

      // 如果是支持的文档类型，开始渲染
      if (type === 'docx' || type === 'doc' || type === 'pdf') {
         setIsRendering(true);
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

  // 在外部应用中打开文档
  const handleOpenExternal = async () => {
    try {
      const fileUri = localFilePath || uri;
      if (!fileUri) {
        throw new Error('没有可打开的文件');
      }

      // 确保URI格式正确
      const formattedUri = fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`;

      // 检查是否可以打开
      const canOpen = await Linking.canOpenURL(formattedUri);
      if (canOpen) {
        await Linking.openURL(formattedUri);
      } else {
        // 如果无法直接打开，尝试使用系统分享功能
        await Share.share({
          url: formattedUri,
          title: title || '文档',
        });
      }
    } catch (error) {
      console.error('在外部应用中打开文档失败:', error);
      Alert.alert('错误', '无法在外部应用中打开此文档');
    }
  };

  // 处理WebView消息
  const handleWebViewMessage = (event) => {
    const message = event.nativeEvent.data;
    console.log('收到WebView消息:', message);

    switch (message) {
      case 'export':
        showExportInfo();
        break;
      case 'open_external':
        handleOpenExternal();
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
      {/* 顶部返回按钮 - 增强可见性 */}
      <View style={[styles.headerContainer, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary + '20' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title || '文档查看器'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* AllInOneToolbar - 固定在顶部 */}
      {!isLoading && !error && (
        <View style={styles.toolbarContainer}>
          <AllInOneToolbar
            style={styles.toolbar}
            onToolChange={(toolInfo) => {
              console.log('工具变更:', toolInfo.type);
              setSelectedTool(toolInfo.type);
            }}
            onColorChange={(color) => {
              console.log('颜色变更:', color);
              setStrokeColor(color);
            }}
            onStrokeWidthChange={(width) => {
              console.log('线宽变更:', width);
              setStrokeWidth(width);
            }}
            onUndo={() => {
              console.log('执行撤销');
              if (handwritingRef.current && typeof handwritingRef.current.undoLastStroke === 'function') {
                handwritingRef.current.undoLastStroke();
              }
            }}
            onRedo={() => {
              console.log('执行重做');
              if (handwritingRef.current && typeof handwritingRef.current.redoLastStroke === 'function') {
                handwritingRef.current.redoLastStroke();
              }
            }}
            onClear={() => {
              console.log('清除画布');
              if (handwritingRef.current && typeof handwritingRef.current.clearCanvas === 'function') {
                handwritingRef.current.clearCanvas();
              }
            }}
            initialTool="pen"
            initialColor={strokeColor}
            initialStrokeWidth={strokeWidth}
            canUndo={true}
            canRedo={true}
          />
        </View>
      )}

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
            onPress={() => navigation.reload()}
          >
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <View style={styles.contentContainer}>
          {docType === 'txt' && (
            <View style={styles.textViewContainer}>
              <ScrollView style={styles.textScrollView}>
                <Text style={[styles.textContent, { color: colors.text }]}>
                  {txtContent}
                </Text>
              </ScrollView>

              {/* 手写画布层 */}
              {isHandwritingMode && (
                <HandwritingCanvas
                  ref={handwritingRef}
                  style={styles.handwritingCanvas}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  backgroundColor="transparent"
                  width={Dimensions.get('window').width}
                  height={Dimensions.get('window').height - 200}
                  showToolbar={false}
                  onStrokeStart={() => {
                    console.log('Word文档查看器 - 开始绘制');
                  }}
                  onStrokeEnd={() => {
                    console.log('Word文档查看器 - 结束绘制');
                  }}
                />
              )}
            </View>
          )}

          {(docType === 'docx' || docType === 'doc') && isRendering && (
            <View style={styles.docViewerContainer}>
              <RNDocViewer
                style={styles.docViewer}
                source={{ uri: localFilePath || uri }}
                onLoad={() => {
                  console.log('Word文档加载完成');
                  setIsLoading(false);
                  // Word文档通常是单页显示，设置总页数为1
                  setTotalPages(1);
                }}
                onError={(error) => {
                  console.error('文档加载失败:', error);
                  setError('无法加载文档内容');
                }}
              />

              {/* 手写画布层 */}
              {isHandwritingMode && (
                <HandwritingCanvas
                  ref={handwritingRef}
                  style={styles.handwritingCanvas}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  backgroundColor="transparent"
                  width={Dimensions.get('window').width}
                  height={Dimensions.get('window').height - 200}
                  showToolbar={false}
                  onStrokeStart={() => {
                    console.log('Word文档查看器(DocViewer) - 开始绘制');
                  }}
                  onStrokeEnd={() => {
                    console.log('Word文档查看器(DocViewer) - 结束绘制');
                  }}
                />
              )}
            </View>
          )}

          {docType === 'pdf' && (
            <View style={styles.pdfViewContainer}>
              <WebView
                ref={webViewRef}
                source={{ uri: localFilePath || uri }}
                style={styles.webView}
                onLoad={() => {
                  console.log('PDF在WebView中加载完成');
                  setIsLoading(false);
                  // 对于WebView中的PDF，我们无法准确获取页数，设置为1
                  setTotalPages(1);
                }}
                onError={(error) => {
                  console.error('PDF加载失败:', error);
                  setError('无法加载PDF内容');
                }}
                scalesPageToFit
              />

              {/* 手写画布层 */}
              {isHandwritingMode && (
                <HandwritingCanvas
                  ref={handwritingRef}
                  style={styles.handwritingCanvas}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  backgroundColor="transparent"
                  width={Dimensions.get('window').width}
                  height={Dimensions.get('window').height - 200}
                  showToolbar={false}
                  onStrokeStart={() => {
                    console.log('PDF文档查看器(WebView) - 开始绘制');
                  }}
                  onStrokeEnd={() => {
                    console.log('PDF文档查看器(WebView) - 结束绘制');
                  }}
                />
              )}
            </View>
          )}

          {docType === 'unknown' && (
            <View style={styles.unknownFileContainer}>
              <Icon name="document-outline" size={48} color={colors.text} />
              <Text style={[styles.unknownFileText, { color: colors.text }]}>
                不支持的文件类型
              </Text>
              <Text style={[styles.unknownFileSubText, { color: colors.text }]}>
                请尝试在外部应用中打开
              </Text>
              <TouchableOpacity
                style={[styles.openExternalButton, { backgroundColor: colors.primary }]}
                onPress={handleOpenExternal}
              >
                <Text style={styles.buttonText}>在外部应用中打开</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 页面指示器 - 仅在非文本文档时显示 */}
      {!isLoading && !error && docType !== 'txt' && totalPages > 1 && (
        <View style={[styles.pageIndicator, { backgroundColor: colors.card }]}>
          <Text style={[styles.pageText, { color: colors.text }]}>
            {currentPage} / {totalPages}
          </Text>
        </View>
      )}

      {/* 分页控制按钮 - 仅在非文本文档时显示 */}
      {!isLoading && !error && docType !== 'txt' && totalPages > 1 && (
        <View style={styles.pageControls}>
          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage <= 1 && styles.pageButtonDisabled
            ]}
            onPress={() => {
              if (currentPage > 1) {
                const newPage = currentPage - 1;
                setCurrentPage(newPage);
                // 这里可以添加实际的页面跳转逻辑
                console.log('跳转到上一页:', newPage);
              }
            }}
            disabled={currentPage <= 1}
          >
            <Icon name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pageButton,
              currentPage >= totalPages && styles.pageButtonDisabled
            ]}
            onPress={() => {
              if (currentPage < totalPages) {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
                // 这里可以添加实际的页面跳转逻辑
                console.log('跳转到下一页:', newPage);
              }
            }}
            disabled={currentPage >= totalPages}
          >
            <Icon name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 100,
  },
  backButton: {
    padding: 12,
    marginRight: 12,
    borderRadius: 8,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  toolbarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 70,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
    paddingHorizontal: 0, // 移除左右内边距，让工具栏延伸到屏幕边缘
  },
  toolbar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 0, // 移除圆角，让工具栏完全贴合屏幕边缘
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%', // 确保工具栏宽度为100%
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  contentContainer: {
    flex: 1,
    paddingTop: 80, // 为工具栏留出空间
  },
  textViewContainer: {
    flex: 1,
    position: 'relative',
  },
  textScrollView: {
    flex: 1,
    padding: 16,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  docViewerContainer: {
    flex: 1,
    position: 'relative',
    padding: 10,
  },
  docViewer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  pdfViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  handwritingCanvas: {
    position: 'absolute',
    top: 80, // 从工具栏下方开始，避免遮挡工具栏
    left: 0,
    right: 0,
    bottom: 60, // 为页面指示器留出空间
    backgroundColor: 'transparent',
    zIndex: 10, // 降低z-index，让文档可以接收滚动手势
    pointerEvents: 'box-none', // 只在有内容的地方接收触摸事件
    elevation: 10, // Android elevation
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 15,
  },
  pageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  pageControls: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    zIndex: 15,
  },
  pageButton: {
    padding: 10,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.5,
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
  unknownFileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unknownFileText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  unknownFileSubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  openExternalButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DocViewer;