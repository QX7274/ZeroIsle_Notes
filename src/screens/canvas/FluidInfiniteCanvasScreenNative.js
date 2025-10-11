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
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  AppState,
} from 'react-native';

const RNNativeInfiniteCanvasView = requireNativeComponent('NativeInfiniteCanvasView');
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';
import { useDispatch } from 'react-redux';
import { addNote } from '../../redux/slices/notesSlice';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';

// 导入原生工具栏桥接Hook
import { useNativeToolbarBridge } from '../../hooks/useNativeToolbarBridge';
import ZoomIndicator from '../../components/common/ZoomIndicator';

const FluidInfiniteCanvasScreenNative = ({ route, navigation }) => {
  const { noteId, title, canvasStyle, createNew, fromFileHistory } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [loadedCanvasStyle, setLoadedCanvasStyle] = useState(canvasStyle || 'white');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const canvasViewRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarProps = useNativeToolbarBridge(canvasViewRef, 'infinite');
  const zoomDebounceTimer = useRef(null);
  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });
  
  // 初始化画布
  useEffect(() => {
    console.log('[FluidInfiniteCanvasScreenNative] 初始化原生无限画布', { noteId, title, canvasStyle, createNew });
    
    if (createNew && noteId) {
      // 创建新画布并保存
      createNewCanvas();
    } else if (noteId) {
      loadCanvas(noteId);
    }
  }, [noteId, createNew]);
  
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
          noteId: noteId
        });
      } else {
        console.log('[FluidInfiniteCanvasScreenNative] 跳过添加到文件历史记录:', { 
          isMounted, 
          noteId, 
          effectiveTitle, 
          hasFileHistoryService: !!fileHistoryService,
          hasAddFile: !!(fileHistoryService && fileHistoryService.addFile)
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
    if (hasUnsavedChanges && noteId && canvasViewRef.current) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(async () => {
        console.log('[FluidInfiniteCanvasScreenNative] 自动保存触发...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            '3', // exportCanvas
            [noteId]
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
  }, [hasUnsavedChanges, noteId]);
  
  // ✅ 监听应用状态变化，应用进入后台时保存数据
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'background' && hasUnsavedChanges && canvasViewRef.current && noteId) {
        console.log('[FluidInfiniteCanvasScreenNative] 应用进入后台，立即保存数据...');
        try {
          // 先保存基本状态
          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              Object.assign(note, {
                viewport: viewportRef.current,
                canvasStyle: loadedCanvasStyle,
                updated_at: new Date().toISOString(),
              });
            }
          }).then(() => {
            // 然后保存画布数据
            UIManager.dispatchViewManagerCommand(
              findNodeHandle(canvasViewRef.current),
              '3', // exportCanvas 命令
              [noteId]
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
  }, [hasUnsavedChanges, noteId, loadedCanvasStyle]);
  
  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && canvasViewRef.current && noteId) {
        console.log('[FluidInfiniteCanvasScreenNative] 组件卸载，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            '3', // exportCanvas
            [noteId]
          );
        } catch (err) {
          console.error('[FluidInfiniteCanvasScreenNative] 卸载保存失败:', err);
        }
      }
    };
  }, [hasUnsavedChanges, noteId]);
  
  // ✅ 监听屏幕焦点变化，失焦时保存数据
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', async () => {
      if (hasUnsavedChanges && canvasViewRef.current && noteId) {
        console.log('[FluidInfiniteCanvasScreenNative] 屏幕失去焦点，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(canvasViewRef.current),
            '3', // exportCanvas
            [noteId]
          );
          
          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              Object.assign(note, {
                viewport: viewportRef.current,
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
  }, [navigation, hasUnsavedChanges, noteId]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (zoomDebounceTimer.current) {
        clearTimeout(zoomDebounceTimer.current);
      }
    };
  }, []);
  
  // 处理原生组件就绪事件
  const handleReady = useCallback((event) => {
    console.log('[FluidInfiniteCanvasScreenNative] 原生组件就绪', event.nativeEvent);
    setIsLoading(false);
  }, []);
  
  const createNewCanvas = useCallback(async () => {
    try {
      if (!noteId) {
        console.error('[FluidInfiniteCanvasScreenNative] 缺少noteId，无法创建画布');
        Alert.alert('错误', '无法创建画布：缺少笔记ID');
        return;
      }

      console.log('[FluidInfiniteCanvasScreenNative] 创建新画布，ID:', noteId);

      const newCanvas = {
        _id: noteId,
        id: noteId,
        title: title || '新建画布',
        content: '',
        type: 'canvas',
        noteType: 'canvas',
        file_type: 'canvas',
        content_type: 'canvas',
        canvasStyle: canvasStyle || 'white',
        viewport: { x: 0, y: 0, scale: 1 },
        strokes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: 0,
        is_deleted: false,
        is_synced: false,
        is_offline: true,
        user_id: 'current_user',
        file_uri: `canvas://${noteId}`,
        uri: `canvas://${noteId}`
      };

      const realm = await realmService.getRealm();
      let result;
      realm.write(() => {
        result = realm.create('Note', newCanvas);
      });
      if (result.success) {
        const savedNote = result.note || newCanvas;
        dispatch(addNote(savedNote));
        console.log('[FluidInfiniteCanvasScreenNative] 新画布创建成功');
        setIsLoading(false);
      } else {
        throw new Error('保存新画布失败');
      }
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 创建新画布失败:', error);
      Alert.alert('错误', '创建画布失败');
      setError('创建画布失败');
      setIsLoading(false);
    }
  }, [noteId, title, canvasStyle, dispatch]);
  
  const loadCanvas = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[FluidInfiniteCanvasScreenNative] 加载画布ID:', id);
      const realm = await realmService.getRealm();
      const canvas = realm.objectForPrimaryKey('Note', id);
      
      if (canvas) {
        console.log('[FluidInfiniteCanvasScreenNative] 恢复画布状态:', {
          hasStrokeData: !!canvas.strokeData,
          viewport: canvas.viewport
        });
        
        // 加载保存的样式
        if (canvas.canvasStyle) {
          setLoadedCanvasStyle(canvas.canvasStyle);
        }
        
        // 加载视口状态
        if (canvas.viewport) {
          setViewport(canvas.viewport);
          viewportRef.current = canvas.viewport;
        }
        
        // 如果有保存的笔迹数据，通知原生组件导入
        setTimeout(() => {
          if (canvasViewRef.current && canvas.strokeData) {
            console.log('[FluidInfiniteCanvasScreenNative] 导入保存的笔迹数据...');
            try {
              UIManager.dispatchViewManagerCommand(
                findNodeHandle(canvasViewRef.current),
                '6', // importCanvas 命令
                [canvas.strokeData]
              );
            } catch (err) {
              console.error('[FluidInfiniteCanvasScreenNative] 导入笔迹失败:', err);
            }
          }
        }, 500);
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
  
  const handleStrokeCommitted = useCallback((event) => {
    console.log('[FluidInfiniteCanvasScreenNative] 笔迹提交:', event.nativeEvent.strokeId);
    
    // 标记有未保存的更改
    setHasUnsavedChanges(true);
    
    // 触发手写识别（命令ID: 1）
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          '1', // recognizeHandwriting 命令
          [event.nativeEvent.strokeId]
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 手写识别命令失败:', err);
      }
    }
  }, []);
  
  // 处理导出完成事件
  const handleExportComplete = useCallback(async (event) => {
    const { canvasId, data, success } = event.nativeEvent;
    
    if (!success) {
      console.error('[FluidInfiniteCanvasScreenNative] 导出失败');
      return;
    }
    
    try {
      console.log('[FluidInfiniteCanvasScreenNative] 导出成功，保存数据到数据库...');
      
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', canvasId);
        if (note) {
          Object.assign(note, {
            strokeData: data,
            viewport: viewportRef.current,
            updated_at: new Date().toISOString(),
          });
        }
      });
      
      setHasUnsavedChanges(false);
      console.log('[FluidInfiniteCanvasScreenNative] 画布数据已保存到数据库');
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 保存画布数据失败:', error);
    }
  }, []);
  
  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText, confidence } = event.nativeEvent;
    console.log('[FluidInfiniteCanvasScreenNative] 手写识别结果:', { strokeId, recognizedText, confidence });
    
    // 显示识别结果
    if (recognizedText && confidence > 0.7) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '添加文本', onPress: () => addTextElement(recognizedText) }
      ]);
    }
  }, []);
  
  const addTextElement = useCallback((text) => {
    // 将识别文本添加为画布文本元素（命令ID: 2）
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          '2', // addTextElement 命令
          [text]
        );
      } catch (err) {
        console.error('[FluidInfiniteCanvasScreenNative] 添加文本命令失败:', err);
      }
    }
  }, []);
  
  const handleGoBack = useCallback(() => {
    if (fromFileHistory) {
      navigation.navigate('Home');
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [fromFileHistory, navigation]);
  
  const handleSave = useCallback(async () => {
    console.log('[FluidInfiniteCanvasScreenNative] 保存画布...');
    try {
      if (!canvasViewRef.current || !noteId) {
        throw new Error('原生组件或画布ID无效');
      }

      // 立即保存画布元数据
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', noteId);
        if (note) {
          Object.assign(note, {
            viewport: viewportRef.current,
            canvasStyle: loadedCanvasStyle,
            updated_at: new Date().toISOString(),
          });
        }
      });
      
      // 通过原生模块导出画布数据（命令ID: 3）
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(canvasViewRef.current),
        '3', // exportCanvas 命令
        [noteId]
      );
      
      setHasUnsavedChanges(false);
      console.log('[FluidInfiniteCanvasScreenNative] 画布保存成功');
      
      return { success: true };
    } catch (error) {
      console.error('[FluidInfiniteCanvasScreenNative] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [noteId, loadedCanvasStyle]);
  
  const handleUndo = useCallback(() => {
    if (canvasViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(canvasViewRef.current),
          '4', // undo 命令
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
          '5', // redo 命令
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
          ...toolbarProps,
        }}
        showHistoryNavigation={true}
        historyNavigationHeight={30}
        noteId={noteId}
        navigation={navigation}
      >
        <RNNativeInfiniteCanvasView
          ref={canvasViewRef}
          style={styles.canvasView}
          pointerEvents="auto"
          canvasId={noteId}
          viewport={viewport}
          styleConfig={{ background: loadedCanvasStyle }}
          currentTool={toolbarProps.currentTool}
          currentColor={toolbarProps.currentColor}
          currentStrokeWidth={toolbarProps.currentStrokeWidth}
          onReady={handleReady}
          onViewportChange={handleViewportChange}
          onStrokeCommitted={handleStrokeCommitted}
          onHandwritingRecognized={handleHandwritingRecognized}
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

