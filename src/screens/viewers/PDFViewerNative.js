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
import { NativeModules } from 'react-native';

// 导入原生组件
const RNNativePDFView = requireNativeComponent('NativePDFView');
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';
import permanentStorageBridge from '../../native/permanentStorageBridge';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import { addSnippet } from '../../services/kbSnippetStore';
import noteService from '../../services/notes/noteService';

// 导入原生工具栏桥接Hook
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import PageControl from '../../components/viewer/PageControl';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import fileHistoryService from '../../services/fileHistoryService';
import { useAutoSaveOnExit } from '../../hooks/useAutoSaveOnExit';
import pdfTextExtractionService from '../../services/document/pdfTextExtractionService';


const PDF_VIEW_COMMANDS = {
  GO_TO_PAGE: '1',
  RECOGNIZE_HANDWRITING: '5',
  ADD_TEXT_ANNOTATION: '6',
  EXPORT_PDF: '7',
};

const PDFViewerNative = ({ route, navigation }) => {
  const { uri, title, noteId, fromFileHistory, fileType } = route.params || {};
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true); // 初始为true，显示加载指示器
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showPageControl, setShowPageControl] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [convertedPdfUri, setConvertedPdfUri] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  // 最近一次笔迹ID（用于手动触发手写识别）
  const [lastStrokeId, setLastStrokeId] = useState(null);
  const [toolbarHistoryState, setToolbarHistoryState] = useState({ canUndo: false, canRedo: false });

  const pdfViewRef = useRef(null);
  const zoomIndicatorTimeoutRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const hasLoggedRealmUnavailableRef = useRef(false);

  const getWritableRealmOrThrow = useCallback(async () => {
    if (realmService?.realmOpenFailed || !realmService?.canUseRealmForWrites?.()) {
      if (!hasLoggedRealmUnavailableRef.current) {
        hasLoggedRealmUnavailableRef.current = true;
        console.error('[PDFViewerNative] Realm 不可用，已短路保存流程（仅提示一次）', {
          reason: realmService?.realmOpenFailureReason || 'Realm not ready/closed',
          noteId,
          uri,
        });
      }
      const err = new Error('Realm 不可用，已跳过保存');
      err.code = 'REALM_UNAVAILABLE';
      throw err;
    }
    return await realmService.getRealm();
  }, [noteId, uri]);

  // 区域选择相关状态
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const selectionStartRef = useRef(null);
  const pendingOCRResolverRef = useRef(null);

  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarPropsBase = useNativeToolbarBridge(pdfViewRef, 'pdf', {
    currentPage,
    historyState: toolbarHistoryState,
    onHistoryStateChange: setToolbarHistoryState,
  });

  useEffect(() => {
    console.log('[PDFViewerNative] 初始化原生 PDF 视图', { uri, noteId, fileType });
    if (uri) {
      checkAndLoadFile(uri);
    }

    // 添加到文件历史记录
    if (uri && title) {
      console.log('[PDFViewerNative] 添加到文件历史记录:', { uri, title, noteId });
      fileHistoryService.addFile({
        uri,
        title,
        type: fileType || 'pdf',
        fileName: title,
        noteId,
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
            PDF_VIEW_COMMANDS.EXPORT_PDF,
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
            PDF_VIEW_COMMANDS.EXPORT_PDF,
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
          // 保存PDF状态和注释
          if (noteId) {
            const realm = await getWritableRealmOrThrow();
            realm.write(() => {
              const note = realm.objectForPrimaryKey('Note', noteId);
              if (note) {
                Object.assign(note, {
                  pdfPath: uri,
                  pdfCurrentPage: currentPage,
                  pdfTotalPages: totalPages,
                  pdfScale: zoomLevel,
                  updated_at: new Date().toISOString(),
                });
              }
            });
          }

          // 导出PDF注释数据（命令ID: 7）
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(pdfViewRef.current),
            PDF_VIEW_COMMANDS.EXPORT_PDF,
            [noteId || uri]
          );
          console.log('[PDFViewerNative] 后台保存完成');
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

  /**
   * 检查文件类型并加载或转换
   */
  const checkAndLoadFile = useCallback(async (fileUri) => {
    try {
      console.log('[PDFViewerNative] 检查文件类型:', fileUri);

      // 检查是否是需要转换的文件类型
      const needsConversion = fileType === 'ppt' || fileUri.toLowerCase().endsWith('.ppt') || fileUri.toLowerCase().endsWith('.pptx') ||
                              fileUri.toLowerCase().endsWith('.doc') || fileUri.toLowerCase().endsWith('.docx');

      if (needsConversion) {
        console.log('[PDFViewerNative] 检测到需要转换的文件，检查是否已有PDF版本');

        // 检查数据库中是否已有转换后的PDF路径
        if (noteId) {
          const realm = await getWritableRealmOrThrow();
          const note = realm.objectForPrimaryKey('Note', noteId);

          if (note) {
            // 尝试解析metadata
            let metadata = null;
            try {
              metadata = note.metadata ? JSON.parse(note.metadata) : null;
            } catch (e) {
              console.warn('[PDFViewerNative] 解析metadata失败:', e);
            }

            // 检查是否有转换后的PDF路径
            const pdfPath = metadata?.pdfPath || note.pdfPath;

            if (pdfPath) {
              console.log('[PDFViewerNative] 找到转换后的PDF:', pdfPath);
              // 检查文件是否存在
              const RNFS = require('react-native-fs');
              const exists = await RNFS.exists(pdfPath);

              if (exists) {
                console.log('[PDFViewerNative] PDF文件存在，直接加载');
                setConvertedPdfUri(pdfPath);
                loadPDF(pdfPath);
                return;
              } else {
                console.log('[PDFViewerNative] PDF文件不存在，需要重新转换');
              }
            }
          }
        }

        // 如果没有转换后的PDF，提示用户需要在线转换
        console.log('[PDFViewerNative] 需要转换文件为PDF');
        setError({
          message: `此${fileType === 'ppt' ? 'PPT' : 'Word'}文件需要转换为PDF才能查看。\n\n请确保设备已连接网络，点击"开始转换"按钮进行转换。`,
          action: 'convert',
          showRetryButton: false,
          showConvertButton: true,
          originalFile: fileUri,
        });
        setIsLoading(false);
      } else {
        // 直接加载PDF文件
        console.log('[PDFViewerNative] 直接加载PDF文件');
        loadPDF(fileUri);
      }
    } catch (error) {
      console.error('[PDFViewerNative] 检查文件失败:', error);
      setError({
        message: '文件检查失败，请重试',
        action: 'retry',
        showRetryButton: true,
      });
      setIsLoading(false);
    }
  }, [fileType, noteId]);

  /**
   * 转换文件为PDF
   */
  const convertFileToPDF = useCallback(async () => {
    try {
      setIsConverting(true);
      setConversionProgress(0);
      setError(null);

      console.log('[PDFViewerNative] 开始转换文件:', uri);

      // 动态导入转换服务和文件系统
      const documentConversionService = require('../../services/document/documentConversionService').default;
      const RNFS = require('react-native-fs');

      // 执行转换
      const result = await documentConversionService.convertToPDFNonBlocking(uri, {
        onProgress: (progress) => {
          console.log('[PDFViewerNative] 转换进度:', progress);
          setConversionProgress(progress.progress || 0);
        },
      });

      if (result && result.success && result.pdfBase64) {
        console.log('[PDFViewerNative] 转换成功，保存PDF文件');

        // 生成PDF文件路径
        const fileName = title || 'converted_document';
        const pdfFileName = `${fileName}_${Date.now()}.pdf`;
        const pdfPath = `${RNFS.DocumentDirectoryPath}/${pdfFileName}`;

        // 将Base64数据保存为文件
        await RNFS.writeFile(pdfPath, result.pdfBase64, 'base64');
        console.log('[PDFViewerNative] PDF文件已保存:', pdfPath);

        // 更新数据库中的PDF路径
        if (noteId) {
          const realm = await getWritableRealmOrThrow();
          await realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              // 更新pdfPath
              note.pdfPath = pdfPath;

              // 更新metadata
              let metadata = {};
              try {
                metadata = note.metadata ? JSON.parse(note.metadata) : {};
              } catch (e) {
                console.warn('[PDFViewerNative] 解析metadata失败:', e);
              }

              metadata.pdfPath = pdfPath;
              metadata.requiresConversion = false;
              metadata.conversionStatus = 'completed';
              metadata.conversionTime = new Date().toISOString();
              metadata.pageCount = result.fileInfo?.pages || null;

              note.metadata = JSON.stringify(metadata);
              note.updated_at = new Date().toISOString();

              console.log('[PDFViewerNative] 数据库已更新PDF路径');
            }
          });
        }

        // 加载转换后的PDF
        setConvertedPdfUri(pdfPath);
        setIsConverting(false);
        loadPDF(pdfPath);
      } else {
        throw new Error(result?.error || '转换失败，未返回PDF数据');
      }
    } catch (error) {
      console.error('[PDFViewerNative] 转换失败:', error);
      setIsConverting(false);
      setError({
        message: `文件转换失败: ${error.message}\n\n请检查网络连接后重试。`,
        action: 'convert',
        showRetryButton: false,
        showConvertButton: true,
        originalFile: uri,
      });
    }
  }, [uri, noteId, title]);

  const loadPDF = useCallback(async (pdfUri) => {
    try {
      console.log('[PDFViewerNative] 开始加载PDF:', pdfUri);

      // ✅ 简化loadPDF：只记录信息，数据导入由handleReady处理
      if (noteId) {
        const realm = await getWritableRealmOrThrow();
        const note = realm.objectForPrimaryKey('Note', noteId);

        console.log('🔍 [PDFViewerNative] 查找保存的 Note:', noteId, '找到:', !!note);

        if (note) {
          console.log('📖 [PDFViewerNative] PDF阅读状态信息:', {
            savedCurrentPage: note.pdfCurrentPage,
            savedTotalPages: note.pdfTotalPages,
            savedScale: note.pdfScale,
            pdfPath: note.pdfPath,
            hasAnnotations: !!note.pdfAnnotations,
            annotationsLength: note.pdfAnnotations?.length || 0,
          });
          console.log('ℹ️ [PDFViewerNative] 数据将在handleReady中导入');
        }
      }
    } catch (error) {
      console.error('[PDFViewerNative] 加载PDF状态失败:', error);
    }
  }, [noteId]);

  // 原生组件事件处理
  const handleReady = useCallback(async (event) => {
    const { totalPages: loadedTotalPages } = event.nativeEvent;
    console.log('[PDFViewerNative] PDF 加载完成，总页数:', loadedTotalPages);

    // ⚠️ 先更新状态
    setTotalPages(loadedTotalPages);
    setCurrentPage(1); // 初始页面为第1页（UI显示）
    setIsLoading(false);

    // 如果有目标页，先跳转
    try {
      const targetPage = route?.params?.targetPage;
      if (typeof targetPage === 'number' && targetPage >= 1 && pdfViewRef.current) {
        const nodeHandle = findNodeHandle(pdfViewRef.current);
        UIManager.dispatchViewManagerCommand(
          nodeHandle,
          PDF_VIEW_COMMANDS.GO_TO_PAGE,
          [targetPage - 1]
        );
        setCurrentPage(targetPage);
      }
    } catch (e) {
      console.warn('[PDFViewerNative] 跳转目标页失败:', e);
    }

    // ✅ 在 PDF 加载完成后导入注释（稍作延迟确保原生组件完全就绪）
    if (noteId && pdfViewRef.current && loadedTotalPages > 0) {
      console.log('🚀 [PDFViewerNative] PDF加载完成，准备导入注释数据，总页数:', loadedTotalPages);

      // 等待一小段时间确保原生组件完全初始化和状态更新
      await new Promise(resolve => setTimeout(resolve, 200));

      try {
        const realm = await getWritableRealmOrThrow();
        const note = realm.objectForPrimaryKey('Note', noteId);

        if (note && note.pdfAnnotations) {
          console.log('📥 [PDFViewerNative] 找到保存的注释，开始导入');
          console.log('🔍 [PDFViewerNative] 原始注释数据长度:', note.pdfAnnotations.length);

          const rawAnnotations = JSON.parse(note.pdfAnnotations);
          console.log('🔍 [PDFViewerNative] 解析后的注释数据:', {
            isArray: Array.isArray(rawAnnotations),
            hasPages: !!rawAnnotations.pages,
            pagesCount: rawAnnotations.pages?.length || 0,
            totalPages: rawAnnotations.totalPages,
          });

          // ✅ 检测数据格式并转换
          let annotations;
          if (Array.isArray(rawAnnotations)) {
            console.log('🔄 [PDFViewerNative] 检测到旧格式数据，正在转换...');
            annotations = convertOldFormatToNew(rawAnnotations, totalPages);
          } else if (rawAnnotations.pages) {
            annotations = rawAnnotations;
            if (!annotations.totalPages || annotations.totalPages === 0) {
              annotations.totalPages = totalPages;
            }
          } else {
            console.warn('⚠️ [PDFViewerNative] 未知的数据格式');
            return;
          }

          // 🔍 打印详细的笔迹信息
          if (annotations.pages && annotations.pages.length > 0) {
            console.log('🔍 [PDFViewerNative] 准备导入的注释详情:');
            annotations.pages.forEach((page, idx) => {
              console.log(`  页面 ${page.page}: ${page.strokes?.length || 0} 条笔迹`);
              if (page.strokes && page.strokes.length > 0 && idx === 0) {
                // 打印第一页第一条笔迹的详细信息
                console.log('  第一条笔迹示例:', {
                  id: page.strokes[0].id,
                  hasPathData: !!page.strokes[0].pathData,
                  pathDataLength: page.strokes[0].pathData?.length || 0,
                  color: page.strokes[0].color,
                  strokeWidth: page.strokes[0].strokeWidth,
                });
              }
            });
          }

          const annotationsStr = JSON.stringify(annotations);
          console.log('🔍 [PDFViewerNative] 序列化后的注释数据长度:', annotationsStr.length);

          const nodeHandle = findNodeHandle(pdfViewRef.current);
          console.log('🔍 [PDFViewerNative] nodeHandle:', nodeHandle, 'pdfViewRef.current:', !!pdfViewRef.current);

          if (nodeHandle) {
            console.log('🚀 [PDFViewerNative] 准备发送命令 - nodeHandle:', nodeHandle, '命令ID: 8, 数据长度:', annotationsStr.length);

            try {
              UIManager.dispatchViewManagerCommand(
                nodeHandle,
                UIManager.getViewManagerConfig('NativePDFView').Commands.importAnnotations,
                [annotationsStr]
              );
              console.log('✅ [PDFViewerNative] 注释数据已通过getViewManagerConfig发送');
            } catch (e) {
              console.error('❌ [PDFViewerNative] getViewManagerConfig失败，尝试直接使用命令ID', e);
              // Fallback: 直接使用命令ID
              UIManager.dispatchViewManagerCommand(
                nodeHandle,
                8,
                [annotationsStr]
              );
              console.log('✅ [PDFViewerNative] 注释数据已通过直接命令ID发送');
            }
          } else {
            console.error('❌ [PDFViewerNative] 无法找到原生组件的nodeHandle！');
            console.error('  pdfViewRef.current:', pdfViewRef.current);
          }

          // 恢复页码
          if (note.pdfCurrentPage !== undefined && note.pdfCurrentPage > 0) {
            UIManager.dispatchViewManagerCommand(
              nodeHandle,
              PDF_VIEW_COMMANDS.GO_TO_PAGE,
              [note.pdfCurrentPage - 1]
            );
            setCurrentPage(note.pdfCurrentPage);
          }

          // 恢复缩放级别
          if (note.pdfScale !== undefined && note.pdfScale > 0) {
            setZoomLevel(note.pdfScale);
        }
      }
    } catch (error) {
        console.error('[PDFViewerNative] 导入注释失败:', error);
      }
    }
  }, [noteId]);

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
      originalError: message,
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
    const nativeEvent = event?.nativeEvent || {};
    const zoom = typeof nativeEvent.zoom === 'number'
      ? nativeEvent.zoom
      : (typeof nativeEvent.scale === 'number' ? nativeEvent.scale : 1.0);
    const isScaling = nativeEvent.isScaling === true;

    setZoomLevel(zoom);
    setShowZoomIndicator(true);

    if (zoomIndicatorTimeoutRef.current) {
      clearTimeout(zoomIndicatorTimeoutRef.current);
      zoomIndicatorTimeoutRef.current = null;
    }

    if (!isScaling) {
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
          PDF_VIEW_COMMANDS.GO_TO_PAGE,
          [page]
        );
      } catch (err) {
        console.error('[PDFViewerNative] 跳转页面命令失败:', err);
      }
    }
  }, []);

  // 原生事件驱动：同步撤销/重做可用状态
  const handleHistoryStateChange = useCallback((event) => {
    const state = event?.nativeEvent || event || {};

    setToolbarHistoryState((prev) => {
      const canUndo = typeof state.canUndo === 'boolean' ? state.canUndo : prev.canUndo;
      const canRedo = typeof state.canRedo === 'boolean' ? state.canRedo : prev.canRedo;

      if (canUndo === prev.canUndo && canRedo === prev.canRedo) {
        return prev;
      }

      return { canUndo, canRedo };
    });
  }, []);

  const handleStrokeCommitted = useCallback(async (event) => {
    const strokeData = event.nativeEvent;
    console.log('🖊️ [PDFViewerNative] 笔迹已提交:', strokeData.strokeId);
    setLastStrokeId(strokeData.strokeId); // 保存最近的笔迹ID
    console.log('🔍 [PDFViewerNative] 笔迹数据详情:', {
      hasPathData: !!strokeData.pathData,
      pathDataLength: strokeData.pathData?.length || 0,
      color: strokeData.color,
      strokeWidth: strokeData.strokeWidth,
      currentPage,
      totalPages,
    });

    // ✅ 双重保存策略：立即保存到数据库（不依赖原生回调）
    if (noteId && strokeData) {
      // ⚠️ 如果totalPages还是0，说明PDF还没完全加载好，暂不保存
      if (totalPages === 0) {
        console.warn('⚠️ [实时保存] PDF总页数为0，可能还未加载完成，跳过保存');
        return;
      }

      try {
        // ✅ 修复：在函数开始就转换为0-based索引
        const pageIndex = currentPage - 1;  // 转换为0-based索引，与原生端一致

        const realm = await getWritableRealmOrThrow();
        await realm.write(() => {
          const note = realm.objectForPrimaryKey('Note', noteId);
          if (note) {
            console.log('💾 [实时保存] 找到 Note 记录，立即保存笔迹数据');
            // 获取现有的注释数据（格式：{totalPages, pages:[{page, strokes:[]}]}）
            let annotationsObj = { totalPages: totalPages, pages: [] };
            if (note.pdfAnnotations) {
              try {
                annotationsObj = JSON.parse(note.pdfAnnotations);
                // 确保 pages 数组存在
                if (!annotationsObj.pages) {
                  annotationsObj.pages = [];
                }
              } catch (e) {
                console.warn('[PDFViewerNative] 解析现有注释失败，创建新结构');
              }
            }

          // ✅ 找到或创建当前页面的笔迹数组（使用0-based索引）
          let pageData = annotationsObj.pages.find(p => p.page === pageIndex);
          if (!pageData) {
            pageData = { page: pageIndex, strokes: [] };  // 使用0-based索引
            annotationsObj.pages.push(pageData);
          }

            // 添加新的笔迹到当前页面（完整保存原生端返回的所有数据）
            pageData.strokes.push({
              id: strokeData.strokeId,
              strokeId: strokeData.strokeId,
              pathData: strokeData.pathData || '',
              color: strokeData.color || 0xFF000000,
              strokeWidth: strokeData.strokeWidth || 2.0,
              alpha: strokeData.alpha || 255,
              toolType: strokeData.toolType || 'pen',
              timestamp: new Date().getTime(),
              ...strokeData, // 保存原生端返回的完整数据
            });

            // 更新 totalPages
            annotationsObj.totalPages = totalPages;

            // 保存更新后的注释数据
            note.pdfAnnotations = JSON.stringify(annotationsObj);
            note.updated_at = new Date();

            console.log('✅ [实时保存] 笔迹已立即保存，页面', currentPage, '总笔迹:', pageData.strokes.length);
          } else {
            console.warn('⚠️ [实时保存] Note 不存在，创建新记录');
            // 如果不存在，创建新记录（使用0-based索引和'modified'模式）
            realm.create('Note', {
              _id: noteId,
              title: title || 'PDF文档',
              type: 'pdf',
              file_type: 'pdf',
              pdfPath: uri,
              pdfAnnotations: JSON.stringify({
                totalPages: totalPages,
                pages: [{
                  page: pageIndex,  // ✅ 使用0-based索引
                  strokes: [{
                    id: strokeData.strokeId,
                    strokeId: strokeData.strokeId,
                    pathData: strokeData.pathData || '',
                    color: strokeData.color || 0xFF000000,
                    strokeWidth: strokeData.strokeWidth || 2.0,
                    alpha: strokeData.alpha || 255,
                    toolType: strokeData.toolType || 'pen',
                    timestamp: new Date().getTime(),
                    ...strokeData,
                  }],
                }],
              }),
              created_at: new Date(),
              updated_at: new Date(),
            }, 'modified');
            console.log('✅ [实时保存] 新Note记录已创建并保存笔迹');
          }
        });

        // 验证写入是否成功
        const verifyNote = realm.objectForPrimaryKey('Note', noteId);
        if (verifyNote && verifyNote.pdfAnnotations) {
          const verifyData = JSON.parse(verifyNote.pdfAnnotations);
          console.log('✅ [实时保存] 验证成功:', {
            noteId: verifyNote._id,
            hasPdfAnnotations: true,
            pdfAnnotationsLength: verifyNote.pdfAnnotations.length,
            // ✅ 验证页面索引是否正确（应该是0-based）
            pageIndices: verifyData.pages?.map(p => p.page),
            currentPageIndex: pageIndex,
            expectedIndex: currentPage - 1,
          });
        }
      } catch (error) {
        console.error('❌ [实时保存] 保存笔迹失败:', error);
        console.error('错误详情:', error.stack);
      }
    }

    // 标记有未保存的更改（用于触发导出）
    setHasUnsavedChanges(true);

    toolbarPropsBase.scheduleRecognition({
      selection: 'latest',
      scope: 'latest',
      strokeId: strokeData.strokeId,
      count: 1,
      documentPage: currentPage,
    });
  }, [noteId, currentPage, totalPages, uri, title, toolbarPropsBase]);

