/**
 * PDF 查看器 - 原生实现版本
 * 
 * 核心特性：
 * - 原生 PDF 渲染（iOS: PDFKit, Android: PdfRenderer）
 * - 瓦片化渲染与预取
 * - 手写注释写入 PDF 文件
 * - 笔迹跟随缩放与滑动
 * - 统一手势与绘制管线
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  StatusBar,
  TouchableOpacity,
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  AppState,
} from 'react-native';

// 导入原生组件
const RNNativePDFView = requireNativeComponent('NativePDFView');
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';

// 导入原生工具栏桥接Hook
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import PageControl from '../../components/viewer/PageControl';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import fileHistoryService from '../../services/fileHistoryService';

const PDFViewerNative = ({ route, navigation }) => {
  const { uri, title, noteId, fromFileHistory } = route.params || {};
  const { colors } = useTheme();
  
  const [isLoading, setIsLoading] = useState(true); // 初始为true，显示加载指示器
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showPageControl, setShowPageControl] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const pdfViewRef = useRef(null);
  const zoomIndicatorTimeoutRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarProps = useNativeToolbarBridge(pdfViewRef, 'pdf', {
    currentPage,
  });
  
  useEffect(() => {
    console.log('[PDFViewerNative] 初始化原生 PDF 视图', { uri, noteId });
    if (uri) {
      loadPDF(uri);
    }
    
    // 添加到文件历史记录
    if (uri && title) {
      console.log('[PDFViewerNative] 添加到文件历史记录:', { uri, title, noteId });
      fileHistoryService.addFile({
        uri,
        title,
        type: 'pdf',
        fileName: title,
        noteId
      });
    }
  }, [uri, noteId]);
  
  // 隐藏Android系统导航栏，实现沉浸式全屏体验
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log('[PDFViewerNative] 隐藏Android系统导航栏');
      StatusBar.setHidden(true);
    }
    
    return () => {
      if (Platform.OS === 'android') {
        console.log('[PDFViewerNative] 恢复Android系统导航栏');
        StatusBar.setHidden(false);
      }
    };
  }, []);
  
  // ✅ 自动保存机制
  useEffect(() => {
    if (hasUnsavedChanges && noteId && pdfViewRef.current) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(() => {
        console.log('[PDFViewerNative] 自动保存触发...');
        handleSave().catch(err => console.error('自动保存失败:', err));
      }, 3000);
    }
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, noteId]);
  
  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && pdfViewRef.current && uri) {
        console.log('[PDFViewerNative] 组件卸载，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(pdfViewRef.current),
            '7', // exportPDF
            [`${uri}_annotated.pdf`]
          );
        } catch (err) {
          console.error('[PDFViewerNative] 卸载保存失败:', err);
        }
      }
    };
  }, [hasUnsavedChanges, uri]);
  
  // ✅ 监听屏幕焦点变化，失焦时保存数据
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      if (hasUnsavedChanges && pdfViewRef.current && uri) {
        console.log('[PDFViewerNative] 屏幕失去焦点，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(pdfViewRef.current),
            '7', // exportPDF
            [`${uri}_annotated.pdf`]
          );
        } catch (err) {
          console.error('[PDFViewerNative] 失焦保存失败:', err);
        }
      }
    });
    
    return () => {
      unsubscribeBlur();
    };
  }, [navigation, hasUnsavedChanges, uri]);
  
  // ✅ 监听应用状态变化，应用进入后台时保存数据
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'background' && hasUnsavedChanges && pdfViewRef.current && uri) {
        console.log('[PDFViewerNative] 应用进入后台，立即保存数据...');
        try {
          // 先保存PDF元数据（如果有noteId）
          if (noteId) {
            const realm = await realmService.getRealm();
            realm.write(() => {
              const note = realm.objectForPrimaryKey('Note', noteId);
              if (note) {
                Object.assign(note, {
                  pdfPath: uri,
                  updated_at: new Date().toISOString(),
                });
              }
            });
            
            // 然后保存PDF注释
            UIManager.dispatchViewManagerCommand(
              findNodeHandle(pdfViewRef.current),
              '7', // exportPDF 命令
              [`${uri}_annotated.pdf`]
            );
            console.log('[PDFViewerNative] 后台保存完成');
          } else {
            // 直接保存PDF注释
            UIManager.dispatchViewManagerCommand(
              findNodeHandle(pdfViewRef.current),
              '7', // exportPDF 命令
              [`${uri}_annotated.pdf`]
            );
            console.log('[PDFViewerNative] 后台保存完成');
          }
        } catch (err) {
          console.error('[PDFViewerNative] 后台保存失败:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [hasUnsavedChanges, uri, noteId]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
      }
    };
  }, []);
  
  const loadPDF = useCallback((pdfUri) => {
    // PDF会通过source prop自动加载
    console.log('[PDFViewerNative] PDF将通过source prop加载:', pdfUri);
  }, []);
  
  // 原生组件事件处理
  const handleReady = useCallback((event) => {
    const { totalPages } = event.nativeEvent;
    console.log('[PDFViewerNative] PDF 加载完成，总页数:', totalPages);
    setTotalPages(totalPages);
    setCurrentPage(1); // 初始页面为第1页（UI显示）
    setIsLoading(false);
  }, []);
  
  const handleError = useCallback((event) => {
    const { code, message } = event.nativeEvent;
    console.error('[PDFViewerNative] 错误:', code, message);
    
    let userMessage = 'PDF加载失败';
    let action = 'retry';
    let showRetryButton = true;
    
    if (message.includes('File not in PDF format') || 
        message.includes('corrupted') ||
        message.includes('cannot create document')) {
      userMessage = '文件格式错误，可能是转换失败导致的。请检查网络连接后重新导入此文档。';
      action = 'reimport';
      showRetryButton = false;
    } else if (message.includes('FILE_NOT_FOUND')) {
      userMessage = '文件不存在，可能已被删除或移动。请重新导入此文档。';
      action = 'reimport';
      showRetryButton = false;
    } else if (message.includes('LOAD_FAILED')) {
      userMessage = 'PDF加载失败，请检查文件是否完整。';
      action = 'retry';
    }
    
    setError({
      message: userMessage,
      action: action,
      showRetryButton: showRetryButton,
      originalError: message
    });
    setIsLoading(false);
  }, []);
  
  const handlePageChange = useCallback((event) => {
    const { page } = event.nativeEvent;
    console.log('[PDFViewerNative] 页面切换:', page);
    // page从原生来是0-based，UI显示需要1-based
    setCurrentPage(page + 1);
  }, []);
  
  const handleZoomChange = useCallback((event) => {
    const { zoom, isScaling } = event.nativeEvent;
    setZoomLevel(zoom);
    
    // 根据缩放状态控制指示器显示
    if (isScaling === true) {
      // 缩放开始或进行中，显示指示器
      setShowZoomIndicator(true);
      
      // 清除之前的隐藏定时器
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
        zoomIndicatorTimeoutRef.current = null;
      }
    } else if (isScaling === false) {
      // 缩放结束，立即显示最终比例，然后延迟隐藏
      setShowZoomIndicator(true);
      
      // 清除之前的隐藏定时器
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
      }
      
      // 设置新的隐藏定时器（1秒后自动隐藏，比之前更快）
      zoomIndicatorTimeoutRef.current = setTimeout(() => {
        setShowZoomIndicator(false);
        zoomIndicatorTimeoutRef.current = null;
      }, 1000);
    }
  }, []);
  
  const handlePageControlPress = useCallback((page) => {
    setCurrentPage(page);
    if (pdfViewRef.current) {
      // 调用原生方法跳转页面（命令ID: 1）
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(pdfViewRef.current),
          '1', // goToPage 命令
          [page]
        );
      } catch (err) {
        console.error('[PDFViewerNative] 跳转页面命令失败:', err);
      }
    }
  }, []);
  
  const handleStrokeCommitted = useCallback((event) => {
    const { strokeId } = event.nativeEvent;
    console.log('[PDFViewerNative] 笔迹已提交:', strokeId);
    
    // 标记有未保存的更改
    setHasUnsavedChanges(true);
    
    // 触发手写识别（命令ID: 5）
    if (pdfViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(pdfViewRef.current),
          '5', // recognizeHandwriting 命令
          [strokeId]
        );
      } catch (err) {
        console.error('[PDFViewerNative] 手写识别命令失败:', err);
      }
    }
  }, []);
  
  // 处理导出完成事件
  const handleExportComplete = useCallback(async (event) => {
    const { outputPath, success } = event.nativeEvent;
    
    if (!success) {
      console.error('[PDFViewerNative] 导出失败');
      return;
    }
    
    console.log('[PDFViewerNative] PDF导出成功:', outputPath);
    setHasUnsavedChanges(false);
  }, []);
  
  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText, confidence } = event.nativeEvent;
    console.log('[PDFViewerNative] 手写识别结果:', { strokeId, recognizedText, confidence });
    
    // 显示识别结果
    if (recognizedText && confidence > 0.7) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '添加注释', onPress: () => addTextAnnotation(recognizedText) }
      ]);
    }
  }, []);
  
  const addTextAnnotation = useCallback((text) => {
    // 将识别文本添加为PDF注释（命令ID: 6）
    if (pdfViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(pdfViewRef.current),
          '6', // addTextAnnotation 命令
          [text]
        );
      } catch (err) {
        console.error('[PDFViewerNative] 添加文本注释命令失败:', err);
      }
    }
  }, []);
  
  const handleGoBack = useCallback(() => {
    if (fromFileHistory) {
      navigation.navigate('Home');
    } else {
      navigation.goBack();
    }
  }, [fromFileHistory, navigation]);
  
  const handleSave = useCallback(async () => {
    console.log('[PDFViewerNative] 保存笔迹到 PDF...');
    try {
      if (!pdfViewRef.current || !uri) {
        throw new Error('PDF组件或URI无效');
      }

      // 先保存PDF元数据（如果有noteId）
      if (noteId) {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const note = realm.objectForPrimaryKey('Note', noteId);
          if (note) {
            Object.assign(note, {
              pdfPath: uri,
              updated_at: new Date().toISOString(),
            });
          }
        });
      }
      
      // 调用原生方法导出PDF（命令ID: 7）
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(pdfViewRef.current),
        '7', // exportPDF 命令
        [`${uri}_annotated.pdf`]
      );
      
      setHasUnsavedChanges(false);
      console.log('[PDFViewerNative] PDF保存成功');
      
      return { success: true };
    } catch (error) {
      console.error('[PDFViewerNative] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [uri, noteId]);
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ViewerLayout
        colors={colors}
        headerLeft={
          <BackButton
            onPress={handleGoBack}
            color={colors.primary}
            background={colors.primary + '20'}
          />
        }
        headerRight={
          <SaveButton
            onSave={handleSave}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
            style={styles.saveButton}
          />
        }
        title={title || 'PDF 查看器（原生）'}
        showExternalToolbar={true}
        toolbarProps={{
          ...toolbarProps,
          currentPage: currentPage,
        }}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
      >
        {/* 始终渲染原生组件 - 修复循环依赖死锁 */}
        <RNNativePDFView
          ref={pdfViewRef}
          style={styles.pdfView}
          source={{ path: uri?.replace('file://', ''), uri }}
          initialPage={0}
          currentTool={toolbarProps.currentTool}
          currentColor={toolbarProps.currentColor}
          currentStrokeWidth={toolbarProps.currentStrokeWidth}
          onReady={handleReady}
          onError={handleError}
          onPageChange={handlePageChange}
          onZoomChange={handleZoomChange}
          onStrokeCommitted={handleStrokeCommitted}
          onHandwritingRecognized={handleHandwritingRecognized}
          onExportComplete={handleExportComplete}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            console.log('[PDFViewerNative] 原生组件 onLayout:', width, 'x', height);
          }}
        />
        
        {/* 加载覆盖层 - 绝对定位，zIndex 确保在上层 */}
        {isLoading && (
          <View style={[StyleSheet.absoluteFill, { 
            backgroundColor: colors.background, 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 999 
          }]}>
            <LoadingIndicator message="加载 PDF 文档..." />
          </View>
        )}
        
        {/* 错误覆盖层 - 绝对定位，zIndex 确保在上层 */}
        {error && (
          <View style={[StyleSheet.absoluteFill, { 
            backgroundColor: colors.background, 
            justifyContent: 'center', 
            alignItems: 'center', 
            padding: 20,
            zIndex: 999 
          }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {typeof error === 'string' ? error : error.message}
            </Text>
            {typeof error === 'object' && error.action === 'reimport' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => {
                  // 导航回主页重新导入
                  navigation.navigate('Home');
                }}
              >
                <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>
                  重新导入文档
                </Text>
              </TouchableOpacity>
            )}
            {typeof error === 'object' && error.showRetryButton && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.secondary, marginTop: 16 }]}
                onPress={() => {
                  // 重试加载PDF
                  setError(null);
                  setIsLoading(true);
                  if (uri) {
                    loadPDF(uri);
                  }
                }}
              >
                <Text style={[styles.actionButtonText, { color: colors.onSecondary }]}>
                  重试
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ViewerLayout>
      
      {/* 页码控制器 - 在ViewerLayout外部 */}
      {!isLoading && !error && totalPages > 1 && (
        <PageControl
          total={totalPages}
          current={currentPage}
          onPrev={() => {
            if (currentPage > 1) {
              const newPage = currentPage - 1;
              setCurrentPage(newPage);
              if (pdfViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(pdfViewRef.current),
                  '1', // goToPage
                  [newPage - 1] // 转换为0-based
                );
              }
            }
          }}
          onNext={() => {
            if (currentPage < totalPages) {
              const newPage = currentPage + 1;
              setCurrentPage(newPage);
              if (pdfViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(pdfViewRef.current),
                  '1', // goToPage
                  [newPage - 1] // 转换为0-based
                );
              }
            }
          }}
          onSubmitPage={(pageNum) => {
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              setCurrentPage(pageNum);
              if (pdfViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(pdfViewRef.current),
                  '1', // goToPage
                  [pageNum - 1] // 转换为0-based
                );
              }
            }
          }}
          storageKey="native_pdf_pagecontrol_pos"
        />
      )}
      
      {/* 缩放指示器 - 在ViewerLayout外部，仅在缩放操作时显示 */}
      {!isLoading && !error && (
        <ZoomIndicator
          scale={zoomLevel}
          visible={showZoomIndicator}
          autoHideDelay={1000}
          topOffset={60}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pdfView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
});

export default PDFViewerNative;

