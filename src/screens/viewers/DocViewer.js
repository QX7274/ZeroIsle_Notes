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
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import RNFS from 'react-native-fs';
import { launchImageLibrary } from 'react-native-image-picker';
import documentConverter from '../../services/document/documentConverter';

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

      // 在后台异步进行文档转换
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

      // 使用react-native-doc-viewer
      const OpenFile = require('react-native-doc-viewer');

      await OpenFile.openDoc([{
        url: filePath,
        fileName: fileName || title || 'document.docx',
        cache: true,
        fileType: 'docx'
      }], (error, url) => {
        if (error) {
          console.error('打开外部应用失败:', error);
          Alert.alert(
            '无法打开文件',
            '请确保设备上安装了支持Word文档的应用（如Microsoft Word、WPS Office等）',
            [
              { text: '确定', style: 'default' }
            ]
          );
        } else {
          console.log('Word文档外部打开成功:', url);
        }
      });

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

        {/* PDF内容显示 */}
        {pdfSource && !error && (
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
        {pdfSource && !error && (
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
        {pdfSource && !error && totalPages > 0 && (
          <PageControl
            total={totalPages}
            current={currentPage}
            onPrev={() => {
              if (currentPage > 1) {
                const newPage = currentPage - 1;
                setCurrentPage(newPage);
                if (pdfRef.current) {
                  pdfRef.current.setPage(newPage);
                }
              }
            }}
            onNext={() => {
              if (currentPage < totalPages) {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
                if (pdfRef.current) {
                  pdfRef.current.setPage(newPage);
                }
              }
            }}
            onSubmitPage={(pageNum) => {
              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                setCurrentPage(pageNum);
                if (pdfRef.current) {
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
});

export default DocViewer;
