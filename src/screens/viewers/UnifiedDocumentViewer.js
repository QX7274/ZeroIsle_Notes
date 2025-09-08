import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Alert,
  Text,
  TextInput,
  Platform,
  Share,
  Keyboard,
  Modal
} from 'react-native';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import { launchImageLibrary } from 'react-native-image-picker';

import HandwritingCanvas from '../../components/handwriting/HandwritingCanvas';
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
import documentConversionService from '../../services/document/documentConversionService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * 统一文档查看器
 * 支持PPT/Word转PDF后查看，使用PDF查看器的界面布局
 */
const UnifiedDocumentViewer = ({ route, navigation }) => {
  const { uri, title, noteId, fileName, fromFileHistory, fileType } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfUri, setPdfUri] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionMessage, setConversionMessage] = useState('');
  const [originalFileInfo, setOriginalFileInfo] = useState(null);

  // PDF查看器完整功能状态
  const [showToolbar, setShowToolbar] = useState(true);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [showPageControl, setShowPageControl] = useState(false);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [showStylus, setShowStylus] = useState(false);
  const [images, setImages] = useState([]);
  const [handwritingStrokes, setHandwritingStrokes] = useState([]);
  const [stylusStrokes, setStylusStrokes] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 引用
  const pdfRef = useRef(null);
  const toolbarTimeoutRef = useRef(null);

  // 处理返回逻辑
  const handleGoBack = () => {
    if (fromFileHistory) {
      navigation.navigate('Home');
    } else {
      navigation.goBack();
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    loadDocument();
    
    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: fileType || 'document',
        fileName: fileName || title,
        noteId
      });
    }

    return () => {
      // 清理临时PDF文件
      if (pdfUri && pdfUri.startsWith('file://')) {
        const localPath = pdfUri.replace('file://', '');
        RNFS.unlink(localPath).catch(err => 
          console.warn('清理临时PDF文件失败:', err)
        );
      }
    };
  }, []);

  /**
   * 加载文档
   */
  const loadDocument = async () => {
    let timeoutId = null;
    let isComponentMounted = true;

    try {
      if (!isComponentMounted) return;

      setIsLoading(true);
      setError(null);
      setIsConverting(true);
      setConversionProgress(0);
      setConversionMessage('正在准备转换...');

      console.log('UnifiedDocumentViewer: 开始加载文档:', uri);
      console.log('UnifiedDocumentViewer: 文件类型:', fileType);

      // 设置超时处理
      timeoutId = setTimeout(() => {
        if (isComponentMounted) {
          setError('转换超时，请重试');
          setIsConverting(false);
          setIsLoading(false);
        }
      }, 90000); // 减少到90秒超时

      // 检查文件类型
      const extension = getFileExtension(fileName || uri);
      const needsConversion = ['ppt', 'pptx', 'doc', 'docx'].includes(extension);

      if (!needsConversion) {
        // 如果是PDF文件，直接显示
        if (timeoutId) clearTimeout(timeoutId);
        if (isComponentMounted) {
          setPdfUri(uri);
          setIsConverting(false);
          setIsLoading(false);
        }
        return;
      }

      // 检查后端服务状态
      if (isComponentMounted) {
        setConversionMessage('正在检查服务状态...');
      }

      const healthCheck = await documentConversionService.checkServiceHealth();
      if (!healthCheck.success) {
        throw new Error('文档转换服务不可用，请检查后端服务是否启动');
      }

      if (!isComponentMounted) return;

      console.log('UnifiedDocumentViewer: 后端服务正常，开始转换');

      // 使用Promise.race来确保超时控制
      const conversionPromise = documentConversionService.convertToPDF(uri, {
        method: 'upload', // 使用HTTP上传方式，更稳定
        onProgress: (progressInfo) => {
          if (isComponentMounted) {
            console.log('UnifiedDocumentViewer: 转换进度:', progressInfo);
            setConversionProgress(progressInfo.progress || 0);
            setConversionMessage(progressInfo.message || '正在处理...');
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('转换超时')), 90000);
      });

      const conversionResult = await Promise.race([conversionPromise, timeoutPromise]);

      // 清除超时
      if (timeoutId) clearTimeout(timeoutId);

      if (!isComponentMounted) return;

      if (!conversionResult.success) {
        throw new Error(conversionResult.error || '文档转换失败');
      }

      console.log('UnifiedDocumentViewer: 转换成功，保存PDF到本地');

      // 保存PDF到本地
      const pdfPath = await documentConversionService.savePDFToLocal(
        conversionResult.pdfBase64,
        fileName || 'document'
      );

      if (!isComponentMounted) return;

      // 设置PDF URI
      setPdfUri(`file://${pdfPath}`);
      setOriginalFileInfo(conversionResult.fileInfo);

      setIsConverting(false);
      setIsLoading(false);

      console.log('UnifiedDocumentViewer: 文档加载完成:', pdfPath);

    } catch (error) {
      console.error('UnifiedDocumentViewer: 加载文档失败:', error);

      // 清除超时
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (!isComponentMounted) return;

      setError(error.message);
      setIsConverting(false);
      setIsLoading(false);

      // 使用requestAnimationFrame来确保UI更新后再显示对话框
      requestAnimationFrame(() => {
        if (isComponentMounted) {
          Alert.alert(
            '加载失败',
            error.message,
            [
              { text: '重试', onPress: () => {
                if (isComponentMounted) loadDocument();
              }},
              { text: '返回', onPress: handleGoBack }
            ]
          );
        }
      });
    }

    // 清理函数
    return () => {
      isComponentMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  };

  /**
   * 获取文件扩展名
   */
  const getFileExtension = (fileName) => {
    if (!fileName) return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };

  /**
   * PDF加载完成
   */
  const onPdfLoadComplete = (numberOfPages, filePath) => {
    console.log('UnifiedDocumentViewer: PDF加载完成，页数:', numberOfPages);
    setTotalPages(numberOfPages);
    setCurrentPage(1);
    setIsLoading(false);
  };

  /**
   * PDF加载进度
   */
  const onPdfLoadProgress = (percent) => {
    console.log('UnifiedDocumentViewer: PDF加载进度:', percent);
  };

  /**
   * PDF加载错误
   */
  const onPdfError = (error) => {
    console.error('UnifiedDocumentViewer: PDF加载错误:', error);
    setError('PDF文件加载失败');
    setIsLoading(false);
  };

  /**
   * 页面变化
   */
  const onPageChanged = (page, numberOfPages) => {
    setCurrentPage(page);
    setTotalPages(numberOfPages);
  };

  /**
   * 缩放变化
   */
  const onScaleChanged = (scale) => {
    setScale(scale);
  };

  /**
   * 添加书签
   */
  const handleAddBookmark = async () => {
    try {
      await addBookmark({
        title: title || fileName || '文档',
        uri: uri,
        page: currentPage,
        noteId: noteId,
        type: fileType || 'document'
      });
      Alert.alert('成功', '书签已添加');
    } catch (error) {
      console.error('添加书签失败:', error);
      Alert.alert('错误', '添加书签失败');
    }
  };

  /**
   * 添加图片
   */
  const handleAddImage = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          const newImage = {
            id: Date.now().toString(),
            uri: response.assets[0].uri,
            x: screenWidth / 2 - 50,
            y: screenHeight / 2 - 50,
            width: 100,
            height: 100,
            page: currentPage,
          };
          setImages(prev => [...prev, newImage]);
          setHasUnsavedChanges(true);
          setShowSaveButton(true);
        }
      }
    );
  };

  /**
   * 切换手写模式
   */
  const toggleHandwriting = () => {
    setShowHandwriting(!showHandwriting);
    setShowStylus(false);
    if (!showHandwriting) {
      setIsEditMode(false);
    }
  };

  /**
   * 切换触控笔模式
   */
  const toggleStylus = () => {
    setShowStylus(!showStylus);
    setShowHandwriting(false);
    if (!showStylus) {
      setIsEditMode(false);
    }
  };

  /**
   * 保存文档
   */
  const handleSave = async () => {
    try {
      const saveData = {
        uri: pdfUri,
        images,
        handwritingStrokes,
        stylusStrokes,
        currentPage,
        scale,
        title: title || fileName || '文档',
        noteId
      };

      await SaveUtils.saveDocument(saveData);
      setHasUnsavedChanges(false);
      setShowSaveButton(false);
      Alert.alert('成功', '文档已保存');
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('错误', '保存失败');
    }
  };

  /**
   * 分享文档
   */
  const handleShare = async () => {
    try {
      if (pdfUri) {
        await Share.share({
          url: pdfUri,
          title: title || fileName || '文档',
        });
      }
    } catch (error) {
      console.error('分享失败:', error);
      Alert.alert('错误', '分享失败');
    }
  };

  /**
   * 自动隐藏工具栏
   */
  const autoHideToolbar = () => {
    if (toolbarTimeoutRef.current) {
      clearTimeout(toolbarTimeoutRef.current);
    }
    
    toolbarTimeoutRef.current = setTimeout(() => {
      setShowToolbar(false);
    }, 3000);
  };

  /**
   * 切换工具栏显示
   */
  const toggleToolbar = () => {
    setShowToolbar(!showToolbar);
    if (!showToolbar) {
      autoHideToolbar();
    }
  };

  // 渲染转换进度界面
  if (isConverting) {
    return (
      <ViewerLayout>
        <View style={styles.conversionContainer}>
          <View style={styles.conversionContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.conversionTitle, { color: colors.text }]}>
              正在转换文档
            </Text>
            <Text style={[styles.conversionMessage, { color: colors.textSecondary }]}>
              {conversionMessage}
            </Text>
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: colors.surface }]}>
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
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {conversionProgress.toFixed(0)}%
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.cancelButton, { borderColor: colors.outline }]}
              onPress={handleGoBack}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                取消
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ViewerLayout>
    );
  }

  // 渲染加载界面
  if (isLoading) {
    return (
      <ViewerLayout>
        <LoadingIndicator message="正在加载文档..." />
      </ViewerLayout>
    );
  }

  // 渲染错误界面
  if (error) {
    return (
      <ViewerLayout>
        <ErrorIndicator 
          message={error}
          onRetry={loadDocument}
          onBack={handleGoBack}
        />
      </ViewerLayout>
    );
  }

  return (
    <ViewerLayout>
      {/* PDF查看器 */}
      <TouchableOpacity 
        style={styles.pdfContainer} 
        activeOpacity={1}
        onPress={toggleToolbar}
      >
        {pdfUri && (
          <Pdf
            ref={pdfRef}
            source={{ uri: pdfUri }}
            style={styles.pdf}
            onLoadComplete={onPdfLoadComplete}
            onLoadProgress={onPdfLoadProgress}
            onError={onPdfError}
            onPageChanged={onPageChanged}
            onScaleChanged={onScaleChanged}
            enablePaging={true}
            enableRTL={false}
            enableAnnotationRendering={true}
            password=""
            spacing={0}
            minScale={0.5}
            maxScale={3.0}
            scale={scale}
            horizontal={false}
            page={currentPage}
            activityIndicator={
              <ActivityIndicator color={colors.primary} size="large" />
            }
            activityIndicatorProps={{
              color: colors.primary,
              progressTintColor: colors.primary,
            }}
          />
        )}
      </TouchableOpacity>

      {/* 工具栏 */}
      {showToolbar && (
        <ToolbarContainer>
          <AllInOneToolbar
            onBack={handleGoBack}
            onBookmark={handleAddBookmark}
            onPageControl={() => setShowPageControl(true)}
            onAddImage={handleAddImage}
            onHandwriting={toggleHandwriting}
            onStylus={toggleStylus}
            onShare={handleShare}
            showZoom={true}
            currentZoom={Math.round(scale * 100)}
            onZoomIn={() => pdfRef.current?.setNativeProps({ scale: Math.min(scale + 0.2, 3.0) })}
            onZoomOut={() => pdfRef.current?.setNativeProps({ scale: Math.max(scale - 0.2, 0.5) })}
            additionalInfo={originalFileInfo ? `原始格式: ${originalFileInfo.file_type?.toUpperCase()}` : null}
            isHandwritingActive={showHandwriting}
            isStylusActive={showStylus}
          />
        </ToolbarContainer>
      )}

      {/* 保存按钮 */}
      {showSaveButton && (
        <SaveButton
          onSave={handleSave}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      {/* 手写画布 */}
      {showHandwriting && (
        <HandwritingCanvas
          strokes={handwritingStrokes}
          onStrokesChange={(strokes) => {
            setHandwritingStrokes(strokes);
            setHasUnsavedChanges(true);
            setShowSaveButton(true);
          }}
          currentPage={currentPage}
          isVisible={showHandwriting}
        />
      )}

      {/* 全局触控笔覆盖层 */}
      {showStylus && (
        <GlobalStylusOverlay
          strokes={stylusStrokes}
          onStrokesChange={(strokes) => {
            setStylusStrokes(strokes);
            setHasUnsavedChanges(true);
            setShowSaveButton(true);
          }}
          currentPage={currentPage}
          isVisible={showStylus}
        />
      )}

      {/* 可拖拽图片 */}
      {images
        .filter(img => img.page === currentPage)
        .map((image, index) => (
          <DraggableImage
            key={image.id}
            image={image}
            isSelected={selectedImageIndex === index}
            onSelect={() => setSelectedImageIndex(index)}
            onDeselect={() => setSelectedImageIndex(null)}
            onUpdate={(updatedImage) => {
              const newImages = [...images];
              const globalIndex = images.findIndex(img => img.id === image.id);
              if (globalIndex !== -1) {
                newImages[globalIndex] = updatedImage;
                setImages(newImages);
                setHasUnsavedChanges(true);
                setShowSaveButton(true);
              }
            }}
            onDelete={() => {
              const newImages = images.filter(img => img.id !== image.id);
              setImages(newImages);
              setSelectedImageIndex(null);
              setHasUnsavedChanges(true);
              setShowSaveButton(true);
            }}
            isEditMode={isEditMode}
          />
        ))}

      {/* 文件历史导航 */}
      {fromFileHistory && (
        <FileHistoryNavigation
          onNavigate={(direction) => {
            // 实现文件历史导航逻辑
            console.log('导航方向:', direction);
          }}
        />
      )}

      {/* 页面控制 */}
      <Modal
        visible={showPageControl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPageControl(false)}
      >
        <PageControl
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            setCurrentPage(page);
            pdfRef.current?.setNativeProps({ page });
          }}
          onClose={() => setShowPageControl(false)}
        />
      </Modal>

      {/* 书签面板 */}
      <BookmarkPanel
        visible={showBookmarkPanel}
        onClose={() => setShowBookmarkPanel(false)}
        noteId={noteId}
        documentUri={uri}
        onBookmarkSelect={(bookmark) => {
          setCurrentPage(bookmark.page);
          pdfRef.current?.setNativeProps({ page: bookmark.page });
          setShowBookmarkPanel(false);
        }}
      />

      {/* 缩放指示器 */}
      <ZoomIndicator 
        visible={scale !== 1.0}
        zoom={Math.round(scale * 100)}
      />
    </ViewerLayout>
  );
};

const styles = StyleSheet.create({
  pdfContainer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
  },
  conversionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  conversionContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  conversionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  conversionMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
  },
});

export default UnifiedDocumentViewer;
