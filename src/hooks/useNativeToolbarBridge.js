/**
 * 原生工具栏桥接 Hook
 * 
 * 统一管理工具栏操作到原生组件的桥接逻辑
 * 消除重复代码，一次编写，所有原生页面通用
 */

import { useCallback, useMemo, useState, useRef } from 'react';
import { UIManager, findNodeHandle, Alert } from 'react-native';
import { NATIVE_COMMANDS, TOOL_TYPES, CLEAR_TYPES } from '../config/nativeCommandMap';

/**
 * 分发命令到原生组件
 * @param {Object} viewRef - 原生视图引用
 * @param {number} commandId - 命令ID
 * @param {Array} args - 命令参数
 */
const dispatchCommand = (viewRef, commandId, args = []) => {
  if (!viewRef || !viewRef.current) {
    console.warn('[useNativeToolbarBridge] 原生视图引用无效');
    return;
  }

  if (commandId === null || commandId === undefined) {
    console.warn('[useNativeToolbarBridge] 命令ID无效，可能该操作不被支持');
    return;
  }

  try {
    const nodeHandle = findNodeHandle(viewRef.current);
    if (!nodeHandle) {
      console.error('[useNativeToolbarBridge] 无法获取原生视图句柄');
      return;
    }

    UIManager.dispatchViewManagerCommand(
      nodeHandle,
      commandId.toString(),
      args
    );
  } catch (error) {
    console.error('[useNativeToolbarBridge] 命令分发失败:', error);
  }
};

/**
 * 原生工具栏桥接 Hook
 * 
 * @param {Object} nativeViewRef - 原生视图引用
 * @param {string} viewType - 视图类型: 'pdf' | 'paged' | 'infinite'
 * @param {Object} options - 配置选项
 * @returns {Object} 工具栏 props
 */
