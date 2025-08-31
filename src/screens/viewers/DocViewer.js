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
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Pdf from 'react-native-pdf';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';
import documentConverter from '../../services/document/documentConverter';
import nativeDocumentViewer from '../../services/document/quickPreviewService';
import enhancedDocumentViewer from '../../services/document/enhancedDocumentViewer';

// 导入与PDF查看器相同的组件
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import PageControl from '../../components/viewer/PageControl';
import GlobalStylusOverlay from '../../components/viewer/GlobalStylusOverlay';
import DraggableImage from '../../components/viewer/DraggableImage';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import SaveButton, { SaveUtils } from '../../components/common/SaveButton';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import LoadingIndicator, { ErrorIndicator } from '../../components/common/LoadingIndicator';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import { addBookmark } from '../../services/bookmarkService';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';
import fileHistoryService from '../../services/fileHistoryService';

/**
 * Word文档查看器
 * 布局与PDF查看器保持一致，包括完整的工具栏、页码器、缩放指示器等功能
 */
const DocViewer = ({ route, navigation }) => {
  const { uri, title, noteId, fileName, fromFileHistory } = route.params;
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 处理返回逻辑
  const handleGoBack = () => {
    if (fromFileHistory) {
      // 从文件历史进入，返回主页
      navigation.navigate('Home');
    } else {
      // 正常返回上一页
      navigation.goBack();
    }
  };
  
  // 状态管理 - 与PDF查看器保持一致
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfSource, setPdfSource] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(null);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionMessage, setConversionMessage] = useState('');
  
  // 工具栏相关状态
  const [strokeColor, setStrokeColor] = useState('#000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [deselectTick, setDeselectTick] = useState(0);
  
  // 缩放相关状态
  const [currentScale, setCurrentScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  // 预览功能状态
  const [showPreview, setShowPreview] = useState(true);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  
  // 原生前端浏览状态
  const [nativeContent, setNativeContent] = useState(null);
  const [useNativeViewer, setUseNativeViewer] = useState(false);

  // 引用
  const scrollViewRef = useRef(null);
  const pdfRef = useRef(null);

  useEffect(() => {
    loadDocument();

    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: 'word',
        fileName: fileName || title,
        noteId
      });
    }
  }, [uri, title, fileName, noteId]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setConversionProgress(0);
      setConversionMessage('正在准备文档...');

      console.log('DocViewer: 开始加载Word文档:', uri);

      let documentPath = uri;

      // 如果是content://协议，复制到本地
      if (uri.startsWith('content://')) {
        setConversionMessage('正在复制文档到本地...');
        const fileExtension = getFileExtension(fileName || 'document.docx');
        const localFileName = `doc_${Date.now()}.${fileExtension}`;
        const localPath = `${RNFS.CachesDirectoryPath}/${localFileName}`;

        await RNFS.copyFile(uri, localPath);
        documentPath = localPath;
        setLocalFilePath(localPath);

        console.log('DocViewer: 文件复制到本地:', localPath);
      }

      // 立即显示预览信息，提高用户体验
      const fileStats = await RNFS.stat(documentPath);
      setPreviewInfo({
        fileName: fileName || title || '文档',
        fileSize: fileStats.size,
        filePath: documentPath,
        lastModified: fileStats.mtime
      });
      setShowPreview(true);
      setIsLoading(false); // 预览准备完成，停止加载指示器

      // 尝试使用增强文档查看器解析
      try {
        setConversionMessage('正在使用增强文档查看器解析文档...');
        
        // 确保传递正确的文件名（包含扩展名）
        const correctFileName = fileName || `${title}.docx`;
        console.log('DocViewer: 传递文件名给增强解析器:', correctFileName);
        
        // 性能优化：添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('解析超时')), 15000); // 15秒超时
        });

        const parsePromise = (async () => {
          // 优先使用enhancedDocumentViewer
          let documentData = null;
          try {
            documentData = await enhancedDocumentViewer.readDocument(documentPath, correctFileName);
          } catch (enhancedError) {
            console.warn('DocViewer: 增强解析器失败，尝试原生解析器:', enhancedError);
            // 回退到原生解析器
            documentData = await nativeDocumentViewer.readDocument(documentPath, correctFileName);
          }
          return documentData;
        })();

        const documentData = await Promise.race([parsePromise, timeoutPromise]);
        
        if (documentData && (documentData.content || documentData.htmlContent)) {
          setNativeContent(documentData);
          setUseNativeViewer(true);
          setShowPreview(false);
          console.log('DocViewer: 文档解析成功，使用增强查看器');
          return;
        }
      } catch (nativeError) {
        console.warn('DocViewer: 所有原生解析失败，回退到后端转换:', nativeError);
      }

      // 如果原生解析失败，在后台异步进行文档转换
      setIsConverting(true);
      setConversionMessage('正在后台转换文档格式...');

      try {
        const pdfPath = await documentConverter.convertWordToPDF(
          documentPath,
          (progress, message) => {
            setConversionProgress(progress);
            setConversionMessage(message);
          }
        );

        if (pdfPath) {
          // 转换成功，设置PDF源
          const pdfSource = { uri: `file://${pdfPath}`, cache: true };
          setPdfSource(pdfSource);
          setShowPreview(false); // 隐藏预览，显示实际内容
          console.log('DocViewer: 文档转换完成，PDF路径:', pdfPath);
        } else {
          // 转换失败但有fallback，保持预览模式
          console.log('DocViewer: 使用预览模式显示文档');
          setConversionMessage('文档转换服务暂时不可用，以预览模式显示');
        }

        setIsConverting(false);
      } catch (conversionError) {
        console.error('DocViewer: 文档转换失败:', conversionError);
        setIsConverting(false);
        // 转换失败时保持预览模式，但显示错误信息
        setError(`文档转换失败: ${conversionError.message}`);
      }

    } catch (error) {
      console.error('DocViewer: 文档加载失败:', error);
      setError(error.message || '文档加载失败');
      setIsLoading(false);
      setIsConverting(false);
    }
  };

  const getFileExtension = (fileName) => {
    if (!fileName) return 'docx';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'docx';
  };

  const openWithExternalApp = async () => {
    try {
      const filePath = localFilePath || uri;

      if (!filePath) {
        Alert.alert('错误', '文件路径不存在');
        return;
      }

      console.log('尝试使用外部应用打开Word文档:', filePath);

      // 使用enhancedDocumentViewer的原生应用打开功能
      try {
        const fileType = getFileExtension(fileName || title);
        await enhancedDocumentViewer.openWithNativeApp(filePath, fileName || title, fileType);
        console.log('Word文档外部打开成功');
        return;
      } catch (enhancedError) {
        console.error('增强查看器打开失败，尝试原生查看器:', enhancedError);
        try {
          const fileType = getFileExtension(fileName || title);
          await nativeDocumentViewer.openWithNativeApp(filePath, fileName || title, fileType);
          console.log('Word文档外部打开成功');
          return;
        } catch (nativeError) {
          console.error('原生应用打开失败:', nativeError);
        }
      }

      // 回退到原来的方法
      let opened = false;

      // 方法1: 使用react-native-doc-viewer
      try {
        const OpenFile = require('react-native-doc-viewer');
        
        if (OpenFile && OpenFile.openDoc) {
          await OpenFile.openDoc([{
            url: filePath,
            fileName: fileName || title || 'document.docx',
            cache: true,
            fileType: 'docx'
          }], (error, url) => {
            if (error) {
              console.error('react-native-doc-viewer打开失败:', error);
            } else {
              console.log('Word文档外部打开成功:', url);
              opened = true;
            }
          });
        } else {
          console.warn('OpenFile.openDoc方法不可用');
        }
      } catch (openFileError) {
        console.error('react-native-doc-viewer异常:', openFileError);
      }

      // 方法2: 使用react-native-file-viewer
      if (!opened) {
        try {
          const FileViewer = require('react-native-file-viewer');
          
          if (FileViewer && FileViewer.open) {
            const mimeType = filePath.endsWith('.docx') 
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
              : undefined;
            await FileViewer.open(filePath, { showOpenWithDialog: true, onDismiss: () => {}, mimeType });
            console.log('使用FileViewer打开成功');
            opened = true;
          } else {
            console.warn('FileViewer.open方法不可用');
          }
        } catch (fileViewerError) {
          console.error('react-native-file-viewer异常:', fileViewerError);
        }
      }

      // 方法3: 使用系统默认应用
      if (!opened) {
        try {
          const fileUrl = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
          const canOpen = await Linking.canOpenURL(fileUrl);
          
          if (canOpen) {
            await Linking.openURL(fileUrl);
            console.log('使用系统默认应用打开成功');
            opened = true;
          } else {
            console.warn('系统无法打开此文件类型');
          }
        } catch (linkingError) {
          console.error('Linking打开异常:', linkingError);
        }
      }

      // 如果所有方法都失败
      if (!opened) {
        Alert.alert(
          '无法打开文件',
          '请确保设备上安装了支持Word文档的应用（如Microsoft Word、WPS Office等）\n\n文件路径: ' + filePath,
          [
            { text: '复制路径', onPress: () => {
              // 复制文件路径到剪贴板
              const Clipboard = require('@react-native-clipboard/clipboard').default;
              if (Clipboard) {
                Clipboard.setString(filePath);
                Alert.alert('提示', '文件路径已复制到剪贴板');
              }
            }},
            { text: '确定', style: 'default' }
          ]
        );
      }

    } catch (error) {
      console.error('打开外部应用异常:', error);
      Alert.alert(
        '无法打开文件',
        '请确保设备上安装了支持Word文档的应用（如Microsoft Word、WPS Office等）',
        [
          { text: '确定', style: 'default' }
        ]
      );
    }
  };

  // 工具栏事件处理 - 与PDF查看器保持一致
  const handleToolChange = (tool) => {
    console.log('DocViewer: 工具切换:', tool);
  };

  const handleColorChange = (color) => {
    setStrokeColor(color);
  };

  const handleStrokeWidthChange = (width) => {
    setStrokeWidth(width);
  };

  const handleImageUpload = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          const newImage = {
            id: Date.now().toString(),
            uri: asset.uri,
            x: 100,
            y: 100,
            scale: 1,
          };
          setImages(prev => [...prev, newImage]);
        }
      }
    );
  };

  const handleAddBookmark = async () => {
    try {
      await addBookmark({
        docId: noteId,
        page: currentPage,
        title: `第${currentPage}页`,
        note: ''
      });
      Alert.alert('成功', '书签已添加');
    } catch (error) {
      Alert.alert('错误', '添加书签失败');
    }
  };

  const handleMoveFloatingImage = (id, position) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, ...position } : img
    ));
  };

  const handleRemoveFloatingImage = (id) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const saveToLocal = async () => {
    try {
      // 保存文档状态
      const docData = {
        _id: noteId,
        id: noteId,
        title: title || fileName,
        content: docContent,
        type: 'word',
        file_type: 'docx',
        currentPage,
        totalPages,
        images,
        updated_at: new Date().toISOString()
      };
      
      await offlineStorageService.saveNote(docData);
      return true;
    } catch (error) {
      console.error('DocViewer: 保存失败:', error);
      return false;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 工具栏容器 - 始终显示在最顶部 */}
      {!isLoading && !error && (
        <ToolbarContainer>
          <AllInOneToolbar
            onToolChange={handleToolChange}
            onColorChange={handleColorChange}
            onStrokeWidthChange={handleStrokeWidthChange}
            onImageUpload={handleImageUpload}
            onBookmarkAdd={handleAddBookmark}
            onBookmarkList={() => setBookmarkVisible(true)}
          />
        </ToolbarContainer>
      )}
      <ViewerLayout
        headerLeft={<BackButton onPress={handleGoBack} color={colors.primary} background={colors.primary + '20'} />}
        headerRight={
          <View style={styles.headerRightContainer}>
            <SaveButton
              onSave={saveToLocal}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={styles.saveButtonCompact}
            />
          </View>
        }
        title={title || 'Word文档'}
        showToolbar={true}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={noteId}
        navigation={navigation}
        colors={colors}
      >

        {/* 加载指示器 */}
        {isLoading && (
          <LoadingIndicator
            message={conversionMessage || "正在加载Word文档..."}
            subMessage={conversionProgress > 0 ? `转换进度: ${conversionProgress}%` : "正在准备文档查看器"}
            progress={conversionProgress}
          />
        )}

        {/* 错误指示器 */}
        {error && (
          <ErrorIndicator
            message="Word文档加载失败"
            subMessage={error}
            onRetry={loadDocument}
          />
        )}

        {/* 文档预览 - 在转换完成前显示 */}
        {showPreview && previewInfo && !pdfSource && (
          <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
            <View style={styles.previewCard}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {previewInfo.fileName}
              </Text>
              <Text style={[styles.previewInfo, { color: colors.onSurfaceVariant }]}>
                文件大小: {(previewInfo.fileSize / 1024 / 1024).toFixed(2)} MB
              </Text>
              <Text style={[styles.previewInfo, { color: colors.onSurfaceVariant }]}>
                文档类型: Word文档
              </Text>

              {isConverting && (
                <View style={styles.conversionStatus}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.conversionText, { color: colors.primary }]}>
                    {conversionMessage}
                  </Text>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${conversionProgress}%`
                        }
                      ]}
                    />
                  </View>
                </View>
              )}

              {!isConverting && (
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={openWithExternalApp}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>
                      用外部应用打开
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.secondary }]}
                    onPress={handleGoBack}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.onSecondary }]}>
                      返回主页
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* 原生前端Word内容显示 */}
        {useNativeViewer && nativeContent && !error && (
          <View style={styles.nativeContainer}>
            <ScrollView 
              style={styles.nativeScrollView}
              contentContainerStyle={styles.nativeContentContainer}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
            >
              <View style={[styles.nativeDocument, { backgroundColor: colors.surface }]}>
                <Text style={[styles.nativeTitle, { color: colors.text }]}>
                  {previewInfo?.fileName || 'Word文档'}
                </Text>
                
                {/* 显示解析信息 */}
                {nativeContent.metadata && (
                  <View style={styles.metadataContainer}>
                    <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                      解析方式: {nativeContent.metadata.extractionMethod}
                    </Text>
                    <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                      文件大小: {(nativeContent.metadata.fileSize / 1024).toFixed(2)} KB
                    </Text>
                    {nativeContent.structure && (
                      <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                        段落数: {nativeContent.structure.paragraphs} | 
                        表格: {nativeContent.structure.tables} | 
                        图片: {nativeContent.structure.images}
                      </Text>
                    )}
                  </View>
                )}
                
                {/* 显示解析消息 */}
                {nativeContent.messages && nativeContent.messages.length > 0 && (
                  <View style={styles.messagesContainer}>
                    {nativeContent.messages.map((msg, index) => (
                      <Text key={index} style={[styles.messageText, { color: colors.error }]}>
                        {msg.message}
                      </Text>
                    ))}
                  </View>
                )}
                
                {/* 显示文档内容 */}
                {nativeContent.structure?.hasHtml && nativeContent.htmlContent ? (
                  <View style={styles.htmlContainer}>
                    <WebView
                      source={{ html: nativeContent.htmlContent }}
                      style={styles.webView}
                      scrollEnabled={false}
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      startInLoadingState={true}
                      scalesPageToFit={true}
                      onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView error:', nativeEvent);
                      }}
                      onHttpError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.warn('WebView HTTP error:', nativeEvent);
                      }}
                    />
                  </View>
                ) : (
                  <Text style={[styles.nativeContent, { color: colors.text }]}>
                    {nativeContent.formattedContent || nativeContent.content}
                  </Text>
                )}
              </View>
            </ScrollView>

            {/* 浮动图片 */}
            <View onStartShouldSetResponder={() => { setDeselectTick(t => t + 1); return false; }}>
              {Array.isArray(images) && images.map(img => (
                <DraggableImage
                  key={img.id}
                  id={img.id}
                  uri={img.uri}
                  initial={{ x: img.x, y: img.y }}
                  initialScale={img.scale || 1}
                  deselectSignal={deselectTick}
                  onMove={handleMoveFloatingImage}
                  onResize={(id, data) => {
                    const next = images.map(it => it.id === id ? { ...it, scale: data.scale } : it);
                    setImages(next);
                  }}
                  onRemove={handleRemoveFloatingImage}
                />
              ))}
            </View>

            {/* 全局轻量手写覆盖层 */}
            <GlobalStylusOverlay color={strokeColor} width={strokeWidth} />
          </View>
        )}

        {/* PDF内容显示 */}
        {pdfSource && !error && !useNativeViewer && (
          <View style={styles.pdfContainer}>
            {/* 主PDF显示组件 */}
            <Pdf
              ref={pdfRef}
              source={pdfSource}
              onLoadComplete={(numberOfPages, filePath, width, height) => {
                console.log('DocViewer: PDF加载完成，页数:', numberOfPages);
                setTotalPages(numberOfPages || 1);
              }}
              onPageChanged={(page, numberOfPages) => {
                console.log('DocViewer: 页面切换到:', page);
                setCurrentPage(page);
              }}
              onError={(error) => {
                console.error('DocViewer: PDF显示错误:', error);
                setError('PDF显示失败');
              }}
              style={styles.pdf}
              enablePaging={true}
              enableRTL={false}
              enableAnnotationRendering={true}
              password=""
              spacing={0}
              minScale={0.5}
              maxScale={3.0}
              scale={currentScale}
              horizontal={false}
              page={currentPage}
              onScaleChanged={(scale) => {
                setCurrentScale(scale);
                setShowZoomIndicator(true);
                setTimeout(() => setShowZoomIndicator(false), 2000);
              }}
            />

            {/* 浮动图片 */}
            <View onStartShouldSetResponder={() => { setDeselectTick(t => t + 1); return false; }}>
              {Array.isArray(images) && images.map(img => (
                <DraggableImage
                  key={img.id}
                  id={img.id}
                  uri={img.uri}
                  initial={{ x: img.x, y: img.y }}
                  initialScale={img.scale || 1}
                  deselectSignal={deselectTick}
                  onMove={handleMoveFloatingImage}
                  onResize={(id, data) => {
                    const next = images.map(it => it.id === id ? { ...it, scale: data.scale } : it);
                    setImages(next);
                  }}
                  onRemove={handleRemoveFloatingImage}
                />
              ))}
            </View>

            {/* 全局轻量手写覆盖层 */}
            <GlobalStylusOverlay color={strokeColor} width={strokeWidth} />
          </View>
        )}

        {/* 外部应用打开按钮 */}
        {(pdfSource || (useNativeViewer && nativeContent)) && !error && (
          <TouchableOpacity
            style={[styles.externalButton, { backgroundColor: colors.secondary }]}
            onPress={openWithExternalApp}
          >
            <Icon name="open-outline" size={16} color={colors.onSecondary} />
            <Text style={[styles.externalButtonText, { color: colors.onSecondary }]}>
              外部应用
            </Text>
          </TouchableOpacity>
        )}

        {/* 页码控制器 */}
        {((pdfSource && !error) || (useNativeViewer && nativeContent)) && totalPages > 0 && (
          <PageControl
            total={totalPages}
            current={currentPage}
            onPrev={() => {
              if (currentPage > 1) {
                const newPage = currentPage - 1;
                setCurrentPage(newPage);
                if (pdfRef.current && !useNativeViewer) {
                  pdfRef.current.setPage(newPage);
                }
              }
            }}
            onNext={() => {
              if (currentPage < totalPages) {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
                if (pdfRef.current && !useNativeViewer) {
                  pdfRef.current.setPage(newPage);
                }
              }
            }}
            onSubmitPage={(pageNum) => {
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                setCurrentPage(pageNum);
                if (pdfRef.current && !useNativeViewer) {
                  pdfRef.current.setPage(pageNum);
                }
              }
            }}
            storageKey="doc_viewer_pagecontrol_pos"
          />
        )}

        {/* 缩放指示器 */}
        <ZoomIndicator
          scale={currentScale}
          visible={showZoomIndicator}
          autoHideDelay={2000}
        />

        {/* 书签面板 */}
        <BookmarkPanel
          visible={bookmarkVisible}
          onClose={() => setBookmarkVisible(false)}
          docId={noteId}
          onJump={(bookmark) => {
            setCurrentPage(bookmark.page);
            setBookmarkVisible(false);
          }}
        />
      </ViewerLayout>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
  pdfContainer: {
    flex: 1,
    position: 'relative',
  },
  pdf: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  externalButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  externalButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // 预览组件样式
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  previewInfo: {
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  conversionStatus: {
    marginTop: 20,
    alignItems: 'center',
    width: '100%',
  },
  conversionText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  previewActions: {
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 原生前端样式
  nativeContainer: {
    flex: 1,
    position: 'relative',
  },
  nativeScrollView: {
    flex: 1,
  },
  nativeContentContainer: {
    padding: 20,
  },
  nativeDocument: {
    padding: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nativeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  nativeContent: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
  },
  htmlContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    borderLeft: 4,
    borderLeftColor: '#2196F3',
    minHeight: 400,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  metadataContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  metadataText: {
    fontSize: 12,
    marginBottom: 4,
  },
  messagesContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 8,
    borderLeft: 4,
    borderLeftColor: '#FFC107',
  },
  messageText: {
    fontSize: 12,
    marginBottom: 2,
  },
});

export default DocViewer;