/**
 * 将旧格式数组转换为新格式对象
 * 旧格式: [{id, page, type, data, timestamp}, ...]
 * 新格式: {totalPages, pages: [{page, strokes: [{id, pathData, color, strokeWidth, alpha, toolType}]}]}
 */
const convertOldFormatToNew = (oldFormatArray, totalPages) => {
  console.log('🔄 [PDFViewerNative] 开始转换旧格式数据，笔迹数:', oldFormatArray.length);

  const pagesMap = new Map();

  oldFormatArray.forEach(item => {
    if (item.type === 'stroke' && item.data) {
      const pageIndex = item.page || 0;

      if (!pagesMap.has(pageIndex)) {
        pagesMap.set(pageIndex, []);
      }

      // 转换笔迹数据格式
      const strokeData = {
        id: item.id,
        toolType: item.data.toolType || 'pen',
        color: item.data.color || 0xFF000000, // 黑色 (ARGB)
        strokeWidth: item.data.strokeWidth || 2.0,
        alpha: item.data.alpha || 255,
        pathData: item.data.pathData || '', // 原生端提供的路径数据
      };

      pagesMap.get(pageIndex).push(strokeData);
    }
  });

  // 构建新格式
  const newFormat = {
    totalPages: totalPages || 101, // 确保有默认值
    pages: [],
  };

  pagesMap.forEach((strokes, pageIndex) => {
    newFormat.pages.push({
      page: pageIndex,
      strokes: strokes,
    });
  });

  console.log('✅ [PDFViewerNative] 格式转换完成:', {
    totalPages: newFormat.totalPages,
    pagesCount: newFormat.pages.length,
    totalStrokes: newFormat.pages.reduce((sum, p) => sum + p.strokes.length, 0),
  });

  return newFormat;
};

  // 处理导出完成事件 - 保存PDF注释数据
  const handleExportComplete = useCallback(async (event) => {
    const { outputPath, annotationsData, success } = event.nativeEvent;

    if (!success) {
      console.error('[PDFViewerNative] 导出失败');
      return;
    }

    try {
      console.log('[PDFViewerNative] PDF导出成功，保存注释数据...', {
        outputPath,
        hasAnnotations: !!annotationsData,
        annotationsDataType: typeof annotationsData,
        annotationsDataLength: annotationsData?.length || 0,
        currentPage,
        zoomLevel,
        noteId,
      });

      // 如果没有noteId，需要创建一个Note记录
      if (!noteId) {
        console.warn('[PDFViewerNative] 没有noteId，无法保存PDF注释数据');
        // 可以考虑创建一个新的Note记录，但这里先警告
        return;
      }

      // 保存到数据库
      const realm = await getWritableRealmOrThrow();

      // 🔍 验证 Schema 是否包含 pdfAnnotations 字段
      const schema = realm.schema.find(s => s.name === 'Note');
      const hasPdfAnnotations = schema && 'pdfAnnotations' in schema.properties;
      console.log('🔍 [PDFViewerNative] Schema 检查 - 是否有 pdfAnnotations 字段:', hasPdfAnnotations);
      if (!hasPdfAnnotations) {
        console.error('❌❌❌ [PDFViewerNative] Schema 中没有 pdfAnnotations 字段！需要完全重启应用！');
      }

      realm.write(() => {
        let note = realm.objectForPrimaryKey('Note', noteId);

        // 如果note不存在，创建一个新的
        if (!note) {
          console.log('[PDFViewerNative] Note不存在，创建新的Note记录');
          note = realm.create('Note', {
            _id: noteId,
            title: title || 'PDF文档',
            type: 'pdf',
            file_type: 'pdf',
            pdfPath: uri,
            created_at: new Date(),
            updated_at: new Date(),
          }, 'modified');
        }

        // ✅ annotationsData从Java端已经是JSON字符串，不需要再stringify
        const annotationsStr = typeof annotationsData === 'string'
          ? annotationsData
          : JSON.stringify(annotationsData);

        Object.assign(note, {
          pdfPath: uri,
          pdfCurrentPage: currentPage,
          pdfTotalPages: totalPages,
          pdfScale: zoomLevel,
          pdfAnnotations: annotationsStr,
          updated_at: new Date(),
        });

        console.log('✅✅✅ [PDFViewerNative] PDF状态已保存到数据库', {
          noteId,
          currentPage: note.pdfCurrentPage,
          totalPages: note.pdfTotalPages,
          hasAnnotations: !!note.pdfAnnotations,
          annotationsLength: note.pdfAnnotations?.length || 0,
        });

        // 🔍 立即读取验证
        const verification = realm.objectForPrimaryKey('Note', noteId);
        console.log('🔍 [PDFViewerNative] 保存后立即验证:', {
          noteExists: !!verification,
          annotationsLength: verification?.pdfAnnotations?.length || 0,
        });
      });

      setHasUnsavedChanges(false);
      console.log('[PDFViewerNative] PDF注释数据保存完成');

      // 同步写入原生永久存储（PDF注释与状态）
      try {
        await permanentStorageBridge.updateNote(noteId, {
          type: 'pdf',
          pdfPath: uri,
          annotations: annotationsData,
          currentPage,
          totalPages,
          zoomLevel,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('[PDFViewerNative] 原生永久存储更新失败，将继续使用本地数据库', e?.message || e);
      }
    } catch (error) {
      console.error('[PDFViewerNative] 保存PDF注释数据失败:', error);
      console.error('[PDFViewerNative] 错误堆栈:', error.stack);
    }
  }, [noteId, uri, currentPage, totalPages, zoomLevel, title]);

  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText: legacyText, text, confidence, scope } = event.nativeEvent;
    const recognizedText = typeof text === 'string' && text.length > 0 ? text : legacyText;
    console.log('[PDFViewerNative] 手写识别结果:', { strokeId, recognizedText, confidence, scope });

    // 显示识别结果
    if (recognizedText) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '创建笔记', onPress: async () => {
            try {
              const noteTitle = `来自 ${title || 'PDF'} 的笔记`;
              const noteContent = `> 来源: ${title || 'PDF'} (第 ${currentPage} 页)\n\n${recognizedText}`;
              const newNote = await noteService.createNote({
                title: noteTitle,
                content: noteContent,
                type: 'markdown',
              });
              Alert.alert('创建成功', '已为您创建新的Markdown笔记。', [
                { text: '好的' },
                { text: '查看笔记', onPress: () => navigation.navigate('NoteEditor', { noteId: newNote._id }) },
              ]);
            } catch (e) {
              Alert.alert('失败', '创建笔记失败');
            }
          },
        },
        { text: '保存为片段', onPress: async () => {
            try {
              const kbId = (route.params && route.params.kbId) ? route.params.kbId : 'personal';
              const anchor = `#p${currentPage}`;
              await addSnippet(kbId, { text: recognizedText, source: { type: 'pdf', title: title || 'PDF', anchor, uri: (convertedPdfUri || uri) } });
              Alert.alert('已保存', '片段已保存到本地知识库');
            } catch (e) {
              Alert.alert('失败', '保存片段失败');
            }
          },
        },
        { text: '添加注释', onPress: () => addTextAnnotation(recognizedText) },
      ]);
    } else {
      // 可选：如果需要，可以给用户一个识别失败的提示
      // console.log('[PDFViewerNative] 未识别出文本');
    }
  }, [currentPage, title, route, convertedPdfUri, uri, navigation]);

  const addTextAnnotation = useCallback((text) => {
    // 将识别文本添加为PDF注释（命令ID: 6）
    if (pdfViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(pdfViewRef.current),
          PDF_VIEW_COMMANDS.ADD_TEXT_ANNOTATION,
          [text]
        );
      } catch (err) {
        console.error('[PDFViewerNative] 添加文本注释命令失败:', err);
      }
    }
  }, []);

  // 区域选择事件处理函数
  const handleRegionTouchStart = useCallback((event) => {
    const { pageX, pageY } = event.nativeEvent;
    selectionStartRef.current = { x: pageX, y: pageY };
    setSelectionRect({ x: pageX, y: pageY, width: 0, height: 0 });
  }, []);

  const handleRegionTouchMove = useCallback((event) => {
    if (!selectionStartRef.current) {return;}

    const { pageX, pageY } = event.nativeEvent;
    const start = selectionStartRef.current;

    setSelectionRect({
      x: Math.min(start.x, pageX),
      y: Math.min(start.y, pageY),
      width: Math.abs(pageX - start.x),
      height: Math.abs(pageY - start.y),
    });
  }, []);

  const handleRegionTouchEnd = useCallback((event) => {
    // 区域选择结束，保持当前选择状态
    // 用户可以通过UI按钮确认或取消
  }, []);

  // ✅ 使用退出前自动保存Hook
  useAutoSaveOnExit(
    async () => {
      if (pdfViewRef.current && noteId && uri) {
        console.log('[PDF] 应用生命周期触发保存');
        await handleSave();
      }
    },
    [noteId, uri]
  );

  const handleGoBack = useCallback(async () => {
    try {
      // ✅ 退出前先保存PDF注释数据
      console.log('🔄 [PDF] 退出前保存数据...');

      if (pdfViewRef.current && noteId && uri) {
        // 导出PDF注释数据
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(pdfViewRef.current),
          PDF_VIEW_COMMANDS.EXPORT_PDF,
          [noteId, uri]
        );

        // 等待一小段时间让导出命令完成
        await new Promise(resolve => setTimeout(resolve, 300));

        // 强制刷新Realm数据到磁盘
        await realmService.forceFlush();
        console.log('✅ [PDF] 退出前保存完成');
      }
    } catch (error) {
      console.error('[PDF] 退出前保存失败:', error);
      // 即使保存失败也继续退出
    } finally {
      // 导航回上一页
      if (fromFileHistory) {
        navigation.navigate('Home');
      } else {
        navigation.goBack();
      }
    }
  }, [fromFileHistory, navigation, noteId, uri]);

  const handleSave = useCallback(async () => {
    console.log('🔥🔥🔥 [PDFViewerNative] 开始保存 PDF 数据...');
    try {
      if (!pdfViewRef.current || !uri) {
        throw new Error('PDF组件或URI无效');
      }

      // ✅ 立即保存所有 PDF 数据到数据库（不等待原生回调）
      if (noteId) {
        console.log('💾 [PDFViewerNative] 保存 PDF 状态到数据库...', {
          noteId,
          currentPage,
          totalPages,
          zoomLevel,
        });

        const realm = await getWritableRealmOrThrow();

        // 🔍 验证 Schema
        const schema = realm.schema.find(s => s.name === 'Note');
        const hasPdfAnnotations = schema && 'pdfAnnotations' in schema.properties;
        console.log('🔍 [PDFViewerNative] Schema 检查 - pdfAnnotations:', hasPdfAnnotations);
        if (!hasPdfAnnotations) {
          console.error('❌❌❌ [PDFViewerNative] Schema 缺少 pdfAnnotations 字段！需要完全重启应用！');
        }

        realm.write(() => {
          let note = realm.objectForPrimaryKey('Note', noteId);

          // 如果不存在，创建新记录
          if (!note) {
            console.log('📝 [PDFViewerNative] 创建新的 Note 记录');
            note = realm.create('Note', {
              _id: noteId,
              title: title || 'PDF文档',
              type: 'pdf',
              file_type: 'pdf',
              created_at: new Date(),
              updated_at: new Date(),
            }, 'modified');
          }

          // 保存所有 PDF 状态
          Object.assign(note, {
            pdfPath: uri,
            pdfCurrentPage: currentPage,
            pdfTotalPages: totalPages,
            pdfScale: zoomLevel,
            // 注意：pdfAnnotations 需要从原生端获取，这里先不保存
            // 原生端应该通过 onExportComplete 回调提供
            updated_at: new Date(),
          });

          console.log('✅✅✅ [PDFViewerNative] PDF 状态已保存到数据库', {
            noteId: note._id,
            pdfPath: note.pdfPath,
            pdfCurrentPage: note.pdfCurrentPage,
            pdfTotalPages: note.pdfTotalPages,
            pdfScale: note.pdfScale,
          });
        });
      }

      // 调用原生方法导出PDF（命令ID: 7）
      // 注意：这会触发 onExportComplete 回调来保存注释数据
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(pdfViewRef.current),
        PDF_VIEW_COMMANDS.EXPORT_PDF,
        [`${uri}_annotated.pdf`]
      );

      setHasUnsavedChanges(false);
      console.log('✅ [PDFViewerNative] PDF保存命令已发送');

      return { success: true };
    } catch (error) {
      console.error('❌ [PDFViewerNative] 保存失败:', error);
      console.error('错误堆栈:', error.stack);
      return { success: false, error: error.message };
    }
  }, [uri, noteId, currentPage, totalPages, zoomLevel, title]);

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
          ...toolbarPropsBase,
          currentPage: currentPage,
          // 提供给工具栏的区域OCR回调（统一触发框选+识别）
          onRequestRegionOCR: async () => {
            try {
              // 进入本页面的框选模式（由本页面完成）
              return await new Promise((resolve) => {
                // 启动选择
                setSelectionRect(null);
                selectionStartRef.current = null;
                setIsSelectingRegion(true);
                // 暂存resolver
                pendingOCRResolverRef.current = resolve;
              });
            } catch (e) {
              console.error('[PDFViewer] performRegionOCR失败:', e);
              return '';
            }
          },
          // 手动触发最近一次笔迹的识别
          onRequestIndexAllPages: async () => {
            Alert.alert(
              '为全文创建索引',
              '这会提取PDF所有页面的文本并将其加入本地知识库以用于问答。该过程可能需要一些时间。',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '开始',
                  onPress: async () => {
                    try {
                      const effectiveUri = convertedPdfUri || uri;
                      if (!effectiveUri) {throw new Error('文件路径无效');}

                      const pages = await pdfTextExtractionService.extractText(effectiveUri);
                      const kbId = route.params?.kbId || 'personal';
                      let snippetsAdded = 0;

                      for (const page of pages) {
                        if (page.text && page.text.trim().length > 20) { // 过滤掉内容过少的页面
                          const anchor = `#p${page.page}`;
                          await addSnippet(kbId, {
                            text: page.text,
                            source: { type: 'pdf', title: title || 'PDF', anchor, uri: effectiveUri },
                          });
                          snippetsAdded++;
                        }
                      }
                      Alert.alert('索引完成', `已成功为 ${snippetsAdded} 页内容创建索引。`);
                    } catch (e) {
                      Alert.alert('索引失败', e.message || '无法提取PDF文本。');
                    }
                  },
                },
              ]
            );
          },
          onRequestStrokeRecognition: async () => toolbarPropsBase.requestRecognition({
            selection: 'latest',
            scope: 'latest',
            strokeId: lastStrokeId,
            count: 1,
            documentPage: currentPage,
          }),
        }}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
      >
        {/* 只有当有有效的PDF路径时才渲染原生组件 */}
        {(convertedPdfUri || (!error && uri)) && (
          <RNNativePDFView
            ref={pdfViewRef}
            style={styles.pdfView}
            source={{
              path: (convertedPdfUri || uri)?.replace('file://', ''),
              uri: convertedPdfUri || uri,
            }}
            initialPage={0}
            currentTool={toolbarPropsBase.currentTool}
            currentColor={toolbarPropsBase.currentColor}
            currentStrokeWidth={toolbarPropsBase.currentStrokeWidth}
            onReady={handleReady}
            onError={handleError}
            onPageChange={handlePageChange}
            onZoomChange={handleZoomChange}
            onStrokeCommitted={handleStrokeCommitted}
            onHistoryStateChange={handleHistoryStateChange}
            onHandwritingRecognized={handleHandwritingRecognized}
            onExportComplete={handleExportComplete}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              console.log('[PDFViewerNative] 原生组件 onLayout:', width, 'x', height);
            }}
          />
        )}

        {/* 区域选择 Overlay（本地OCR） */}
        {isSelectingRegion && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 1000 }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleRegionTouchStart}
            onResponderMove={handleRegionTouchMove}
            onResponderRelease={handleRegionTouchEnd}
          >
            {selectionRect && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: Math.max(selectionRect.width, 1),
                  height: Math.max(selectionRect.height, 1),
                  borderWidth: 2,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary + '22',
                }}
              />
            )}
            <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden' }}>
                <Text onPress={() => {
                  // 取消选择
                  setIsSelectingRegion(false);
                  setSelectionRect(null);
                  selectionStartRef.current = null;
                  if (pendingOCRResolverRef.current) {
                    pendingOCRResolverRef.current('');
                    pendingOCRResolverRef.current = null;
                  }
                }} style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.text }}>取消</Text>
                <Text onPress={async () => {
                  try {
                    if (!selectionRect || !pdfViewRef.current) {throw new Error('未选择区域');}
                    const { x, y, width, height } = selectionRect;
                    const reactTag = findNodeHandle(pdfViewRef.current);
                    if (!reactTag) {throw new Error('视图无效');}
                    // iOS
                    if (Platform.OS === 'ios') {
                      if (NativeModules.NativePDFView?.recognizeTextInRegion) {
                        const text = await NativeModules.NativePDFView.recognizeTextInRegion(reactTag, x, y, width, height);
                        pendingOCRResolverRef.current && pendingOCRResolverRef.current(text || '');
                      } else {
                        throw new Error('NativePDFView.recognizeTextInRegion is not available on iOS');
                      }
                    }
                    // Android（方案A：通过 NativePDFModule 暴露 Promise API）
                    else if (Platform.OS === 'android') {
                      if (NativeModules.NativePDFModule?.recognizeTextInRegion) {
                        const text = await NativeModules.NativePDFModule.recognizeTextInRegion(reactTag, x, y, width, height);
                        pendingOCRResolverRef.current && pendingOCRResolverRef.current(text || '');
                      } else {
                        throw new Error('NativePDFModule.recognizeTextInRegion is not available on Android');
                      }
                    }
                    else {
                      Alert.alert('提示', '当前平台暂未集成本地OCR');
                      pendingOCRResolverRef.current && pendingOCRResolverRef.current('');
                    }
                  } catch (err) {
                    console.error('[PDF RegionOCR] 识别失败:', err);
                    pendingOCRResolverRef.current && pendingOCRResolverRef.current('');
                  } finally {
                    pendingOCRResolverRef.current = null;
                    setIsSelectingRegion(false);
                    setSelectionRect(null);
                    selectionStartRef.current = null;
                  }
                }} style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.primary, fontWeight: '600', borderLeftWidth: 1, borderLeftColor: colors.border }}>识别</Text>
              </View>
            </View>
          </View>
        )}

        {/* 加载覆盖层 - 绝对定位，zIndex 确保在上层 */}
        {isLoading && !isConverting && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
          }]}>
            <LoadingIndicator message="加载 PDF 文档..." />
          </View>
        )}

        {/* 转换进度覆盖层 */}
        {isConverting && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            zIndex: 999,
          }]}>
            <LoadingIndicator message={`正在转换文档为PDF... ${conversionProgress}%`} />
            <View style={{
              width: '80%',
              height: 4,
              backgroundColor: colors.textSecondary + '30',
              borderRadius: 2,
              marginTop: 16,
              overflow: 'hidden',
            }}>
              <View style={{
                width: `${conversionProgress}%`,
                height: '100%',
                backgroundColor: colors.primary,
              }} />
            </View>
          </View>
        )}

        {/* 错误覆盖层 - 绝对定位，zIndex 确保在上层 */}
        {error && (
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
            zIndex: 999,
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
            {typeof error === 'object' && error.showConvertButton && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => {
                  // 开始转换
                  convertFileToPDF();
                }}
              >
                <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>
                  开始转换
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
                    checkAndLoadFile(uri);
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
                  PDF_VIEW_COMMANDS.GO_TO_PAGE,
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
                  PDF_VIEW_COMMANDS.GO_TO_PAGE,
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
                  PDF_VIEW_COMMANDS.GO_TO_PAGE,
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