export const useNativeToolbarBridge = (nativeViewRef, viewType, options = {}) => {
  const {
    onSaveSuccess,
    onSaveError,
    currentPage = 1,
    totalPages = 1,
  } = options;

  // 获取对应的命令映射
  const commands = NATIVE_COMMANDS[viewType];
  if (!commands) {
    console.error(`[useNativeToolbarBridge] 未知的视图类型: ${viewType}`);
    // 返回默认命令映射，防止完全失败
    return {
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
  }

  // 状态管理
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);

  // 历史记录追踪（用于撤销/重做按钮状态）
  const historyStack = useRef({ undoStack: [], redoStack: [] });

  /**
   * 处理工具变化
   */
  const handleToolChange = useCallback((tool) => {
    const toolType = typeof tool === 'string' ? tool : tool.type || 'pen';
    console.log(`[useNativeToolbarBridge:${viewType}] 工具变化:`, tool);

    setCurrentTool(toolType);

    // 发送基础工具类型
    dispatchCommand(
      nativeViewRef,
      commands.setDrawingTool || commands.setCurrentTool,
      [toolType]
    );

    // 处理工具特殊配置
    if (tool && typeof tool === 'object' && commands.setToolConfig) {
      const config = {};

      if (tool.type === 'highlighter') {
        config.opacity = tool.opacity || 0.4;
        config.blendMode = tool.blendMode || 'multiply';
      } else if (tool.type === 'laser') {
        config.fadeOutDuration = tool.fadeOutDuration || 3000;
        config.animationSteps = tool.animationSteps || 60;
      } else if (tool.type === 'eraser') {
        config.size = tool.size || 16;
        config.mode = tool.mode || 'erase';
      } else if (tool.type === 'lasso') {
        config.mode = tool.mode || 'select';
        config.allowMove = tool.allowMove !== false;  // 默认允许移动
        config.allowCopy = tool.allowCopy !== false;  // 默认允许复制
        config.allowDelete = tool.allowDelete !== false;  // 默认允许删除
      } else if (tool.type === 'shape') {
        config.shape = tool.shape || 'line';
      }

      // 如果有配置，发送到原生层
      if (Object.keys(config).length > 0) {
        console.log(`[useNativeToolbarBridge:${viewType}] 工具配置:`, config);
        dispatchCommand(
          nativeViewRef,
          commands.setToolConfig,
          [JSON.stringify(config)]
        );
      }
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 处理颜色变化
   */
  const handleColorChange = useCallback((color) => {
    const colorValue = typeof color === 'string' ? color : color.hex || '#000000';
    console.log(`[useNativeToolbarBridge:${viewType}] 颜色变化:`, colorValue);

    setCurrentColor(colorValue);
    dispatchCommand(
      nativeViewRef,
      commands.setDrawingColor || commands.setCurrentColor,
      [colorValue]
    );
  }, [nativeViewRef, commands, viewType]);

  /**
   * 处理笔触粗细变化
   */
  const handleStrokeWidthChange = useCallback((width) => {
    const widthValue = Number(width) || 2;
    console.log(`[useNativeToolbarBridge:${viewType}] 粗细变化:`, widthValue);

    setCurrentStrokeWidth(widthValue);
    dispatchCommand(
      nativeViewRef,
      commands.setDrawingWidth || commands.setCurrentStrokeWidth,
      [widthValue]
    );
  }, [nativeViewRef, commands, viewType]);

  /**
   * 撤销
   */
  const handleUndo = useCallback(() => {
    console.log(`[useNativeToolbarBridge:${viewType}] 撤销`);

    if (commands.undo) {
      dispatchCommand(nativeViewRef, commands.undo, []);
      // 更新历史状态（简化版，实际应该监听原生事件）
      setCanUndo(historyStack.current.undoStack.length > 1);
      setCanRedo(true);
    } else {
      console.warn(`[useNativeToolbarBridge:${viewType}] 该视图不支持撤销操作`);
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 重做
   */
  const handleRedo = useCallback(() => {
    console.log(`[useNativeToolbarBridge:${viewType}] 重做`);

    if (commands.redo) {
      dispatchCommand(nativeViewRef, commands.redo, []);
      // 更新历史状态
      setCanRedo(historyStack.current.redoStack.length > 1);
      setCanUndo(true);
    } else {
      console.warn(`[useNativeToolbarBridge:${viewType}] 该视图不支持重做操作`);
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 清除 - 多级菜单
   */
  const handleClear = useCallback((clearType) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 清除类型:`, clearType);

    if (!clearType) {
      // 显示第一级菜单：选择清除类型
      Alert.alert(
        '清除',
        '选择清除类型：',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '按范围清除',
            onPress: () => showRangeClearOptions()
          },
          {
            text: '清除选中内容',
            onPress: () => confirmClear(CLEAR_TYPES.SELECTED)
          }
        ]
      );
      return;
    }

    // 第二级：范围选择
    const showRangeClearOptions = () => {
      Alert.alert(
        '清除范围',
        '选择范围：',
        [
          { text: '返回', style: 'cancel' },
          {
            text: '当前视图',
            onPress: () => confirmClear(CLEAR_TYPES.CURRENT_VIEW)
          },
          {
            text: '当前页面',
            onPress: () => confirmClear(CLEAR_TYPES.CURRENT_PAGE)
          },
          {
            text: '整个文档',
            onPress: () => confirmClear(CLEAR_TYPES.ENTIRE_DOCUMENT),
            style: 'destructive'
          }
        ]
      );
    };

    // 第三级：危险操作确认
    const confirmClear = (type) => {
      if (type === CLEAR_TYPES.ENTIRE_DOCUMENT || type === CLEAR_TYPES.CURRENT_PAGE) {
        const message = type === CLEAR_TYPES.ENTIRE_DOCUMENT 
          ? '确定要清除整个文档吗？此操作无法撤销。'
          : '确定要清除当前页面吗？此操作无法撤销。';
        
        Alert.alert(
          '确认',
          message,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '确定',
              style: 'destructive',
              onPress: () => executeClear(type)
            }
          ]
        );
      } else {
        executeClear(type);
      }
    };

    // 执行清除
    const executeClear = (type) => {
      if (commands.clear) {
        dispatchCommand(nativeViewRef, commands.clear, [type]);
        setCanUndo(true);
        setCanRedo(false);
      } else {
        console.warn(`[useNativeToolbarBridge:${viewType}] 该视图不支持清除操作`);
      }
    };

    // 如果直接传入了清除类型，执行确认流程
    if (clearType) {
      confirmClear(clearType);
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * AI工具选择（仅传递到上层，不直接操作原生层）
   */
  const handleAIToolSelect = useCallback((tool) => {
    console.log(`[useNativeToolbarBridge:${viewType}] AI工具:`, tool.id);
    // AI处理在JS层完成，这里只是占位
  }, [viewType]);

  /**
   * 书签添加
   */
  const handleBookmarkAdd = useCallback((bookmark) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 添加书签:`, bookmark);
    // 书签功能在JS层处理
  }, [viewType]);

  /**
   * 书签列表
   */
  const handleBookmarkList = useCallback(() => {
    console.log(`[useNativeToolbarBridge:${viewType}] 显示书签列表`);
    // 书签功能在JS层处理
  }, [viewType]);

  /**
   * 书签导航
   */
  const handleBookmarkNavigate = useCallback((bookmark) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 导航到书签:`, bookmark);
    
    // 如果有页码跳转命令，执行跳转
    if (bookmark.pageNumber && commands.goToPage) {
      dispatchCommand(
        nativeViewRef,
        commands.goToPage,
        [bookmark.pageNumber - 1] // 转换为0-based索引
      );
    } else if (bookmark.pageNumber && commands.setCurrentPage) {
      dispatchCommand(
        nativeViewRef,
        commands.setCurrentPage,
        [bookmark.pageNumber - 1]
      );
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 文本添加
   */
  const handleTextAdd = useCallback((textConfig) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 添加文本:`, textConfig);

    if (commands.addTextAnnotation) {
      // PDF 文本注释
      dispatchCommand(
        nativeViewRef,
        commands.addTextAnnotation,
        [textConfig.text]
      );
    } else if (commands.insertText) {
      // 分页笔记文本插入
      dispatchCommand(
        nativeViewRef,
        commands.insertText,
        [textConfig.text]
      );
    } else if (commands.addTextElement) {
      // 无限画布文本元素
      dispatchCommand(
        nativeViewRef,
        commands.addTextElement,
        [textConfig.text]
      );
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 图片上传
   */
  const handleImageUpload = useCallback((imageInfo) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 上传图片:`, imageInfo);
    // 图片处理逻辑（如果原生支持）
  }, [viewType]);

  /**
   * 套索选择
   */
  const handleLassoSelect = useCallback((selectionPath) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 套索选择:`, selectionPath);
    
    if (commands.lassoSelect) {
      dispatchCommand(
        nativeViewRef,
        commands.lassoSelect,
        [JSON.stringify(selectionPath)]
      );
    }
  }, [nativeViewRef, commands, viewType]);

  /**
   * 套索完成
   */
  const handleLassoComplete = useCallback((selectedItems) => {
    console.log(`[useNativeToolbarBridge:${viewType}] 套索完成，选中项:`, selectedItems);
    
    if (commands.lassoComplete) {
      dispatchCommand(
        nativeViewRef,
        commands.lassoComplete,
        [JSON.stringify(selectedItems)]
      );
    }
  }, [nativeViewRef, commands, viewType]);

  // 组装工具栏 props
  const toolbarProps = useMemo(() => {
    const props = {
      // 工具切换
      onToolChange: handleToolChange,
      onColorChange: handleColorChange,
      onStrokeWidthChange: handleStrokeWidthChange,

      // 编辑操作
      onUndo: handleUndo,
      onRedo: handleRedo,
      onClear: handleClear,
      canUndo: canUndo,
      canRedo: canRedo,

      // AI工具
      onAIToolSelect: handleAIToolSelect,

      // 书签
      onBookmarkAdd: handleBookmarkAdd,
      onBookmarkList: handleBookmarkList,
      onBookmarkNavigate: handleBookmarkNavigate,
      currentPage: currentPage,

      // 文本和图片
      onTextAdd: handleTextAdd,
      onImageUpload: handleImageUpload,

      // 套索工具
      onLassoSelect: handleLassoSelect,
      onLassoComplete: handleLassoComplete,

      // 当前状态（保持向后兼容）
      initialTool: currentTool,
      initialColor: currentColor,
      initialStrokeWidth: currentStrokeWidth,
      // 添加当前状态属性供原生组件使用
      currentTool: currentTool,
      currentColor: currentColor,
      currentStrokeWidth: currentStrokeWidth,
    };
    
    // 确保所有必需的属性都存在
    console.log(`[useNativeToolbarBridge:${viewType}] 工具栏属性初始化:`, {
      currentTool: props.currentTool,
      currentColor: props.currentColor,
      currentStrokeWidth: props.currentStrokeWidth,
    });
    
    return props;
  }, [
    handleToolChange,
    handleColorChange,
    handleStrokeWidthChange,
    handleUndo,
    handleRedo,
    handleClear,
    canUndo,
    canRedo,
    handleAIToolSelect,
    handleBookmarkAdd,
    handleBookmarkList,
    handleBookmarkNavigate,
    handleTextAdd,
    handleImageUpload,
    handleLassoSelect,
    handleLassoComplete,
    currentTool,
    currentColor,
    currentStrokeWidth,
    currentPage,
  ]);

  return toolbarProps;
};


