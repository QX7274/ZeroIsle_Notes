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
// 已移除 offlineStorageService 导入，现在直接使用 realmService
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

// 导入内存监控服务
import MemoryMonitor from '../../services/memory/MemoryMonitor';

// 页面分隔符组件
const PageSeparator = ({ colors }) => (
  <View style={styles.separatorContainer}>
    {/* 左侧横线 */}
    <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
    
    {/* 居中的三个圆点 */}
    <View style={styles.dotsContainer}>
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
    </View>
    
    {/* 右侧横线 */}
    <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
  </View>
);

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
  
  const noteViewRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  // ========== 使用原生工具栏桥接Hook ==========
  const toolbarProps = useNativeToolbarBridge(noteViewRef, 'paged', {
    currentPage,
    totalPages,
  });
  
  // 确保toolbarProps有默认值，防止undefined错误
  const safeToolbarProps = toolbarProps || {
    currentTool: 'pen',
    currentColor: '#000000',
    currentStrokeWidth: 2,
    onToolChange: () => {},
    onColorChange: () => {},
    onStrokeWidthChange: () => {},
    onUndo: () => {},
    onRedo: () => {},
    onClear: () => {},
    canUndo: false,
    canRedo: false,
    onAIToolSelect: () => {},
    onBookmarkAdd: () => {},
    onBookmarkList: () => {},
    onBookmarkNavigate: () => {},
    onTextAdd: () => {},
    onImageUpload: () => {},
    onLassoSelect: () => {},
    onLassoComplete: () => {},
    currentPage: currentPage,
  };
  const zoomHideTimerRef = useRef(null);
  
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
  
  // ✅ 监听屏幕焦点变化，失焦时保存数据
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[SkiaPagedCanvasScreenNative] 屏幕获得焦点');
    });
    
    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[SkiaPagedCanvasScreenNative] 屏幕失去焦点，保存数据...');
      
      // 失焦时保存数据
      if (hasUnsavedChanges && noteViewRef.current && noteId) {
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(noteViewRef.current),
            '3', // exportNote 命令
            [noteId]
          );
          
          realmService.getRealm().then(realm => {
            realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              Object.assign(note, {
                currentPage: currentPage,
                totalPages: totalPages,
                scale: zoomLevel,
                updated_at: new Date().toISOString(),
              });
            }
          }).catch(err => {
            console.error('[SkiaPagedCanvasScreenNative] 失焦保存失败:', err);
          });
          
          console.log('[SkiaPagedCanvasScreenNative] 失焦保存完成');
          });
        } catch (err) {
          console.error('[SkiaPagedCanvasScreenNative] 失焦保存失败:', err);
        }
      }
    });
    
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, hasUnsavedChanges, noteId, currentPage, totalPages, zoomLevel]);
  
  // ✅ 监听应用状态变化，应用进入后台时保存数据
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' && hasUnsavedChanges && noteViewRef.current && noteId) {
        console.log('[SkiaPagedCanvasScreenNative] 应用进入后台，立即保存数据...');
        try {
          // 先保存基本状态
          realmService.getRealm().then(realm => {
            realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              Object.assign(note, {
                currentPage: currentPage,
                totalPages: totalPages,
                scale: zoomLevel,
                updated_at: new Date().toISOString(),
              });
            }
          }).then(() => {
            // 然后保存笔迹数据
            UIManager.dispatchViewManagerCommand(
              findNodeHandle(noteViewRef.current),
              '3', // exportNote 命令
              [noteId]
            );
            console.log('[SkiaPagedCanvasScreenNative] 后台保存完成');
          });
          }).catch(err => {
            console.error('[SkiaPagedCanvasScreenNative] 后台保存失败:', err);
          });
        } catch (err) {
          console.error('[SkiaPagedCanvasScreenNative] 后台保存失败:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [hasUnsavedChanges, noteId, currentPage, totalPages, zoomLevel]);
  
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
          noteId: noteId
        });
      } else {
        console.log('[SkiaPagedCanvasScreenNative] 跳过添加到文件历史记录:', { 
          isMounted, 
          noteId, 
          effectiveTitle, 
          hasFileHistoryService: !!fileHistoryService,
          hasAddFile: !!(fileHistoryService && fileHistoryService.addFile)
        });
      }
    } catch (e) {
      console.error('[SkiaPagedCanvasScreenNative] 添加到文件历史记录失败:', e);
    }
    
    return () => {
      isMounted = false;
    };
  }, [noteId, title]);
  
  // ✅ 自动保存机制 - 当有未保存的更改时
  useEffect(() => {
    if (hasUnsavedChanges && noteId && noteViewRef.current) {
      // 防抖：3秒后自动保存
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      autoSaveTimerRef.current = setTimeout(async () => {
        console.log('[SkiaPagedCanvasScreenNative] 自动保存触发...');
        try {
          // 先保存笔记元数据，确保基本状态被保存
          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', noteId);
            if (note) {
              Object.assign(note, {
                currentPage: currentPage,
                totalPages: totalPages,
                scale: zoomLevel,
                updated_at: new Date().toISOString(),
              });
            }
          });
          
          // 然后保存笔迹数据
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(noteViewRef.current),
            '3', // exportNote 命令
            [noteId]
          );
          
          setHasUnsavedChanges(false);
          console.log('[SkiaPagedCanvasScreenNative] 自动保存完成');
        } catch (err) {
          console.error('[SkiaPagedCanvasScreenNative] 自动保存失败:', err);
          // 即使自动保存失败，也尝试保存基本状态
          try {
            const realm = await realmService.getRealm();
            realm.write(() => {
              const note = realm.objectForPrimaryKey('Note', noteId);
              if (note) {
                Object.assign(note, {
                  currentPage: currentPage,
                  totalPages: totalPages,
                  scale: zoomLevel,
                  updated_at: new Date().toISOString(),
                });
              }
            });
            console.log('[SkiaPagedCanvasScreenNative] 基本状态保存成功');
          } catch (fallbackErr) {
            console.error('[SkiaPagedCanvasScreenNative] 基本状态保存也失败:', fallbackErr);
          }
        }
      }, 3000);
    }
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, noteId, currentPage, totalPages, zoomLevel]);
  
  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      // 组件卸载时，如果有未保存的更改，立即保存
      if (hasUnsavedChanges && noteViewRef.current && noteId) {
        console.log('[SkiaPagedCanvasScreenNative] 组件卸载，保存数据...');
        try {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(noteViewRef.current),
            '3', // exportNote 命令
            [noteId]
          );
        } catch (err) {
          console.error('[SkiaPagedCanvasScreenNative] 卸载保存失败:', err);
        }
      }
      
      // 停止内存监控
      MemoryMonitor.stopMonitoring();
    };
  }, [hasUnsavedChanges, noteId]);
  
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
  const handleReady = useCallback((event) => {
    const { totalPages: readyTotalPages, currentPage: readyCurrentPage } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 原生组件就绪', { totalPages: readyTotalPages, currentPage: readyCurrentPage });
    
    // 验证页数是否合理
    const validTotalPages = (readyTotalPages && readyTotalPages > 0 && readyTotalPages < 100) ? readyTotalPages : 1;
    setTotalPages(validTotalPages);
    
    // currentPage从原生来是0-based，UI显示需要1-based
    const validCurrentPage = (readyCurrentPage >= 0 && readyCurrentPage < validTotalPages) ? readyCurrentPage : 0;
    setCurrentPage(validCurrentPage + 1);
    
    setIsLoading(false);
  }, []);
  
  const createNewNote = useCallback(async () => {
    try {
      if (!noteId) {
        console.error('[SkiaPagedCanvasScreenNative] 缺少noteId，无法创建笔记');
        Alert.alert('错误', '无法创建笔记：缺少笔记ID');
        return;
      }

      console.log('[SkiaPagedCanvasScreenNative] 创建新笔记，ID:', noteId);

      const newNote = {
        _id: noteId,
        id: noteId,
        title: title || '新建笔记',
        content: '',
        type: 'paged_note',
        noteType: 'paged_note',
        file_type: 'paged_note',
        noteStyle: noteStyle || 'blank',
        pages: [{ content: '', pageNumber: 1, strokes: [] }],
        totalPages: 1,
        currentPage: 1,
        scale: 1.0,
        scrollPosition: { x: 0, y: 0 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        file_uri: `paged_note://${noteId}`,
        uri: `paged_note://${noteId}`
      };

      const realm = await realmService.getRealm();
      let result;
      realm.write(() => {
        result = realm.create('Note', newNote);
      });
      if (result.success) {
        const savedNote = result.note || newNote;
        dispatch(addNote(savedNote));
        console.log('[SkiaPagedCanvasScreenNative] 新笔记创建成功');
        setIsLoading(false);
      } else {
        throw new Error('保存新笔记失败');
      }
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
          hasStrokeData: !!noteData.strokeData
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
        
        // 如果有保存的笔迹数据，通知原生组件导入
        setTimeout(() => {
          if (noteViewRef.current) {
            if (noteData.strokeData) {
              console.log('[SkiaPagedCanvasScreenNative] 导入保存的笔迹数据...');
              try {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(noteViewRef.current),
                  '12', // importNote 命令
                  [noteData.strokeData]
                );
              } catch (err) {
                console.error('[SkiaPagedCanvasScreenNative] 导入笔迹失败:', err);
              }
            } else {
              // 没有笔迹数据，恢复页面位置
              if (noteData.currentPage !== undefined && noteData.currentPage > 0) {
                UIManager.dispatchViewManagerCommand(
                  findNodeHandle(noteViewRef.current),
                  '7', // setCurrentPage 命令
                  [noteData.currentPage - 1] // 转换为0-based
                );
              }
            }
          }
        }, 500);
      }
      
      setTimeout(() => setIsLoading(false), 500);
    } catch (err) {
      console.error('[SkiaPagedCanvasScreenNative] 加载笔记失败:', err);
      setError('加载笔记失败');
      setIsLoading(false);
    }
  }, []);
  
  const handleStrokeCommitted = useCallback((event) => {
    console.log('[SkiaPagedCanvasScreenNative] 笔迹提交:', event.nativeEvent.strokeId);
    
    // 标记有未保存的更改
    setHasUnsavedChanges(true);
    
    // 触发手写识别（命令ID: 1）
    if (noteViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '1', // recognizeHandwriting 命令
          [event.nativeEvent.strokeId]
        );
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 手写识别命令失败:', err);
      }
    }
  }, []);
  
  const handleHandwritingRecognized = useCallback((event) => {
    const { strokeId, recognizedText, confidence } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 手写识别结果:', { strokeId, recognizedText, confidence });
    
    // 显示识别结果
    if (recognizedText && confidence > 0.7) {
      Alert.alert('识别结果', `识别文本: ${recognizedText}\n置信度: ${(confidence * 100).toFixed(1)}%`, [
        { text: '取消', style: 'cancel' },
        { text: '插入文本', onPress: () => insertRecognizedText(recognizedText) }
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
      console.log('[SkiaPagedCanvasScreenNative] 导出成功，保存数据到数据库...');
      
      // 解析导出的数据
      const noteData = JSON.parse(data);
      
      // 保存到数据库
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', exportedNoteId);
        if (note) {
          Object.assign(note, {
            strokeData: data, // 保存完整的笔迹数据JSON
            currentPage: noteData.currentPage,
            totalPages: noteData.totalPages,
            scale: noteData.scale,
            updated_at: new Date().toISOString(),
          });
        }
      });
      
      console.log('[SkiaPagedCanvasScreenNative] 笔迹数据已保存到数据库');
    } catch (error) {
      console.error('[SkiaPagedCanvasScreenNative] 保存笔迹数据失败:', error);
    }
  }, []);
  
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
  
  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);
  
  const handleSave = useCallback(async () => {
    console.log('[SkiaPagedCanvasScreenNative] 保存笔记...');
    try {
      if (!noteViewRef.current || !noteId) {
        throw new Error('原生组件或笔记ID无效');
      }

      // 立即保存笔记元数据（当前页、缩放等状态）
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', noteId);
        if (note) {
          Object.assign(note, {
            currentPage: currentPage,
            totalPages: totalPages,
            scale: zoomLevel,
            updated_at: new Date().toISOString(),
          });
        }
      });
      
      // 通过原生模块导出笔迹数据（命令ID: 3）
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(noteViewRef.current),
        '3', // exportNote 命令
        [noteId]
      );
      
      // 清除未保存标记
      setHasUnsavedChanges(false);
      console.log('[SkiaPagedCanvasScreenNative] 笔记保存成功');
      
      return { success: true };
    } catch (error) {
      console.error('[SkiaPagedCanvasScreenNative] 保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [noteId, currentPage, totalPages, zoomLevel]);
  
  const handleUndo = useCallback(() => {
    if (noteViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '4', // undo 命令
          []
        );
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 撤销命令失败:', err);
      }
    }
  }, []);
  
  const handleRedo = useCallback(() => {
    if (noteViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '5', // redo 命令
          []
        );
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 重做命令失败:', err);
      }
    }
  }, []);
  
  const handlePageControlPress = useCallback((page) => {
    setCurrentPage(page);
    if (noteViewRef.current) {
      try {
        UIManager.dispatchViewManagerCommand(
          findNodeHandle(noteViewRef.current),
          '7', // setCurrentPage 命令
          [page]
        );
      } catch (err) {
        console.error('[SkiaPagedCanvasScreenNative] 设置页面命令失败:', err);
      }
    }
  }, []);
  
  const handleZoomChange = useCallback((event) => {
    const { scale, isScaling } = event.nativeEvent;
    console.log('[SkiaPagedCanvasScreenNative] 缩放变化:', scale, '是否正在缩放:', isScaling);
    
    setZoomLevel(scale || 1.0);
    
    // ✅ 根据原生事件控制缩放指示器显示/隐藏
    if (isScaling === true) {
      // 缩放开始或进行中，显示指示器
      setShowZoomIndicator(true);
      // 清除之前的隐藏定时器
      if (zoomHideTimerRef.current) {
        clearTimeout(zoomHideTimerRef.current);
        zoomHideTimerRef.current = null;
      }
    } else if (isScaling === false) {
      // 缩放结束，立即显示最终比例，然后延迟隐藏
      setShowZoomIndicator(true);
      // 清除之前的隐藏定时器
      if (zoomHideTimerRef.current) {
        clearTimeout(zoomHideTimerRef.current);
      }
      // 设置新的隐藏定时器（1秒后自动隐藏，比之前更快）
      zoomHideTimerRef.current = setTimeout(() => {
        setShowZoomIndicator(false);
        zoomHideTimerRef.current = null;
      }, 1000); // 1秒后自动隐藏，提高响应性
    }
  }, []);
  
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
  
  const handleGoBackWrapper = useCallback(() => {
    if (fromFileHistory) {
      navigation.navigate('Home');
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [fromFileHistory, navigation]);
  
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
          ...safeToolbarProps,
          currentPage: currentPage,
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
          storageKey="native_paged_note_pagecontrol_pos"
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
  // 页面分隔符样式
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  separatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});

export default SkiaPagedCanvasScreenNative;

