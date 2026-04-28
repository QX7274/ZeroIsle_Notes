/**
 * 分页笔记 - 原生实现版本
 *
 * 核心特性：
 * - 原生绘制引擎（GPU 加速）
 * - 统一手势与输入处理
 * - 历史笔画离屏缓存
 * - 样式保持（横线/网格/点阵/Cornell）
 * - 压感与预测支持
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  requireNativeComponent,
  UIManager,
  AppState,
  findNodeHandle,
} from 'react-native';

const RNNativePagedNoteView = requireNativeComponent('NativePagedNoteView');
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { addNote } from '../../redux/slices/notesSlice';
import { recognizeTextInRegion } from '../../native/recognitionBridge';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../../services/database/realmService';
import permanentStorageBridge from '../../native/permanentStorageBridge';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';


// 导入原生工具栏桥接Hook
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import PageControl from '../../components/viewer/PageControl';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import { useAutoSaveOnExit } from '../../hooks/useAutoSaveOnExit';

// 导入内存监控服务
import MemoryMonitor from '../../services/memory/MemoryMonitor';


const SkiaPagedCanvasScreenNative = ({ route, navigation }) => {
  const { title, noteId, noteStyle, createNew, fromFileHistory } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastStrokeId, setLastStrokeId] = useState(null);

  // 区域选择相关状态
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const selectionStartRef = useRef(null);
  const pendingOCRResolverRef = useRef(null);

  const noteViewRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const exportDebounceTimerRef = useRef(null);
  const exportInFlightRef = useRef(false);
  const lastExportAtRef = useRef(0);
  const pendingExportReasonRef = useRef(null);


  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarPropsBase = useNativeToolbarBridge(noteViewRef, 'paged', {
    currentPage,
    totalPages,
  });

  const onRequestRegionOCR = useCallback(async () => {
    try {
      return await new Promise((resolve) => {
        setSelectionRect(null);
        selectionStartRef.current = null;
        setIsSelectingRegion(true);
        pendingOCRResolverRef.current = resolve;
      });
    } catch (e) {
      console.error('[PagedNote] performRegionOCR failed:', e);
      return '';
    }
  }, []);

  const onRequestStrokeRecognition = useCallback(async () => {
    try {
      return await toolbarPropsBase.requestRecognition({
        selection: 'latest',
        scope: 'latest',
        count: lastStrokeId ? 1 : 5,
      });
    } catch (err) {
      console.error('[PagedNote] Manual handwriting recognition failed:', err);
      Alert.alert('错误', err?.message || '手写识别失败');
      return '';
    }
  }, [lastStrokeId, toolbarPropsBase]);

  // 确保toolbarProps有默认值，防止undefined错误
  const safeToolbarProps = {
    ...(toolbarPropsBase || {}),
    currentPage,
    totalPages,
    onRequestRegionOCR,
    onRequestStrokeRecognition,
  };

  const zoomHideTimerRef = useRef(null);
  const handleRegionTouchStart = useCallback((e) => {
    const { pageX, pageY } = e.nativeEvent;
    selectionStartRef.current = { x: pageX, y: pageY };
    setSelectionRect({ x: pageX, y: pageY, width: 0, height: 0 });
  }, []);

  const handleRegionTouchMove = useCallback((e) => {
    if (!selectionStartRef.current) {return;}
    const { pageX, pageY } = e.nativeEvent;
    const start = selectionStartRef.current;
    const x = Math.min(start.x, pageX);
    const y = Math.min(start.y, pageY);
    const width = Math.abs(pageX - start.x);
    const height = Math.abs(pageY - start.y);
    setSelectionRect({ x, y, width, height });
  }, []);

  const persistNoteMeta = useCallback(async () => {
    if (!noteId) {return;}
    const realm = await realmService.getRealm();
    realm.write(() => {
      const note = realm.objectForPrimaryKey('Note', noteId);
      if (note) {
        Object.assign(note, {
          currentPage,
          totalPages,
          scale: zoomLevel,
          updated_at: new Date().toISOString(),
        });
      }
    });
  }, [noteId, currentPage, totalPages, zoomLevel]);

  const dispatchExportNote = useCallback(() => {
    if (!noteViewRef.current || !noteId) {return false;}
    UIManager.dispatchViewManagerCommand(
      findNodeHandle(noteViewRef.current),
      '3',
      [noteId]
    );
    return true;
  }, [noteId]);

  const scheduleExportNote = useCallback(async (reason, options = {}) => {
    const { immediate = false, minIntervalMs = 1200 } = options;
    if (!hasUnsavedChanges || !noteId || !noteViewRef.current) {return;}

    pendingExportReasonRef.current = reason;

    const runExport = async () => {
      if (!hasUnsavedChanges || exportInFlightRef.current) {return;}
      exportInFlightRef.current = true;
      try {
        await persistNoteMeta();
        const dispatched = dispatchExportNote();
        if (dispatched) {
          lastExportAtRef.current = Date.now();
          console.log(`[SkiaPagedCanvasScreenNative] 导出触发(${pendingExportReasonRef.current || 'unknown'})`);
        }
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 导出调度失败:', err);
      } finally {
        exportInFlightRef.current = false;
        pendingExportReasonRef.current = null;
      }
    };

    if (immediate) {
      if (exportDebounceTimerRef.current) {
        clearTimeout(exportDebounceTimerRef.current);
        exportDebounceTimerRef.current = null;
      }
      await runExport();
      return;
    }

    const elapsed = Date.now() - lastExportAtRef.current;
    const waitMs = elapsed >= minIntervalMs ? minIntervalMs : (minIntervalMs - elapsed);

    if (exportDebounceTimerRef.current) {
      clearTimeout(exportDebounceTimerRef.current);
    }
    exportDebounceTimerRef.current = setTimeout(() => {
      exportDebounceTimerRef.current = null;
      runExport();
    }, waitMs);
  }, [hasUnsavedChanges, noteId, persistNoteMeta, dispatchExportNote]);

  const handleRegionTouchEnd = useCallback(() => {
    // Selection is complete, wait for user to confirm or cancel
  }, []);


  // 初始化笔记
  useEffect(() => {
    console.log('[SkiaPagedCanvasScreenNative] 初始化原生分页笔记', { title, noteId, noteStyle, createNew });

    // 启动内存监控
    MemoryMonitor.startMonitoring();

    // 添加内存清理回调
    MemoryMonitor.addCleanupCallback(async () => {
      console.log('[SkiaPagedCanvasScreenNative] 执行内存清理...');
      // 清理不必要的缓存和临时数据
      if (noteViewRef.current) {
        try {
          // 通知原生组件清理内存
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(noteViewRef.current),
            '8', // cleanupMemory 命令
            []
          );
        } catch (err) {
          console.error('[SkiaPagedCanvasScreenNative] 原生内存清理失败:', err);
        }
      }
    });

    if (createNew && noteId) {
      // 创建新笔记并保存
      createNewNote();
    } else if (noteId) {
      loadNote(noteId);
    }
  }, [noteId, createNew]);

  // ✅ 监听屏幕焦点变化，失焦时触发一次立即导出
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[SkiaPagedCanvasScreenNative] 屏幕获得焦点');
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[SkiaPagedCanvasScreenNative] 屏幕失去焦点，触发保存...');
      scheduleExportNote('blur', { immediate: true });
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, scheduleExportNote]);

  // ✅ 监听应用状态变化，应用进入后台时触发立即导出
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        console.log('[SkiaPagedCanvasScreenNative] 应用进入后台，触发保存...');
        scheduleExportNote('app-background', { immediate: true });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [scheduleExportNote]);

  // 添加到文件历史（进入页面或标题变化时）
  useEffect(() => {
    let isMounted = true;

    try {
      const fileHistoryService = require('../../services/fileHistoryService').default;
      const effectiveTitle = (title || '分页笔记').trim();
      if (isMounted && noteId && effectiveTitle && fileHistoryService && fileHistoryService.addFile) {
        console.log('[SkiaPagedCanvasScreenNative] 添加到文件历史记录:', { noteId, effectiveTitle });
        fileHistoryService.addFile({
          uri: `paged_note://${noteId}`,
          title: effectiveTitle,
          type: 'paged_note',
          noteType: 'paged_note',
          fileName: effectiveTitle,
          noteId: noteId,
        });
      } else {
        console.log('[SkiaPagedCanvasScreenNative] 跳过添加到文件历史记录:', {
          isMounted,
          noteId,
          effectiveTitle,
          hasFileHistoryService: !!fileHistoryService,
          hasAddFile: !!(fileHistoryService && fileHistoryService.addFile),
        });
      }
    } catch (e) {
      console.error('[SkiaPagedCanvasScreenNative] 添加到文件历史记录失败:', e);
    }

    return () => {
      isMounted = false;
    };
  }, [noteId, title]);

  // ✅ 自动保存机制：仅调度导出，不在笔迹路径重复写库
  useEffect(() => {
    if (hasUnsavedChanges && noteId && noteViewRef.current) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        console.log('[SkiaPagedCanvasScreenNative] 自动保存调度触发...');
        scheduleExportNote('auto-save', { immediate: false, minIntervalMs: 1200 });
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [hasUnsavedChanges, noteId, scheduleExportNote]);

  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && noteViewRef.current && noteId) {
        dispatchExportNote();
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (exportDebounceTimerRef.current) {
        clearTimeout(exportDebounceTimerRef.current);
        exportDebounceTimerRef.current = null;
      }

      MemoryMonitor.stopMonitoring();
    };
  }, [hasUnsavedChanges, noteId, dispatchExportNote]);

  // ✅ 清理定时器
  useEffect(() => {
    return () => {
      if (zoomHideTimerRef.current) {
        clearTimeout(zoomHideTimerRef.current);
        zoomHideTimerRef.current = null;
      }
    };
  }, []);

  // 处理原生组件就绪事件
  const handleReady = useCallback(async (event) => {
    const { totalPages: readyTotalPages, currentPage: readyCurrentPage } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 原生组件就绪', { totalPages: readyTotalPages, currentPage: readyCurrentPage });

    // 验证页数是否合理
    const validTotalPages = (readyTotalPages && readyTotalPages > 0 && readyTotalPages < 100) ? readyTotalPages : 1;
    setTotalPages(validTotalPages);

    // currentPage从原生来是0-based，UI显示需要1-based
    const validCurrentPage = (readyCurrentPage >= 0 && readyCurrentPage < validTotalPages) ? readyCurrentPage : 0;
    setCurrentPage(validCurrentPage + 1);

    setIsLoading(false);

    // ✅ 在组件就绪后延迟导入页面数据，确保原生组件完全准备好
    if (noteId && noteViewRef.current) {
      // 使用延迟确保原生组件完全初始化
      setTimeout(async () => {
        try {
          const realm = await realmService.getRealm();
          const noteData = realm.objectForPrimaryKey('Note', noteId);

          if (noteData) {
            console.log('📥 [分页笔记] 准备导入数据:', {
              hasPages: !!noteData.pages,
              pagesLength: noteData.pages?.length || 0,
              currentPage: noteData.currentPage,
              totalPages: noteData.totalPages,
            });

            if (noteData.pages) {
              console.log('📥 [分页笔记] 开始导入页面数据');
              const nodeHandle = findNodeHandle(noteViewRef.current);
              if (nodeHandle) {
                // 确保数据格式正确
                const pagesData = typeof noteData.pages === 'string'
                  ? noteData.pages
                  : JSON.stringify(noteData.pages);

                UIManager.dispatchViewManagerCommand(
                  nodeHandle,
                  '12', // importNote 命令
                  [pagesData]
                );
                console.log('✅ [分页笔记] 页面数据已发送至原生组件，数据长度:', pagesData.length);
              } else {
                console.error('❌ [分页笔记] 无法获取原生组件句柄');
              }
            } else if (noteData.currentPage !== undefined && noteData.currentPage > 0) {
              // 没有页面数据，恢复页面位置
              console.log('📥 [分页笔记] 恢复页面位置:', noteData.currentPage);
              const nodeHandle = findNodeHandle(noteViewRef.current);
              if (nodeHandle) {
                UIManager.dispatchViewManagerCommand(
                  nodeHandle,
                  '7', // setCurrentPage 命令
                  [noteData.currentPage - 1] // 转换为0-based
                );
              }
            } else {
              console.log('ℹ️ [分页笔记] 没有需要导入的数据');
            }
          } else {
            console.log('ℹ️ [分页笔记] 数据库中没有找到笔记数据');
          }
        } catch (error) {
          console.error('[分页笔记] 导入页面数据失败:', error);
        }
      }, 500); // 延迟500ms确保原生组件完全准备好
    }
  }, [noteId]);

  const createNewNote = useCallback(async () => {
    try {
      if (!noteId) {
        console.error('[SkiaPagedCanvasScreenNative] 缺少noteId，无法创建笔记');
        Alert.alert('错误', '无法创建笔记：缺少笔记ID');
        return;
      }

      console.log('[SkiaPagedCanvasScreenNative] 创建新笔记，ID:', noteId);

      const newNote = {
        _id: noteId, // 使用字符串，Realm 会自动转换为 ObjectId
        id: noteId.toString(), // id 字段使用字符串
        title: title || '新建笔记',
        content: '',
        type: 'paged_note',
        noteType: 'paged_note',
        file_type: 'paged_note',
        noteStyle: noteStyle || 'blank',
        pages: JSON.stringify([{ content: '', pageNumber: 0, strokes: [] }]),
        totalPages: 1,
        currentPage: 1,
        scale: 1.0,
        scrollPosition: JSON.stringify({ x: 0, y: 0 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        file_uri: `paged_note://${noteId}`,
        uri: `paged_note://${noteId}`,
      };

      const realm = await realmService.getRealm();
      let savedNote;
      realm.write(() => {
        // 使用'modified'模式：如果Note已存在则更新，不存在则创建
        savedNote = realm.create('Note', newNote, 'modified');
      });

      dispatch(addNote(savedNote));
      console.log('[SkiaPagedCanvasScreenNative] 新笔记创建成功');
      // 同步创建原生侧永久存储记录（带更好的错误处理）
      try {
        // 确保 permanentStorageBridge 已初始化
        if (permanentStorageBridge && typeof permanentStorageBridge.createNote === 'function') {
          await permanentStorageBridge.createNote({
            _id: noteId,
            type: 'paged_note',
            title: title || '新建笔记',
            pageStyle: noteStyle || 'blank',
            pages: JSON.stringify([{ content: '', pageNumber: 0, strokes: [] }]),
            currentPage: 1,
            totalPages: 1,
            scale: 1.0,
            updated_at: new Date().toISOString(),
          });
          console.log('[PagedNote] 原生永久存储创建成功');
        } else {
          console.warn('[PagedNote] permanentStorageBridge 未初始化或方法不存在，跳过原生存储');
        }
      } catch (e) {
        console.warn('[PagedNote] 原生永久存储创建失败，将继续使用本地数据库:', e?.message || e);
        // 不抛出错误，继续执行
      }
      setIsLoading(false);
    } catch (error) {
      console.error('[SkiaPagedCanvasScreenNative] 创建新笔记失败:', error);
      Alert.alert('错误', '创建笔记失败');
      setError('创建笔记失败');
      setIsLoading(false);
    }
  }, [noteId, title, noteStyle, dispatch]);

  const loadNote = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[SkiaPagedCanvasScreenNative] 加载笔记ID:', id);

      // 从数据库加载笔记元数据（包括保存的位置和状态）
      const realm = await realmService.getRealm();
      const noteData = realm.objectForPrimaryKey('Note', id);

      if (noteData) {
        console.log('[SkiaPagedCanvasScreenNative] 恢复笔记状态:', {
          currentPage: noteData.currentPage,
          totalPages: noteData.totalPages,
          scale: noteData.scale,
          pageStyle: noteData.pageStyle,
          hasPagesData: !!noteData.pages,
        });

        // 恢复保存的状态
        if (noteData.currentPage !== undefined) {
          setCurrentPage(noteData.currentPage);
        }
        if (noteData.totalPages !== undefined && noteData.totalPages > 0) {
          setTotalPages(noteData.totalPages);
        }
        if (noteData.scale !== undefined) {
          setZoomLevel(noteData.scale);
        }

        // ✅ 数据导入将在handleReady中进行，不使用setTimeout
        console.log('ℹ️ [分页笔记] 数据将在handleReady中导入');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[SkiaPagedCanvasScreenNative] 加载笔记失败:', err);
      setError('加载笔记失败');
      setIsLoading(false);
    }
  }, []);

  const handleStrokeCommitted = useCallback((event) => {
    const strokeData = event.nativeEvent;
    if (!strokeData?.strokeId) {return;}

    setLastStrokeId(strokeData.strokeId);
    setHasUnsavedChanges(true);

    scheduleExportNote('stroke-committed', { immediate: false, minIntervalMs: 1200 });

    toolbarPropsBase.scheduleRecognition({
      selection: 'latest',
      scope: 'latest',
      strokeId: strokeData.strokeId,
      strokeIds: [strokeData.strokeId],
      count: 1,
      documentPage: currentPage,
    });
  }, [scheduleExportNote, toolbarPropsBase, currentPage]);

  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText: legacyText, text, confidence } = event.nativeEvent;
    const recognizedText = typeof text === 'string' && text.length > 0 ? text : legacyText;
    console.log('[SkiaPagedCanvasScreenNative] 手写识别结果:', { strokeId, recognizedText, confidence });

    // 显示识别结果
    if (recognizedText && confidence > 0.7) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '插入文本', onPress: () => insertRecognizedText(recognizedText) },
      ]);
    }
  }, []);

  // 处理导出完成事件 - 保存笔迹数据到数据库
  const handleExportComplete = useCallback(async (event) => {
    const { noteId: exportedNoteId, data, success } = event.nativeEvent;

    if (!success) {
      console.error('[SkiaPagedCanvasScreenNative] 导出失败');
      return;
    }

    try {
      console.log('[SkiaPagedCanvasScreenNative] 导出成功，保存数据到数据库...', {
        exportedNoteId,
        dataLength: data?.length || 0,
        dataType: typeof data,
      });

      // 解析导出的数据
      const noteData = typeof data === 'string' ? JSON.parse(data) : data;

      // 保存到数据库
      const realm = await realmService.getRealm();

      // 🔍 验证 Schema 是否包含 pages 和 pageStyle 字段
      const schema = realm.schema.find(s => s.name === 'Note');
      const hasPages = schema && 'pages' in schema.properties;
      const hasPageStyle = schema && 'pageStyle' in schema.properties;
      console.log('🔍 [PagedNote] Schema 检查:', {
        hasPages,
        hasPageStyle,
      });
      if (!hasPages || !hasPageStyle) {
        console.error('❌❌❌ [PagedNote] Schema 缺少关键字段！需要完全重启应用！');
      }

      realm.write(() => {
        let note = realm.objectForPrimaryKey('Note', exportedNoteId);

        // 如果note不存在，创建一个新的
        if (!note) {
          console.log('[SkiaPagedCanvasScreenNative] Note不存在，创建新的Note记录');
          note = realm.create('Note', {
            _id: exportedNoteId,
            title: title || '分页笔记',
            type: 'paged_note',
            noteType: 'paged_note',
            file_type: 'paged_note',
            created_at: new Date(),
            updated_at: new Date(),
          }, 'modified');
        }

        // ✅ data已经是JSON字符串，直接保存
        const pagesDataStr = typeof data === 'string' ? data : JSON.stringify(data);

        Object.assign(note, {
          pages: pagesDataStr, // 保存完整的页面数据JSON
          currentPage: noteData.currentPage || currentPage,
          totalPages: noteData.totalPages || totalPages,
          pageStyle: noteData.pageStyle || noteStyle || 'blank',
          scale: noteData.scale || zoomLevel,
          updated_at: new Date(),
        });

        console.log('✅✅✅ [SkiaPagedCanvasScreenNative] 页面数据已保存到数据库', {
          noteId: exportedNoteId,
          currentPage: note.currentPage,
          totalPages: note.totalPages,
          pageStyle: note.pageStyle,
          scale: note.scale,
          pagesDataLength: note.pages?.length || 0,
        });

        // 🔍 立即读取验证
        const verification = realm.objectForPrimaryKey('Note', exportedNoteId);
        console.log('🔍 [PagedNote] 保存后立即验证:', {
          noteExists: !!verification,
          totalPages: verification?.totalPages,
          pageStyle: verification?.pageStyle,
          pagesLength: verification?.pages?.length || 0,
        });
      });

      setHasUnsavedChanges(false);
      console.log('[SkiaPagedCanvasScreenNative] 页面数据保存完成');

      // 同步写入原生永久存储（参考PDF实现）
      try {
        // 确保 permanentStorageBridge 已初始化
        if (permanentStorageBridge && typeof permanentStorageBridge.updateNote === 'function') {
          await permanentStorageBridge.updateNote(exportedNoteId, {
            type: 'paged_note',
            pages: typeof data === 'string' ? data : JSON.stringify(data),
            currentPage: noteData.currentPage || currentPage,
            totalPages: noteData.totalPages || totalPages,
            pageStyle: noteData.pageStyle || noteStyle || 'blank',
            scale: noteData.scale || zoomLevel,
            updated_at: new Date().toISOString(),
          });
          console.log('[PagedNote] 原生永久存储更新成功');
        } else {
          console.warn('[PagedNote] permanentStorageBridge 未初始化或方法不存在，跳过原生存储更新');
        }
      } catch (e) {
        console.warn('[PagedNote] 原生永久存储更新失败，将继续使用本地数据库', e?.message || e);
      }
    } catch (error) {
      console.error('[SkiaPagedCanvasScreenNative] 保存页面数据失败:', error);
      console.error('[SkiaPagedCanvasScreenNative] 错误堆栈:', error.stack);
    }
  }, [title, noteStyle, currentPage, totalPages, zoomLevel]);

  const insertRecognizedText = useCallback((text) => {
    // 将识别文本插入到笔记中（命令ID: 2）
    if (noteViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '2', // insertText 命令
          [text]
        );
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 插入文本命令失败:', err);
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    console.log('[SkiaPagedCanvasScreenNative] 保存笔记...');
    try {
      if (!noteViewRef.current || !noteId) {
        throw new Error('原生组件或笔记ID无效');
      }

      await scheduleExportNote('manual-save', { immediate: true });
      setHasUnsavedChanges(false);
      console.log('[SkiaPagedCanvasScreenNative] 笔记保存成功');

      return { success: true };
    } catch (error) {
      console.error('[SkiaPagedCanvasScreenNative] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [noteId, scheduleExportNote]);


  const handleZoomChange = useCallback((event) => {
    const nativeEvent = event?.nativeEvent || {};
    const scale = typeof nativeEvent.scale === 'number' ? nativeEvent.scale : 1.0;
    const isScaling = nativeEvent.isScaling === true;

    console.log('[SkiaPagedCanvasScreenNative] 缩放变化:', scale, '是否正在缩放:', isScaling);
    setZoomLevel(scale);

    setShowZoomIndicator(true);
    if (zoomHideTimerRef.current) {
      clearTimeout(zoomHideTimerRef.current);
      zoomHideTimerRef.current = null;
    }

    if (isScaling) {
      return;
    }

    zoomHideTimerRef.current = setTimeout(() => {
      setShowZoomIndicator(false);
      zoomHideTimerRef.current = null;
    }, 1000);

    // 缩放变化走统一导出调度，避免直接高频写库
    scheduleExportNote();
  }, [scheduleExportNote]);

  const handlePageChange = useCallback((event) => {
    const { page } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 页面变化:', page);
    // page从原生来是0-based，UI显示需要1-based
    setCurrentPage(page + 1);
  }, []);

  const handlePageAdded = useCallback((event) => {
    const { totalPages: newTotalPages } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 页面添加事件，总页数:', newTotalPages);

    if (newTotalPages && newTotalPages > 0) {
      setTotalPages(newTotalPages);
      // 标记有未保存的更改（新增页面）
      setHasUnsavedChanges(true);
    }
  }, []);

  // ✅ 使用退出前自动保存Hook
  useAutoSaveOnExit(
    async () => {
      if (noteViewRef.current && noteId) {
        console.log('[分页笔记] 应用生命周期触发保存');
        await handleSave();
      }
    },
    [noteId]
  );

  const handleGoBackWrapper = useCallback(async () => {
    try {
      // ✅ 退出前先保存笔记数据
      console.log('🔄 [分页笔记] 退出前保存数据...');

      if (noteViewRef.current && noteId) {
        // 导出笔记数据
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '3', // exportNote 命令
          [noteId]
        );

        // 等待一小段时间让导出命令完成
        await new Promise(resolve => setTimeout(resolve, 300));

        // 强制刷新Realm数据到磁盘
        await realmService.forceFlush();
        console.log('✅ [分页笔记] 退出前保存完成');
      }
    } catch (error) {
      console.error('[分页笔记] 退出前保存失败:', error);
      // 即使保存失败也继续退出
    } finally {
      // 导航回上一页
      if (fromFileHistory) {
        navigation.navigate('Home');
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
    }
  }, [fromFileHistory, navigation, noteId]);

  console.log('[SkiaPagedCanvasScreenNative] 渲染组件，isLoading:', isLoading, 'error:', error, 'noteId:', noteId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ViewerLayout

        colors={colors}
        headerLeft={
          <BackButton
            onPress={handleGoBackWrapper}
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
        title={title || '分页笔记（原生）'}
        showExternalToolbar={true}
        toolbarProps={{
          ...(toolbarPropsBase || safeToolbarProps),
          currentPage: currentPage,
          performRegionOCR: async (rect) => {
            try {
              const nodeHandle = findNodeHandle(noteViewRef.current);
              if (!nodeHandle) {
                Alert.alert('错误', '视图无效');
                return '';
              }

              let results = [];
              // iOS
              if (Platform.OS === 'ios') {
                const { NativePagedNoteView } = require('react-native').NativeModules;
                if (NativePagedNoteView?.recognizeTextInRegion) {
                  results = await NativePagedNoteView.recognizeTextInRegion(nodeHandle, rect.x, rect.y, rect.width, rect.height);
                }
              }
              // Android
              else if (Platform.OS === 'android') {
                const { NativePagedNoteViewManager } = require('react-native').NativeModules;
                if (NativePagedNoteViewManager?.recognizeTextInRegion) {
                  results = await NativePagedNoteViewManager.recognizeTextInRegion(nodeHandle, rect.x, rect.y, rect.width, rect.height);
                }
              }

              if (!results || results.length === 0) {
                Alert.alert('提示', '未识别到文本');
                return '';
              }

              // Combine text from all recognized blocks
              const combinedText = results.map(block => block.text).join(' ');
              console.log('[PagedCanvas] Recognized text blocks:', results);
              return combinedText || '';

            } catch (e) {
              console.error('[PagedCanvas] performRegionOCR失败:', e);
              Alert.alert('错误', 'OCR识别失败');
              return '';
            }
          },
          onRequestStrokeRecognition: async () => {
            try {
              return await toolbarPropsBase.requestRecognition({
                selection: 'latest',
                scope: 'latest',
                strokeId: lastStrokeId,
                count: lastStrokeId ? 1 : 5,
                documentPage: currentPage,
              });
            } catch (error) {
              console.error('[PagedCanvas] 手写识别失败:', error);
              Alert.alert('错误', '手写识别失败: ' + error.message);
              return '';
            }
          },
        }}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
      >
        <RNNativePagedNoteView
          ref={noteViewRef}
          style={styles.noteView}
          pointerEvents="auto"
          noteId={noteId}
          styleConfig={{ background: noteStyle || 'blank' }}
          currentTool={safeToolbarProps.currentTool}
          currentColor={safeToolbarProps.currentColor}
          currentStrokeWidth={safeToolbarProps.currentStrokeWidth}
          onReady={handleReady}
          onStrokeCommitted={handleStrokeCommitted}
          onPageChange={handlePageChange}
          onPageAdded={handlePageAdded}
          onZoomChange={handleZoomChange}
          onHandwritingRecognized={handleHandwritingRecognized}
          onExportComplete={handleExportComplete}


          onError={(event) => {
            console.error('[SkiaPagedCanvasScreenNative] 原生组件错误:', event.nativeEvent);
            setError(event.nativeEvent.message || '原生组件发生错误');






            setIsLoading(false);
          }}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            console.log('[SkiaPagedCanvasScreenNative] 原生组件 onLayout，size:', width, 'x', height);
          }}
        />

        {/* 区域选择 Overlay (本地OCR) */}
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
                  setIsSelectingRegion(false);
                  setSelectionRect(null);
                  selectionStartRef.current = null;
                  if (pendingOCRResolverRef.current) {
                    pendingOCRResolverRef.current('');
                    pendingOCRResolverRef.current = null;
                  }
                }} style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.text }}>Cancel</Text>
                <Text onPress={async () => {
                  try {
                    if (!selectionRect || !noteViewRef.current) {throw new Error('No region selected');}
                    const { x, y, width, height } = selectionRect;
                    const reactTag = findNodeHandle(noteViewRef.current);
                    if (!reactTag) {throw new Error('Invalid view');}

                    const text = await recognizeTextInRegion('paged', reactTag, { x, y, width, height });

                    pendingOCRResolverRef.current && pendingOCRResolverRef.current(text || '');
                  } catch (err) {
                    console.error('[PagedNote RegionOCR] Recognition failed:', err);
                    pendingOCRResolverRef.current && pendingOCRResolverRef.current('');
                  } finally {
                    pendingOCRResolverRef.current = null;
                    setIsSelectingRegion(false);
                    setSelectionRect(null);
                    selectionStartRef.current = null;
                  }
                }} style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.primary, fontWeight: '600', borderLeftWidth: 1, borderLeftColor: colors.border }}>Recognize</Text>
              </View>
            </View>
          </View>
        )}


        {/* 加载覆盖层 */}
        {isLoading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <LoadingIndicator message="加载原生分页笔记..." />
          </View>
        )}

        {/* 错误覆盖层 */}
        {error && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}
      </ViewerLayout>

      {/* 页码控制器 - 在ViewerLayout外部 */}
      {totalPages > 1 && (
        <PageControl
          total={totalPages}
          current={currentPage}
          onPrev={() => {
            if (currentPage > 1) {
              const newPage = currentPage - 1;
              setCurrentPage(newPage);
              if (noteViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(noteViewRef.current),
                  '7', // setCurrentPage
                  [newPage - 1] // 原生是0-based索引
                );
              }
            }
          }}
          onNext={() => {
            if (currentPage < totalPages) {
              const newPage = currentPage + 1;
              setCurrentPage(newPage);
              if (noteViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(noteViewRef.current),
                  '7', // setCurrentPage
                  [newPage - 1]
                );
              }
            }
          }}
          onSubmitPage={(pageNum) => {
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              setCurrentPage(pageNum);
              if (noteViewRef.current) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(noteViewRef.current),
                  '7', // setCurrentPage
                  [pageNum - 1]
                );
              }
            }
          }}
          storageKey="native_paged_note_page_control_pos"
        />
      )}

      {/* 缩放指示器 - 在ViewerLayout外部 */}
      <ZoomIndicator
        scale={zoomLevel}
        visible={showZoomIndicator}
        autoHideDelay={1000}
        topOffset={60}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  noteView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  saveButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },

});

export default SkiaPagedCanvasScreenNative;
