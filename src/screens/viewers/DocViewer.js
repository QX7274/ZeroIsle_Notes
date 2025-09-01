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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  
  // 状态管理
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
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  
  // 初始化时显示缩放指示器（100%）
  useEffect(() => {
    setShowZoomIndicator(true);
    setTimeout(() => {
      setShowZoomIndicator(false);
    }, 2000);
  }, []);
  

  
  // 转换功能状态
  const [isConverting, setIsConverting] = useState(false);
  
  // 原生前端浏览状态
  const [nativeContent, setNativeContent] = useState(null);
  const [useNativeViewer, setUseNativeViewer] = useState(false);

  // 引用
  const scrollViewRef = useRef(null);
  const pdfRef = useRef(null);
  const webViewRef = useRef(null);
  const pageChangeTimeout = useRef(null);
  const lastScale = useRef(1); // 与scale初始值保持一致

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

    // 清理函数
    return () => {
      if (lastScale.currentTimeout) {
        clearTimeout(lastScale.currentTimeout);
      }
      if (pageChangeTimeout.current) {
        clearTimeout(pageChangeTimeout.current);
      }
    };
  }, [uri, title, fileName, noteId]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setConversionProgress(0);
      setConversionMessage('正在准备文档...');



      let documentPath = uri;

      // 如果是content://协议，复制到本地
      if (uri.startsWith('content://')) {
        setConversionMessage('正在复制文档到本地...');
        const fileExtension = getFileExtension(fileName || title) || 'docx';
        const localFileName = `doc_${Date.now()}.${fileExtension}`;
        const localPath = `${RNFS.CachesDirectoryPath}/${localFileName}`;

        await RNFS.copyFile(uri, localPath);
        documentPath = localPath;
        setLocalFilePath(localPath);


      }

      // 保持加载状态，直到文档解析完成
      setConversionMessage('正在解析文档...');

      // 尝试使用增强文档查看器解析
      try {
        setConversionMessage('正在使用增强文档查看器解析文档...');
        
        // 确保传递正确的文件名（包含扩展名）
        const correctFileName = getFileExtension(fileName || title) ? (fileName || title) : `${fileName || title}.docx`;
        
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
            // 回退到原生解析器
            documentData = await nativeDocumentViewer.readDocument(documentPath, correctFileName);
          }
          return documentData;
        })();

        const documentData = await Promise.race([parsePromise, timeoutPromise]);
        
                 if (documentData && (documentData.content || documentData.htmlContent)) {
           setNativeContent(documentData);
           setUseNativeViewer(true);
           // 根据内容长度估算页数，或者使用解析器返回的页数
           const contentLength = documentData.content?.length || documentData.htmlContent?.length || 0;
           // 更准确的页数估算：每页约800字符，或者使用解析器返回的页数
           const estimatedPages = documentData.totalPages || Math.max(1, Math.ceil(contentLength / 800));
           setTotalPages(estimatedPages);
           setCurrentPage(1); // 重置到第一页
           setIsLoading(false); // 解析成功，停止加载
           return;
         }
      } catch (nativeError) {
        // 回退到后端转换
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
          setIsLoading(false); // 转换成功，停止加载

        } else {
          // 转换失败

          setError('文档转换服务暂时不可用');
          setIsLoading(false); // 转换失败，停止加载
        }

        setIsConverting(false);
      } catch (conversionError) {
        setIsConverting(false);
        setIsLoading(false); // 转换失败，停止加载
        // 转换失败时保持预览模式，但显示错误信息
        setError(`文档转换失败: ${conversionError.message}`);
      }

    } catch (error) {
      setError(error.message || '文档加载失败');
      setIsLoading(false);
      setIsConverting(false);
    }
  };

  const getFileExtension = (fileName) => {
    if (!fileName) return 'docx';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : null;
  };

  // 处理缩放变化（通用方法，PDF/原生内容共用）- 参考PDFViewer.js
  const handleScaleChange = (newScale) => {
    // 过滤微小波动（避免频繁更新）
    if (Math.abs(newScale - lastScale.current) < 0.05) return;
    
    lastScale.current = newScale;
    setScale(newScale);
    
    // 每次缩放都显示指示器
    setShowZoomIndicator(true);
    
    // 延迟隐藏指示器，参考PDFViewer.js
    setTimeout(() => {
      setShowZoomIndicator(false);
    }, 2000);
  };

  // 计算当前页数（通用方法）- 参考FluidPagedNoteScreen.js的实现
  const calculateCurrentPage = (scrollY) => {
    if (!scrollViewRef.current) return currentPage;
    
    const { contentSize } = scrollViewRef.current;
    // 内容高度为0时返回第1页（避免除以0）
    if (contentSize?.height === 0 || totalPages === 0) return 1;
    
    // 使用屏幕高度作为每页高度，与FluidPagedNoteScreen.js保持一致
    const pageHeight = screenHeight;
    // 当前页数 = 滚动位置 / 每页高度 + 1（向下取整，确保页码正确）
    const calculatedPage = Math.max(1, Math.min(totalPages, Math.floor(scrollY / pageHeight) + 1));
    
    return calculatedPage;
  };

  // 滚动到指定页面 - 新增方法，参考FluidPagedNoteScreen.js
  const scrollToPage = (targetPage) => {
    if (!scrollViewRef.current || targetPage < 1 || targetPage > totalPages) {
      return;
    }

    const { contentSize } = scrollViewRef.current;
    if (contentSize?.height === 0) {
      return;
    }

    // 使用屏幕高度作为每页高度，与FluidPagedNoteScreen.js保持一致
    const pageHeight = screenHeight;
    const targetY = Math.max(0, (targetPage - 1) * pageHeight);

    scrollViewRef.current.scrollTo({ y: targetY, animated: true });
  };


  // 处理页码变化 - 新增方法，统一处理页码更新逻辑
  const handlePageChange = (newPage) => {
    const safeTotalPages = Math.max(1, typeof totalPages === 'number' ? totalPages : 1);
    const validPage = Math.max(1, Math.min(safeTotalPages, newPage));
    
    if (validPage !== currentPage) {
      setCurrentPage(validPage);
    }
  };

  // 工具栏事件处理 - 与PDF查看器保持一致
  const handleToolChange = (tool) => {
    // 工具切换处理
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

  // 统一保存功能
  const saveToLocal = async () => {
    const docData = {
      annotations: {}, // 暂时为空，后续可以添加注释功能
      images: images || [],
      currentPage: currentPage || 1,
      totalPages: totalPages || 1,
      updatedAt: new Date().toISOString()
    };
    await SaveUtils.savePDFAnnotations(noteId || uri || title, docData, offlineStorageService);
  };

  // 渲染原生内容
  const renderNativeContent = () => {
    return (
      <View style={styles.nativeContainer}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.nativeScrollView}
          contentContainerStyle={styles.nativeContentContainer}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          pinchGestureEnabled={true}
          scrollEnabled={true}
          onScrollBeginDrag={() => {
            setShowZoomIndicator(false);
          }}
          onPinchGestureStateChange={(event) => {
            const { scale: pinchScale } = event.nativeEvent;
            handleScaleChange(pinchScale);
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            
            // 根据滚动位置更新当前页码 - 参考FluidPagedNoteScreen.js的实现
            const pageHeight = screenHeight;
            const currentPageIndex = Math.floor(contentOffset.y / pageHeight) + 1;
            const safeTotalPages = Math.max(1, typeof totalPages === 'number' ? totalPages : 1);
            
            // 确保页码在有效范围内
            const validPageIndex = Math.max(1, Math.min(safeTotalPages, currentPageIndex));
            
            if (validPageIndex !== currentPage) {
              setCurrentPage(validPageIndex);
            }
          }}
          scrollEventThrottle={16} // 提高滚动事件触发频率
        >
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
                ref={webViewRef}
                source={{ 
                  html: `
                    ${nativeContent.htmlContent}
                    <!-- 注入缩放监听脚本：捕获WebView内部缩放 -->
                    <script>
                      (function() {
                        let lastScale = 1;
                        let initialDistance = null;
                        let initialScale = 1;
                        
                        // 监听触摸缩放事件
                        document.addEventListener('touchstart', function(e) {
                          if (e.touches.length === 2) {
                            const touch1 = e.touches[0];
                            const touch2 = e.touches[1];
                            initialDistance = Math.hypot(
                              touch2.clientX - touch1.clientX,
                              touch2.clientY - touch1.clientY
                            );
                            initialScale = lastScale;
                          }
                        }, { passive: false });
                        
                        document.addEventListener('touchmove', function(e) {
                          if (e.touches.length === 2 && initialDistance !== null) {
                            const touch1 = e.touches[0];
                            const touch2 = e.touches[1];
                            const distance = Math.hypot(
                              touch2.clientX - touch1.clientX,
                              touch2.clientY - touch1.clientY
                            );
                            
                            // 计算缩放比例，限制在合理范围内
                            const scaleRatio = distance / initialDistance;
                            const currentScale = Math.max(0.5, Math.min(3.0, initialScale * scaleRatio));
                            
                            // 发送缩放数据到RN
                            window.ReactNativeWebView.postMessage(
                              JSON.stringify({ type: 'scale', scale: currentScale })
                            );
                            lastScale = currentScale;
                          }
                        }, { passive: false });
                        
                        document.addEventListener('touchend', function(e) {
                          if (e.touches.length < 2) {
                            initialDistance = null;
                          }
                        }, { passive: false });
                      })();
                    </script>
                  `,
                  baseUrl: 'file://'
                }}
                style={styles.webView}
                scrollEnabled={true}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={true}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={false}
                bounces={true}
                automaticallyAdjustContentInsets={false}
                contentInset={{ top: 0, left: 0, bottom: 0, right: 4 }}
                contentInsetAdjustmentBehavior="never"
                indicatorStyle="white"
                onError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView error:', nativeEvent);
                }}
                onHttpError={(syntheticEvent) => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView HTTP error:', nativeEvent);
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'scale' && data.scale) {
                      handleScaleChange(data.scale);
                    }
                  } catch (error) {
                    // 忽略非JSON消息
                  }
                }}
              />
            </View>
          ) : (
            <Text style={[styles.nativeContent, { color: colors.text }]}>
              {nativeContent.formattedContent || nativeContent.content}
            </Text>
          )}
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
    );
  };

  // 渲染PDF内容
  const renderPdfContent = () => {
    return (
      <View style={styles.pdfContainer}>
        <Pdf
          ref={pdfRef}
          source={pdfSource}
          onLoadComplete={(numberOfPages, filePath, width, height) => {
            setTotalPages(numberOfPages || 1);
            setCurrentPage(1);
          }}
          onPageChanged={(page, numberOfPages) => {
            setCurrentPage(page);
            setTotalPages(numberOfPages || 1);
          }}
          onError={(error) => {
            setError('PDF显示失败');
          }}
          style={styles.pdf}
          enablePaging={false} // 连续滚动
          enableRTL={false}
          enableAnnotationRendering={true}
          password=""
          spacing={0}
          minScale={0.3}
          maxScale={4.0}
          scale={scale}
          horizontal={false}
          enableDoubleTapZoom={true}
          enableSwipe={true}
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={true}
          indicatorStyle="white"
          onScaleChanged={(newScale) => {
            handleScaleChange(newScale);
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
    );
  };

  // 渲染页码控制器 - 参考FluidPagedNoteScreen.js的实现
  const renderPageControl = () => {
    // 参考FluidPagedNoteScreen.js：使用安全的页数检查
    const safeTotalPages = Math.max(1, typeof totalPages === 'number' ? totalPages : 1);
    const shouldShowPageControl = (pdfSource && !error) || (useNativeViewer && nativeContent);
    
    // 参考FluidPagedNoteScreen.js：只在有多页时显示页码器
    if (!shouldShowPageControl || safeTotalPages <= 1) return null;

    return (
      <PageControl
        total={safeTotalPages}
        current={currentPage}
        onPrev={() => {
          if (currentPage > 1) {
            const newPage = currentPage - 1;
            handlePageChange(newPage);
            if (pdfRef.current && !useNativeViewer) {
              pdfRef.current.setPage(newPage);
            } else if (useNativeViewer) {
              // 对于原生内容，使用新的滚动方法
              scrollToPage(newPage);
            }
          }
        }}
        onNext={() => {
          if (currentPage < safeTotalPages) {
            const newPage = currentPage + 1;
            handlePageChange(newPage);
            if (pdfRef.current && !useNativeViewer) {
              pdfRef.current.setPage(newPage);
            } else if (useNativeViewer) {
              // 对于原生内容，使用新的滚动方法
              scrollToPage(newPage);
            }
          }
        }}
        onSubmitPage={(pageNum) => {
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= safeTotalPages) {
            handlePageChange(pageNum);
            if (pdfRef.current && !useNativeViewer) {
              pdfRef.current.setPage(pageNum);
            } else if (useNativeViewer) {
              // 对于原生内容，使用新的滚动方法
              scrollToPage(pageNum);
            }
          }
        }}
        storageKey="doc_viewer_pagecontrol_pos"
      />
    );
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
            {/* 保存按钮 - 最右侧位置 */}
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

        {/* 原生前端Word内容显示 */}
        {useNativeViewer && nativeContent && !error && renderNativeContent()}

        {/* PDF内容显示 */}
        {pdfSource && !error && !useNativeViewer && renderPdfContent()}

        {/* 书签面板 */}
        <BookmarkPanel
          visible={bookmarkVisible}
          onClose={() => setBookmarkVisible(false)}
          docId={noteId}
          onJump={(bookmark) => {
            handlePageChange(bookmark.page);
            if (useNativeViewer) {
              scrollToPage(bookmark.page);
            }
            setBookmarkVisible(false);
          }}
        />
      </ViewerLayout>

      {/* 缩放指示器 - 参考PDFViewer.js的位置 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={-90}
      />

      {/* 页码控制器 */}
      {renderPageControl()}
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
    justifyContent: 'flex-end',
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
    height: '100%',
    backgroundColor: 'transparent',
    paddingTop: 0, // 移除顶部内边距，让内容铺满
  },

  // 原生前端样式
  nativeContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  nativeScrollView: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
    // 美化滚动指示器
    scrollIndicatorInsets: { right: 6 },
    // 自定义滚动指示器样式
    indicatorStyle: 'white',
  },
  nativeContentContainer: {
    padding: 0, // 移除所有内边距，让内容铺满
    flexGrow: 1, // 确保内容可以扩展
    minHeight: '100%', // 确保最小高度
  },
  nativeContent: {
    fontSize: 16,
    lineHeight: 28, // 增大行高
    textAlign: 'left',
    paddingHorizontal: 0, // 移除水平内边距，让内容铺满
    width: '100%',
    marginBottom: 0, // 移除底部边距
    flexShrink: 0, // 防止文本被压缩
  },
  htmlContainer: {
    padding: 0, // 移除内边距，让内容铺满
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderLeftWidth: 0,
    height: '100%', // 使用100%高度
    width: '100%',
    flex: 1, // 确保容器可以扩展
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%', // 使用100%高度确保完整显示
    backgroundColor: 'transparent',
    margin: 0, // 移除外边距
    padding: 0, // 移除内边距
  },

  messagesContainer: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 4,
    borderLeft: 2,
    borderLeftColor: '#FFC107',
    width: '100%',
  },
  messageText: {
    fontSize: 12,
    marginBottom: 2,
    width: '100%',
  },
});

export default DocViewer;
