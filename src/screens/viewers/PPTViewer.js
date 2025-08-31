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
  Image,
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
import HandwritingCanvas from '../../components/handwriting/HandwritingCanvas';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import { addBookmark } from '../../services/bookmarkService';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';
import fileHistoryService from '../../services/fileHistoryService';

/**
 * PPT演示文稿查看器
 * 布局与PDF查看器保持一致，包括完整的工具栏、页码器、缩放指示器等功能
 */
const PPTViewer = ({ route, navigation }) => {
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

  // PPT特有状态
  const [slides, setSlides] = useState([]);

  // 内存管理：只保留当前页面和相邻页面的图片
  const [loadedSlides, setLoadedSlides] = useState(new Set());
  const [slideCache, setSlideCache] = useState(new Map());
  
  // 性能优化：添加防抖
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);

  // 内存管理：清理不需要的幻灯片缓存
  const cleanupSlideCache = (currentPageNum) => {
    const keepPages = new Set();
    // 保留当前页面和前后各2页
    for (let i = Math.max(1, currentPageNum - 2); i <= Math.min(totalPages, currentPageNum + 2); i++) {
      keepPages.add(i);
    }

    setSlideCache(prevCache => {
      const newCache = new Map();
      for (const [page, data] of prevCache.entries()) {
        if (keepPages.has(page)) {
          newCache.set(page, data);
        }
      }
      return newCache;
    });

    setLoadedSlides(keepPages);
  };

  // 页面切换处理函数
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    cleanupSlideCache(newPage);
  };

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
    loadPresentation();

    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: 'powerpoint',
        fileName: fileName || title,
        noteId
      });
    }
  }, [uri, title, fileName, noteId]);

  const loadPresentation = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setConversionProgress(0);
      setConversionMessage('正在准备演示文稿...');

      console.log('PPTViewer: 开始加载PPT演示文稿:', uri);

      let presentationPath = uri;

      // 如果是content://协议，复制到本地
      if (uri.startsWith('content://')) {
        setConversionMessage('正在复制演示文稿到本地...');
        
        try {
          // 尝试使用持久化服务
          const filePersistenceService = require('../../services/files/filePersistenceService').default;
          const persistedFile = await filePersistenceService.persistFile(
            uri,
            fileName || 'presentation.pptx',
            'pptx'
          );

          presentationPath = persistedFile.localPath;
          setLocalFilePath(persistedFile.localPath);

          console.log('PPTViewer: 文件持久化完成:', persistedFile.localPath);
        } catch (persistError) {
          console.error('PPTViewer: 文件持久化失败，回退到缓存目录:', persistError);

          // 如果持久化失败，回退到原来的缓存目录方式
          const fileExtension = getFileExtension(fileName || 'presentation.pptx');
          const localFileName = `ppt_${Date.now()}.${fileExtension}`;
          const localPath = `${RNFS.CachesDirectoryPath}/${localFileName}`;

          await RNFS.copyFile(uri, localPath);
          presentationPath = localPath;
          setLocalFilePath(localPath);

          console.log('PPTViewer: 文件复制到缓存目录:', localPath);
        }
      }

      // 立即显示预览信息，提高用户体验
      const fileStats = await RNFS.stat(presentationPath);
      setPreviewInfo({
        fileName: fileName || title || '演示文稿',
        fileSize: fileStats.size,
        filePath: presentationPath,
        lastModified: fileStats.mtime
      });
      setShowPreview(true);
      setIsLoading(false); // 预览准备完成，停止加载指示器

      // 尝试使用增强文档查看器解析
      try {
        setConversionMessage('正在使用增强文档查看器解析演示文稿...');
        setIsLoadingDocument(true);
        
        // 确保传递正确的文件名（包含扩展名）
        const correctFileName = fileName || `${title}.pptx`;
        console.log('PPTViewer: 传递文件名给增强解析器:', correctFileName);
        
        // 性能优化：添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('解析超时')), 15000); // 15秒超时
        });

        const parsePromise = (async () => {
          // 优先使用enhancedDocumentViewer
          let documentData = null;
          try {
            documentData = await enhancedDocumentViewer.readDocument(presentationPath, correctFileName);
          } catch (enhancedError) {
            console.warn('PPTViewer: 增强解析器失败，尝试原生解析器:', enhancedError);
            // 回退到原生解析器
            documentData = await nativeDocumentViewer.readDocument(presentationPath, correctFileName);
          }
          return documentData;
        })();

        const documentData = await Promise.race([parsePromise, timeoutPromise]);
        
        if (documentData && documentData.slides && documentData.slides.length > 0) {
          setNativeContent(documentData);
          setUseNativeViewer(true);
          setShowPreview(false);
          setTotalPages(documentData.slides.length);
          console.log('PPTViewer: 演示文稿解析成功，幻灯片数量:', documentData.slides.length);
          return;
        }
      } catch (nativeError) {
        console.warn('PPTViewer: 所有原生解析失败，回退到后端转换:', nativeError);
      } finally {
        setIsLoadingDocument(false);
      }

      // 如果原生解析失败，在后台异步进行文档转换
      setIsConverting(true);
      setConversionMessage('正在后台转换演示文稿格式...');

      try {
        const pdfPath = await documentConverter.convertPPTToPDF(
          presentationPath,
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
          console.log('PPTViewer: 演示文稿转换完成，PDF路径:', pdfPath);
        } else {
          // 转换失败但有fallback，保持预览模式
          console.log('PPTViewer: 使用预览模式显示演示文稿');
          setConversionMessage('文档转换服务暂时不可用，以预览模式显示');
        }

        setIsConverting(false);
      } catch (conversionError) {
        console.error('PPTViewer: 演示文稿转换失败:', conversionError);
        setIsConverting(false);
        // 转换失败时保持预览模式，但显示错误信息
        setError(`演示文稿转换失败: ${conversionError.message}`);
      }

    } catch (error) {
      console.error('PPTViewer: 演示文稿加载失败:', error);
      setError(error.message || '演示文稿加载失败');
      setIsLoading(false);
      setIsConverting(false);
    }
  };

  const getFileExtension = (fileName) => {
    if (!fileName) return 'pptx';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'pptx';
  };

  const openWithExternalApp = async () => {
    try {
      const filePath = localFilePath || uri;

      if (!filePath) {
        Alert.alert('错误', '文件路径不存在');
        return;
      }

      console.log('尝试使用外部应用打开PPT文件:', filePath);

      // 使用enhancedDocumentViewer的原生应用打开功能
      try {
        const fileType = getFileExtension(fileName || title);
        await enhancedDocumentViewer.openWithNativeApp(filePath, fileName || title, fileType);
        console.log('PPT文件外部打开成功');
        return;
      } catch (enhancedError) {
        console.error('增强查看器打开失败，尝试原生查看器:', enhancedError);
        try {
          const fileType = getFileExtension(fileName || title);
          await nativeDocumentViewer.openWithNativeApp(filePath, fileName || title, fileType);
          console.log('PPT文件外部打开成功');
          return;
        } catch (nativeError) {
          console.error('原生应用打开失败:', nativeError);
        }
      }

      // 回退到react-native-doc-viewer
      try {
        const OpenFile = require('react-native-doc-viewer');

        await OpenFile.openDoc([{
          url: filePath,
          fileName: fileName || title || 'presentation.pptx',
          cache: true,
          fileType: 'pptx'
        }], (error, url) => {
          if (error) {
            console.error('打开外部应用失败:', error);
            Alert.alert(
              '无法打开文件',
              '请确保设备上安装了支持PPT文件的应用（如Microsoft PowerPoint、WPS Office等）',
              [
                { text: '确定', style: 'default' }
              ]
            );
          } else {
            console.log('PPT文件外部打开成功:', url);
          }
        });
      } catch (openFileError) {
        console.error('react-native-doc-viewer异常:', openFileError);
        Alert.alert(
          '无法打开文件',
          '请确保设备上安装了支持PPT文件的应用（如Microsoft PowerPoint、WPS Office等）',
          [
            { text: '确定', style: 'default' }
          ]
        );
      }

    } catch (error) {
      console.error('打开外部应用异常:', error);
      Alert.alert(
        '无法打开文件',
        '请确保设备上安装了支持PPT文件的应用（如Microsoft PowerPoint、WPS Office等）',
        [
          { text: '确定', style: 'default' }
        ]
      );
    }
  };

  // 工具栏事件处理 - 与PDF查看器保持一致
  const handleToolChange = (tool) => {
    console.log('PPTViewer: 工具切换:', tool);
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
        title: `幻灯片${currentPage}`,
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
      // 保存演示文稿状态
      const pptData = {
        _id: noteId,
        id: noteId,
        title: title || fileName,
        type: 'powerpoint',
        file_type: 'pptx',
        currentPage,
        totalPages,
        slides,
        images,
        updated_at: new Date().toISOString()
      };
      
      await offlineStorageService.saveNote(pptData);
      return true;
    } catch (error) {
      console.error('PPTViewer: 保存失败:', error);
      return false;
    }
  };

  const getCurrentSlide = () => {
    return slides[currentPage - 1] || { title: '幻灯片', content: '加载中...' };
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
        title={title || 'PPT演示文稿'}
        showToolbar={true}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
        colors={colors}
      >

        {/* 加载指示器 */}
        {isLoading && (
          <LoadingIndicator
            message="正在加载PPT演示文稿..."
            subMessage="正在准备演示文稿查看器"
          />
        )}

        {/* 错误指示器 */}
        {error && (
          <ErrorIndicator
            message="PPT演示文稿加载失败"
            subMessage={error}
            onRetry={loadPresentation}
          />
        )}

        {/* 演示文稿预览 - 在转换完成前显示 */}
        {showPreview && previewInfo && slides.length === 0 && (
          <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
            <View style={styles.previewCard}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>
                {previewInfo.fileName}
              </Text>
              <Text style={[styles.previewInfo, { color: colors.onSurfaceVariant }]}>
                文件大小: {(previewInfo.fileSize / 1024 / 1024).toFixed(2)} MB
              </Text>
              <Text style={[styles.previewInfo, { color: colors.onSurfaceVariant }]}>
                文档类型: PowerPoint演示文稿
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

        {/* 原生前端PPT内容显示 */}
        {useNativeViewer && nativeContent && !error && (
          <View style={styles.nativeContainer}>
            <ScrollView 
              style={styles.nativeScrollView}
              contentContainerStyle={styles.nativeContentContainer}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
            >
              {/* 显示解析信息 */}
              {nativeContent.metadata && (
                <View style={styles.metadataContainer}>
                  <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                    解析方式: {nativeContent.metadata.extractionMethod}
                  </Text>
                  <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                    文件大小: {(nativeContent.metadata.fileSize / 1024).toFixed(2)} KB
                  </Text>
                  <Text style={[styles.metadataText, { color: colors.onSurfaceVariant }]}>
                    幻灯片数量: {nativeContent.slides ? nativeContent.slides.length : 0}
                  </Text>
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
              
              {/* 显示HTML内容 */}
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
                /* 显示幻灯片内容 */
                nativeContent.slides && nativeContent.slides.map((slide, index) => (
                  <View 
                    key={slide.id || index} 
                    style={[
                      styles.nativeSlide, 
                      { 
                        backgroundColor: colors.surface,
                        display: index === currentPage - 1 ? 'flex' : 'none'
                      }
                    ]}
                  >
                    <View style={styles.slideHeader}>
                      <Text style={[styles.slideTitle, { color: colors.text }]}>
                        {slide.title || `幻灯片 ${index + 1}`}
                      </Text>
                      <Text style={[styles.slideNumber, { color: colors.onSurfaceVariant }]}>
                        {index + 1} / {nativeContent.slides.length}
                      </Text>
                    </View>
                    
                    <View style={styles.slideContent}>
                      {/* 显示幻灯片文本内容 */}
                      {slide.content && (
                        <Text style={[styles.slideText, { color: colors.text }]}>
                          {slide.content}
                        </Text>
                      )}
                      
                      {/* 显示幻灯片图片 */}
                      {slide.images && slide.images.length > 0 && (
                        <View style={styles.slideImages}>
                          {slide.images.map((image, imgIndex) => (
                            <Image
                              key={imgIndex}
                              source={{ uri: image.uri }}
                              style={styles.slideImage}
                              resizeMode="contain"
                            />
                          ))}
                        </View>
                      )}
                      
                      {/* 显示幻灯片表格 */}
                      {slide.tables && slide.tables.length > 0 && (
                        <View style={styles.slideTables}>
                          {slide.tables.map((table, tableIndex) => (
                            <View key={tableIndex} style={styles.slideTable}>
                              <Text style={[styles.tableTitle, { color: colors.text }]}>
                                表格 {tableIndex + 1}
                              </Text>
                              <Text style={[styles.tableContent, { color: colors.text }]}>
                                {table.content}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      
                      {/* 如果没有内容，显示提示 */}
                      {!slide.content && (!slide.images || slide.images.length === 0) && (!slide.tables || slide.tables.length === 0) && (
                        <Text style={[styles.slideText, { color: colors.onSurfaceVariant }]}>
                          此幻灯片暂无内容
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* 外部打开按钮 */}
            <TouchableOpacity
              style={[styles.externalButton, { backgroundColor: colors.primary }]}
              onPress={openWithExternalApp}
            >
              <Icon name="play-outline" size={16} color={colors.onPrimary} />
              <Text style={[styles.externalButtonText, { color: colors.onPrimary }]}>
                外部播放
              </Text>
            </TouchableOpacity>

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
                console.log('PPTViewer: PDF加载完成，页数:', numberOfPages);
                setTotalPages(numberOfPages || 1);
              }}
              onPageChanged={(page, numberOfPages) => {
                console.log('PPTViewer: 页面切换到:', page);
                setCurrentPage(page);
              }}
              onError={(error) => {
                console.error('PPTViewer: PDF显示错误:', error);
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

            {/* 外部打开按钮 */}
            <TouchableOpacity
              style={[styles.externalButton, { backgroundColor: colors.primary }]}
              onPress={openWithExternalApp}
            >
              <Icon name="play-outline" size={16} color={colors.onPrimary} />
              <Text style={[styles.externalButtonText, { color: colors.onPrimary }]}>
                外部播放
              </Text>
            </TouchableOpacity>

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

        {/* 页码控制器 */}
        {!isLoading && !error && totalPages > 0 && (
          <PageControl
            total={totalPages}
            current={currentPage}
            onPrev={() => {
              if (currentPage > 1) {
                handlePageChange(currentPage - 1);
              }
            }}
            onNext={() => {
              if (currentPage < totalPages) {
                handlePageChange(currentPage + 1);
              }
            }}
            onSubmitPage={(pageNum) => {
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                handlePageChange(pageNum);
              }
            }}
            storageKey="ppt_viewer_pagecontrol_pos"
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
            handlePageChange(bookmark.page);
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
  pptContainer: {
    flex: 1,
    position: 'relative',
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
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  slideContainer: {
    minHeight: 500,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  slideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  slideNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  slideText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  slideThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  openButtonText: {
    fontSize: 16,
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
  nativeSlide: {
    minHeight: 500,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
  },
  slideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  slideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  slideNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  slideText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  // 原生前端样式
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
  // 幻灯片内容样式
  slideImages: {
    marginTop: 16,
    alignItems: 'center',
  },
  slideImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  slideTables: {
    marginTop: 16,
  },
  slideTable: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tableContent: {
    fontSize: 12,
    lineHeight: 18,
  },
});

export default PPTViewer;
