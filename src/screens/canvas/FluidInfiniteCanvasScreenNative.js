/**
 * 无限画布 - 原生实现版本
 *
 * 核心特性：
 * - 真实世界坐标系统（动态扩展）
 * - GPU Group Transform
 * - 高性能路径渲染
 * - 背景网格阈值重建
 * - 海量笔迹场景优化
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  NativeModules,
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  AppState,
} from 'react-native';

const INFINITE_CANVAS_COMMANDS = {
  RECOGNIZE_HANDWRITING: '1',
  ADD_TEXT_ELEMENT: '2',
  EXPORT_CANVAS: '3',
  UNDO: '4',
  REDO: '5',
};

const RNNativeInfiniteCanvasView = requireNativeComponent('NativeInfiniteCanvasView');
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';
import permanentStorageBridge from '../../native/permanentStorageBridge';
import { recognizeTextInRegion } from '../../native/recognitionBridge';
import { useDispatch } from 'react-redux';
import { addNote } from '../../redux/slices/notesSlice';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';

// 导入原生工具栏桥接Hook
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import { useAutoSaveOnExit } from '../../hooks/useAutoSaveOnExit';

const FluidInfiniteCanvasScreenNative = ({ route, navigation }) => {
  const { noteId, title, canvasStyle, createNew, fromFileHistory } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 处理 noteId，确保是有效的字符串ID
  const noteObjectId = React.useMemo(() => {
    if (!noteId) {return null;}
    if (typeof noteId === 'string') {
      return noteId;
    }
    return null;
  }, [noteId]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [strokeOrder, setStrokeOrder] = useState([]);
  const [loadedCanvasStyle, setLoadedCanvasStyle] = useState(canvasStyle || 'white');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const canvasViewRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarPropsBase = useNativeToolbarBridge(canvasViewRef, 'infinite');
  const zoomDebounceTimer = useRef(null);
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  const exportDebounceTimerRef = useRef(null);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null); // { x, y, width, height }
  const pendingOCRResolverRef = useRef(null);
  const selectionStartRef = useRef(null);

  // 初始化画布
  useEffect(() => {
    console.log('[FluidInfiniteCanvasScreenNative] 初始化原生无限画布', { noteId, title, canvasStyle, createNew });
    console.log('🔍 [画布] 初始化检查 - createNew:', createNew, 'noteObjectId:', noteObjectId);

    if (createNew && noteObjectId) {
      console.log('🔍 [画布] 调用 createNewCanvas');
      // 创建新画布并保存
      createNewCanvas();
    } else if (noteObjectId) {
      console.log('🔍 [画布] 调用 loadCanvas');
      loadCanvas(noteObjectId);
    } else {
      console.log('🔍 [画布] 没有调用任何函数 - createNew:', createNew, 'noteObjectId:', noteObjectId);
    }
  }, [noteObjectId, createNew]);

  // 跟踪画布样式变化
  useEffect(() => {
    console.log('🎨 [画布] 样式状态变化:', loadedCanvasStyle);
  }, [loadedCanvasStyle]);

  // 添加到文件历史（进入页面或标题变化时）
  useEffect(() => {
    let isMounted = true;

    try {
      const fileHistoryService = require('../../services/fileHistoryService').default;
      const effectiveTitle = (title || '无限画布').trim();
      if (isMounted && noteId && effectiveTitle && fileHistoryService && fileHistoryService.addFile) {
        console.log('[FluidInfiniteCanvasScreenNative] 添加到文件历史记录:', { noteId, effectiveTitle });
        fileHistoryService.addFile({
          uri: `canvas://${noteId}`,
          title: effectiveTitle,
          type: 'canvas',
          noteType: 'canvas',
          fileName: effectiveTitle,
          noteId: noteId,
        });
      } else {
        console.log('[FluidInfiniteCanvasScreenNative] 跳过添加到文件历史记录:', {
          isMounted,
          noteId,
          effectiveTitle,
          hasFileHistoryService: !!fileHistoryService,
          hasAddFile: !!(fileHistoryService && fileHistoryService.addFile),
        });
      }
    } catch (e) {
      console.error('[FluidInfiniteCanvasScreenNative] 添加到文件历史记录失败:', e);
    }

    return () => {
      isMounted = false;
    };
  }, [noteId, title]);

  // ✅ 自动保存机制
  useEffect(() => {
    if (hasUnsavedChanges && noteObjectId && canvasViewRef.current) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(async () => {
        console.log('[FluidInfiniteCanvasScreenNative] 自动保存触发...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
            [noteObjectId.toString()]
          );
        } catch (err) {
          console.error('[FluidInfiniteCanvasScreenNative] 自动保存失败:', err);
        }
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, noteObjectId]);

  // ✅ 监听应用状态变化，应用进入后台时保存数据
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'background' && hasUnsavedChanges && canvasViewRef.current && noteObjectId) {
        console.log('[FluidInfiniteCanvasScreenNative] 应用进入后台，立即保存数据...');
        try {
          // 先保存基本状态
          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteObjectId.toString());
            if (note) {
              Object.assign(note, {
                viewport: JSON.stringify(viewportRef.current),
                canvasStyle: loadedCanvasStyle,
                updated_at: new Date().toISOString(),
              });
            }
          }).then(() => {
            // 然后保存画布数据
            UIManager.dispatchViewManagerCommand(
              findNodeHandle(canvasViewRef.current),
              INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
              [noteObjectId.toString()]
            );
            console.log('[FluidInfiniteCanvasScreenNative] 后台保存完成');
          }).catch(err => {
            console.error('[FluidInfiniteCanvasScreenNative] 后台保存失败:', err);
          });
        } catch (err) {
          console.error('[FluidInfiniteCanvasScreenNative] 后台保存失败:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [hasUnsavedChanges, noteObjectId, loadedCanvasStyle]);

  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && canvasViewRef.current && noteObjectId) {
        console.log('[FluidInfiniteCanvasScreenNative] 组件卸载，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
            [noteObjectId.toString()]
          );
        } catch (err) {
          console.error('[FluidInfiniteCanvasScreenNative] 卸载保存失败:', err);
        }
      }
    };
  }, [hasUnsavedChanges, noteObjectId]);

  // ✅ 监听屏幕焦点变化，失焦时保存数据
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', async () => {
      if (hasUnsavedChanges && canvasViewRef.current && noteObjectId) {
        console.log('[FluidInfiniteCanvasScreenNative] 屏幕失去焦点，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
            [noteObjectId.toString()]
          );

          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteObjectId.toString());
            if (note) {
              Object.assign(note, {
                viewport: JSON.stringify(viewportRef.current),
                updated_at: new Date().toISOString(),
              });
            }
          }).catch(err => console.error('失焦保存失败:', err));
        } catch (err) {
          console.error('[FluidInfiniteCanvasScreenNative] 失焦保存失败:', err);
        }
      }
    });

    return () => {
      unsubscribeBlur();
    };
  }, [navigation, hasUnsavedChanges, noteObjectId]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (zoomDebounceTimer.current) {
        clearTimeout(zoomDebounceTimer.current);
      }
      if (exportDebounceTimerRef.current) {
        clearTimeout(exportDebounceTimerRef.current);
        exportDebounceTimerRef.current = null;
      }
    };
  }, []);

  // ===== 区域OCR：开始选择并在完成后触发本地识别 =====
  const onRequestRegionOCR = useCallback(() => {
    return new Promise((resolve) => {
      pendingOCRResolverRef.current = resolve;
      setSelectionRect(null);
      selectionStartRef.current = null;
      setIsSelectingRegion(true);
    });
  }, []);

  const onRequestStrokeRecognition = useCallback(async (recognitionType = 'auto', selectedStrokeIds = []) => {
    try {
      let strokeIdsToRecognize = [];
      if (recognitionType === 'lasso' && selectedStrokeIds.length > 0) {
        strokeIdsToRecognize = selectedStrokeIds;
      } else {
        const count = 5; // 默认识别最近5笔
        strokeIdsToRecognize = strokeOrder.slice(-count);
      }

      if (strokeIdsToRecognize.length === 0) {
        console.log('[Recognition] 没有可识别的笔迹');
        return '';
      }

      const recognizedText = await toolbarPropsBase.requestRecognition({
        selection: recognitionType === 'lasso' ? 'selection' : 'latest',
        scope: recognitionType === 'lasso' ? 'selection' : 'latest',
        strokeIds: strokeIdsToRecognize,
        count: strokeIdsToRecognize.length,
      });

      console.log(`[Recognition] 结果: "${recognizedText}"`);
      return recognizedText;
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 手写识别失败:', error);
      Alert.alert('错误', '手写识别失败: ' + error.message);
      return '';
    }
  }, [strokeOrder, toolbarPropsBase]);

  const handleRegionTouchStart = useCallback((e) => {
    const { locationX, locationY } = e.nativeEvent;
    selectionStartRef.current = { x: locationX, y: locationY };
    setSelectionRect({ x: locationX, y: locationY, width: 0, height: 0 });
  }, []);

  const handleRegionTouchMove = useCallback((e) => {
    if (!selectionStartRef.current) {return;}
    const { locationX, locationY } = e.nativeEvent;
    const start = selectionStartRef.current;
    const x = Math.min(start.x, locationX);
    const y = Math.min(start.y, locationY);
    const width = Math.abs(locationX - start.x);
    const height = Math.abs(locationY - start.y);
    setSelectionRect({ x, y, width, height });
  }, []);

  const handleRegionTouchEnd = useCallback(() => {
    // 停留选择，等待用户点击“识别”或“取消”
  }, []);

  const cancelRegionSelection = useCallback(() => {
    setIsSelectingRegion(false);
    setSelectionRect(null);
    selectionStartRef.current = null;
    if (pendingOCRResolverRef.current) {
      pendingOCRResolverRef.current('');
      pendingOCRResolverRef.current = null;
    }
  }, []);

  const confirmRegionOCR = useCallback(async () => {
    try {
      if (!selectionRect || !canvasViewRef.current) {
        throw new Error('未选择区域');
      }
      const { x, y, width, height } = selectionRect;
      const reactTag = findNodeHandle(canvasViewRef.current);
      if (!reactTag) {throw new Error('视图无效');}

      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        Alert.alert('提示', '当前平台暂未集成本地OCR');
        pendingOCRResolverRef.current && pendingOCRResolverRef.current('');
        return;
      }

      const recognizedText = await recognizeTextInRegion('infinite', reactTag, { x, y, width, height });
      console.log('[RegionOCR] Recognized text:', recognizedText);
      pendingOCRResolverRef.current && pendingOCRResolverRef.current(recognizedText || '');
    } catch (error) {
      console.error('[RegionOCR] 识别失败:', error);
      pendingOCRResolverRef.current && pendingOCRResolverRef.current('');
    } finally {
      pendingOCRResolverRef.current = null;
      setIsSelectingRegion(false);
      setSelectionRect(null);
      selectionStartRef.current = null;
    }
  }, [selectionRect]);

  // 处理原生组件就绪事件
  const handleReady = useCallback((event) => {
    console.log('[FluidInfiniteCanvasScreenNative] 原生组件就绪', event.nativeEvent);
    setIsLoading(false);
    console.log('🔍 [画布] handleReady 简化版本执行完成');
  }, []);

  const createNewCanvas = useCallback(async () => {
    try {
      if (!noteObjectId) {
        console.error('[FluidInfiniteCanvasScreenNative] 缺少noteId，无法创建画布');
        Alert.alert('错误', '无法创建画布：缺少笔记ID');
        return;
      }

      console.log('[FluidInfiniteCanvasScreenNative] 创建新画布，ID:', noteObjectId.toString());

      const now = new Date();
      const newCanvas = {
        _id: noteObjectId, // 使用字符串，Realm 会自动转换为 ObjectId
        title: title || '新建画布',
        content: '',
        type: 'canvas',
        canvasStyle: canvasStyle || 'white',
        viewport: JSON.stringify({ x: 0, y: 0, scale: 1 }),
        strokeData: JSON.stringify([]),
        is_deleted: false,
        is_synced: false,
        created_at: now,
        updated_at: now,
      };

      const realm = await realmService.getRealm();
      let savedNote;
      realm.write(() => {
        // 使用'modified'模式：如果Note已存在则更新，不存在则创建
        savedNote = realm.create('Note', newCanvas, 'modified');
      });

      dispatch(addNote(savedNote));
      console.log('[FluidInfiniteCanvasScreenNative] 新画布创建成功，ID:', savedNote._id.toString(), '类型:', savedNote.type);

      // 设置画布样式状态
      const finalCanvasStyle = canvasStyle || 'white';
      setLoadedCanvasStyle(finalCanvasStyle);
      console.log('🎨 [画布] 新画布样式已设置:', finalCanvasStyle);
      // 同步创建原生侧永久存储记录（参考PDF实现）
      try {
        // 确保 permanentStorageBridge 已初始化
        if (permanentStorageBridge && typeof permanentStorageBridge.createNote === 'function') {
          await permanentStorageBridge.createNote({
            _id: noteObjectId,
            type: 'canvas',
            title: title || '新建画布',
            canvasStyle: canvasStyle || 'white',
            viewport: { x: 0, y: 0, scale: 1 },
            strokeData: JSON.stringify([]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          console.log('[Canvas] 原生永久存储创建成功');
        } else {
          console.warn('[Canvas] permanentStorageBridge 未初始化或方法不存在，跳过原生存储');
        }
      } catch (e) {
        console.warn('[Canvas] 原生永久存储创建失败，将继续使用本地数据库:', e?.message || e);
        // 不抛出错误，继续执行
      }
      setIsLoading(false);
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 创建新画布失败:', error);
      Alert.alert('错误', '创建画布失败');
      setError('创建画布失败');
      setIsLoading(false);
    }
  }, [noteObjectId, title, canvasStyle, dispatch]);

  const loadCanvas = useCallback(async (id) => {
    console.log('🔍 [画布] loadCanvas 被调用，ID:', id);
    setIsLoading(true);
    setError(null);

    try {
      console.log('[FluidInfiniteCanvasScreenNative] 加载画布ID:', id);

      const realm = await realmService.getRealm();
      const canvas = realm.objectForPrimaryKey('Note', id);

      if (canvas) {
        // 解析viewport数据
        let parsedViewport = { x: 0, y: 0, scale: 1 };
        if (canvas.viewport) {
          try {
            parsedViewport = typeof canvas.viewport === 'string'
              ? JSON.parse(canvas.viewport)
              : canvas.viewport;
          } catch (err) {
            console.warn('[FluidInfiniteCanvasScreenNative] 解析viewport失败:', err);
          }
        }

          console.log('📖📖📖 [FluidInfiniteCanvasScreenNative] 恢复画布状态:', {
            hasStrokeData: !!canvas.strokeData,
            strokeDataLength: canvas.strokeData?.length || 0,
            viewport: parsedViewport,
            canvasStyle: canvas.canvasStyle,
          });

        // 加载保存的样式
        console.log('🎨 [画布] 开始加载样式，当前样式:', canvas.canvasStyle, '类型:', typeof canvas.canvasStyle);
        if (canvas.canvasStyle) {
          console.log('🎨 [画布] 设置样式为:', canvas.canvasStyle);
          setLoadedCanvasStyle(canvas.canvasStyle);
          console.log('🎨 [画布] 样式已加载:', canvas.canvasStyle);
        } else {
          // 如果没有保存的样式，使用默认样式
          console.log('🎨 [画布] 没有保存的样式，使用默认样式: white');
          setLoadedCanvasStyle('white');
          console.log('🎨 [画布] 使用默认样式: white');
        }

        // 强制同步样式到数据库（如果样式不一致）
        if (canvas.canvasStyle && canvas.canvasStyle !== 'white') {
          console.log('🎨 [画布] 检测到非默认样式，强制同步到数据库');
          try {
            realm.write(() => {
              canvas.canvasStyle = canvas.canvasStyle; // 确保样式一致
            });
            console.log('🎨 [画布] 样式已同步到数据库');
          } catch (e) {
            console.warn('🎨 [画布] 样式同步失败:', e);
          }
        }

        // 加载视口状态
        setViewport(parsedViewport);
        viewportRef.current = parsedViewport;

        // ✅ 数据导入将在handleReady中进行，不使用setTimeout
        console.log('ℹ️ [FluidInfiniteCanvasScreenNative] 数据将在handleReady中导入');
      } else {
        console.warn('[FluidInfiniteCanvasScreenNative] 未找到画布:', id);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[FluidInfiniteCanvasScreenNative] 加载画布失败:', err);
      setError('加载画布失败');
      setIsLoading(false);
    }
  }, []);

  const handleViewportChange = useCallback((event) => {
    const { x, y, scale } = event.nativeEvent;

    // 使用ref存储，避免触发重渲染
    viewportRef.current = { x, y, scale };

    // 只在scale变化时更新zoomLevel（用于指示器）
    setZoomLevel(scale);

    // 清除之前的自动隐藏定时器
    if (zoomDebounceTimer.current) {
      clearTimeout(zoomDebounceTimer.current);
    }
  }, []);

  const scheduleCanvasExport = useCallback((delay = 300) => {
    if (!canvasViewRef.current || !noteObjectId) {
      return;
    }

    if (exportDebounceTimerRef.current) {
      clearTimeout(exportDebounceTimerRef.current);
      exportDebounceTimerRef.current = null;
    }

    exportDebounceTimerRef.current = setTimeout(() => {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
          [noteObjectId.toString()]
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 导出调度失败:', err);
      } finally {
        exportDebounceTimerRef.current = null;
      }
    }, delay);
  }, [noteObjectId]);

  const handleStrokeCommitted = useCallback((event) => {
    const strokeData = event.nativeEvent;
    console.log('[FluidInfiniteCanvasScreenNative] 笔迹提交:', strokeData.strokeId);

    if (noteObjectId && strokeData) {
      setHasUnsavedChanges(true);
      scheduleCanvasExport(250);
    }


    if (strokeData.strokeId) {
      setStrokeOrder(prevOrder => [...prevOrder, strokeData.strokeId]);
    }

    toolbarPropsBase.scheduleRecognition({
      selection: 'latest',
      scope: 'latest',
      strokeId: strokeData.strokeId,
      strokeIds: strokeData.strokeId ? [strokeData.strokeId] : [],
      count: 1,
    });
  }, [noteObjectId, scheduleCanvasExport, toolbarPropsBase]);

  // 处理导出完成事件
  const handleExportComplete = useCallback(async (event) => {
    const { canvasId, data, success } = event.nativeEvent;

    if (!success) {
      console.error('[FluidInfiniteCanvasScreenNative] 导出失败');
      return;
    }

    try {
      console.log('[FluidInfiniteCanvasScreenNative] 导出成功，保存数据到数据库...', {
        canvasId,
        dataLength: data?.length || 0,
        dataType: typeof data,
        viewport: viewportRef.current,

      });

      // 转换 canvasId 为 ObjectId
      let canvasObjectId;
      if (typeof canvasId === 'string') {
        canvasObjectId = canvasId;
      } else {
        console.error('[FluidInfiniteCanvasScreenNative] 无效的 canvasId:', canvasId);
        canvasObjectId = null;
      }

      if (!canvasObjectId) {
        console.error('[FluidInfiniteCanvasScreenNative] 无法解析 canvasId');
        return;
      }

      const realm = await realmService.getRealm();

      realm.write(() => {
        let note = realm.objectForPrimaryKey('Note', canvasObjectId);

        if (!note) {
          note = realm.create('Note', {
            _id: canvasObjectId,
            title: title || '无限画布',
            type: 'canvas',
            created_at: new Date(),
            updated_at: new Date(),
          }, 'modified');
        }

        const strokeDataStr = typeof data === 'string' ? data : JSON.stringify(data);

        Object.assign(note, {
          strokeData: strokeDataStr,
          viewport: JSON.stringify(viewportRef.current),
          canvasStyle: loadedCanvasStyle,
          updated_at: new Date(),
        });
      });

      setHasUnsavedChanges(false);
      console.log('[FluidInfiniteCanvasScreenNative] 画布数据已保存到数据库');

      // 同步写入原生永久存储（参考PDF实现）
      try {
        // 确保 permanentStorageBridge 已初始化
        if (permanentStorageBridge && typeof permanentStorageBridge.updateNote === 'function') {
          await permanentStorageBridge.updateNote(canvasObjectId, {
            type: 'canvas',
            strokeData: typeof data === 'string' ? data : JSON.stringify(data),
            viewport: viewportRef.current,
            canvasStyle: loadedCanvasStyle,
            updated_at: new Date().toISOString(),
          });
          console.log('[Canvas] 原生永久存储更新成功');
        } else {
          console.warn('[Canvas] permanentStorageBridge 未初始化或方法不存在，跳过原生存储更新');
        }
      } catch (e) {
        console.warn('[Canvas] 原生永久存储更新失败，将继续使用本地数据库', e?.message || e);
      }
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 保存画布数据失败:', error);
      console.error('[FluidInfiniteCanvasScreenNative] 错误堆栈:', error.stack);
    }
  }, [loadedCanvasStyle, title]);

  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText: legacyText, text, confidence } = event.nativeEvent;
    const recognizedText = typeof text === 'string' && text.length > 0 ? text : legacyText;
    console.log('[FluidInfiniteCanvasScreenNative] 手写识别结果:', { strokeId, recognizedText, confidence });

    // 显示识别结果
    if (recognizedText && confidence > 0.7) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '添加文本', onPress: () => addTextElement(recognizedText) },
      ]);
    }
  }, []);


  // 处理套索选择事件
  const handleStrokesSelected = useCallback(async (event) => {
    const { strokeIds } = event.nativeEvent;
    if (strokeIds && strokeIds.length > 0) {
      console.log(`[Lasso] 选中 ${strokeIds.length} 个笔迹`);
      const recognizedText = await onRequestStrokeRecognition('lasso', strokeIds);
      if (recognizedText) {
        // 在这里处理识别出的文本，例如显示在UI上或插入到画布中
        Alert.alert('识别结果', recognizedText);
      }
    } else {
      console.log('[Lasso] 没有选中任何笔迹');
    }
  }, [onRequestStrokeRecognition]);

  const addTextElement = useCallback((text) => {
    // 将识别文本添加为画布文本元素（命令ID: 2）
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          INFINITE_CANVAS_COMMANDS.ADD_TEXT_ELEMENT,
          [text]
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 添加文本命令失败:', err);
      }
    }
  }, []);

  const handleGoBack = useCallback(async () => {
    try {
      // ✅ 退出前先保存画布数据
      console.log('🔄 [画布] 退出前保存数据...');

      if (canvasViewRef.current && noteObjectId) {
        // 导出画布数据
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
          [noteObjectId.toString()]
        );

        // 等待一小段时间让导出命令完成
        await new Promise(resolve => setTimeout(resolve, 300));

        // 强制刷新Realm数据到磁盘
        await realmService.forceFlush();
        console.log('✅ [画布] 退出前保存完成');
      }
    } catch (error) {
      console.error('[画布] 退出前保存失败:', error);
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
  }, [fromFileHistory, navigation, noteObjectId]);

  const handleSave = useCallback(async () => {
    console.log('[FluidInfiniteCanvasScreenNative] 保存画布...');
    try {
      if (!canvasViewRef.current || !noteObjectId) {
        throw new Error('原生组件或画布ID无效');
      }

      // 立即保存画布元数据
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', noteObjectId.toString());
        if (note) {
          Object.assign(note, {
            viewport: JSON.stringify(viewportRef.current),
            canvasStyle: loadedCanvasStyle,
            updated_at: new Date().toISOString(),
          });
        }
      });

      // 通过原生模块导出画布数据（命令ID: 3）
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(canvasViewRef.current),
        INFINITE_CANVAS_COMMANDS.EXPORT_CANVAS,
        [noteObjectId.toString()]
      );

      setHasUnsavedChanges(false);
      console.log('[FluidInfiniteCanvasScreenNative] 画布保存成功');

      return { success: true };
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [noteObjectId, loadedCanvasStyle]);

  // ✅ 使用退出前自动保存Hook
  useAutoSaveOnExit(
    async () => {
      if (canvasViewRef.current && noteObjectId) {
        console.log('[画布] 应用生命周期触发保存');
        await handleSave();
      }
    },
    [noteObjectId]
  );

  const handleUndo = useCallback(() => {
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          INFINITE_CANVAS_COMMANDS.UNDO,
          []
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 撤销命令失败:', err);
      }
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          INFINITE_CANVAS_COMMANDS.REDO,
          []
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 重做命令失败:', err);
      }
    }
  }, []);


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
        title={title || '无限画布（原生）'}
        showExternalToolbar={true}
        toolbarProps={{
          ...toolbarPropsBase,
          onRequestRegionOCR,
          onRequestStrokeRecognition,
        }}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
      >
        {console.log('🎨 [画布] 渲染原生组件，样式配置:', { background: loadedCanvasStyle })}
        <RNNativeInfiniteCanvasView
          ref={canvasViewRef}
          style={styles.canvasView}
          pointerEvents="auto"
          canvasId={noteObjectId ? noteObjectId.toString() : ''}
          viewport={viewport}
          styleConfig={{ background: loadedCanvasStyle || 'white' }}
          currentTool={toolbarPropsBase.currentTool}
          currentColor={toolbarPropsBase.currentColor}
          currentStrokeWidth={toolbarPropsBase.currentStrokeWidth}
          onReady={handleReady}
          onViewportChange={handleViewportChange}
          onStrokeCommitted={handleStrokeCommitted}
          onHandwritingRecognized={handleHandwritingRecognized}
          onStrokesSelected={handleStrokesSelected}
          onExportComplete={handleExportComplete}
          onError={(event) => {
            console.error('[FluidInfiniteCanvasScreenNative] 原生组件错误:', event.nativeEvent);
            setError(event.nativeEvent.message || '原生组件发生错误');
            setIsLoading(false);
          }}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            console.log('[FluidInfiniteCanvasScreenNative] 原生组件 onLayout，size:', width, 'x', height);
          }}
        />

        {/* 加载覆盖层 */}
        {isLoading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <LoadingIndicator message="加载原生无限画布..." />
          </View>
        )}

        {/* 错误覆盖层 */}
        {error && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* 区域选择 Overlay（本地OCR） */}
        {isSelectingRegion && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.08)' }]}
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
                <Text
                  onPress={cancelRegionSelection}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.text }}
                >取消</Text>
                <Text
                  onPress={confirmRegionOCR}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.primary, fontWeight: '600', borderLeftWidth: 1, borderLeftColor: colors.border }}
                >识别</Text>
              </View>
            </View>
          </View>
        )}
      </ViewerLayout>

      {/* 缩放指示器 - 在ViewerLayout外部 */}
      <ZoomIndicator
        scale={zoomLevel}
        visible={Math.abs(zoomLevel - 1.0) > 0.01}
        autoHideDelay={3000}
        topOffset={60}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasView: {
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

export default FluidInfiniteCanvasScreenNative;
