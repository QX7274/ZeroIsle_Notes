/**
 * 手写引擎适配器
 * 将AllInOneToolbar的绘图工具映射到手写引擎
 */

import React, { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import UniversalHandwritingEngine, { AdvancedStrokeData } from './UniversalHandwritingEngine';
import { HandwritingPersistence } from '../../services/handwriting/HandwritingPersistence';
import handwritingFileManager from '../../services/handwriting/HandwritingFileManager';
import {
  mapToolToEngine,
  processHighlighterColor,
  calculateActualStrokeWidth,
  getToolOpacity,
  getScreenConfig
} from '../../config/handwritingConfig';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// 创建持久化管理器实例
const handwritingPersistence = new HandwritingPersistence();

/**
 * 手写适配器组件
 */
const HandwritingAdapter = forwardRef(({
  // 从AllInOneToolbar传入的工具状态
  currentTool = { type: 'pen' },
  currentColor = '#000000',
  currentStrokeWidth = 2,

  // 文档信息
  documentId,
  documentType = 'note',
  pageNumber = 1,

  // 文件信息（新增）
  filePath,
  fileName,

  // 回调函数
  onStrokeStart,
  onStrokeUpdate,
  onStrokeEnd,
  onStrokesChange,

  // 配置选项
  enablePressure = true,
  enableTilt = true,
  fingerRejection = false,
  isFingerMode = false,
  scale = 1,
  pdfBounds = null,
  // 直接写入模式
  directWriteMode = false,
  
  // 调试选项
  debugMode = false,
  forceStylusMode = false,

  // 样式
  style,
  zIndex = 1000,

  // 控制显示
  visible = true,
  disabled = false
}, ref) => {
  
  const handwritingEngineRef = useRef(null);
  const [strokes, setStrokes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isHandwritingMode, setIsHandwritingMode] = useState(false);

  // 映射工具类型
  const getMappedTool = useCallback((toolConfig) => {
    try {
      return mapToolToEngine(toolConfig);
    } catch (error) {
      console.error('HandwritingAdapter: 工具映射失败:', error);
      return 'pen';
    }
  }, []);

  // 获取实际颜色（处理荧光笔）
  const getActualColor = useCallback((toolConfig, color) => {
    try {
      const toolType = typeof toolConfig === 'string' ? toolConfig : toolConfig?.type;

      if (toolType === 'highlighter') {
        return processHighlighterColor(color);
      }

      return color;
    } catch (error) {
      console.error('HandwritingAdapter: 颜色处理失败:', error);
      return color;
    }
  }, []);

  // 获取实际粗细（处理不同工具）
  const getActualStrokeWidth = useCallback((toolConfig, width) => {
    try {
      return calculateActualStrokeWidth(toolConfig, width);
    } catch (error) {
      console.error('HandwritingAdapter: 粗细计算失败:', error);
      return width || 2;
    }
  }, []);

  // 获取透明度
  const getOpacity = useCallback((toolConfig) => {
    try {
      // 检查 getToolOpacity 函数是否存在
      if (typeof getToolOpacity !== 'function') {
        console.error('HandwritingAdapter: getToolOpacity 函数未定义');
        return 1.0;
      }
      
      // 确保 toolConfig 是有效的
      if (!toolConfig) {
        console.warn('HandwritingAdapter: 工具配置为空，使用默认透明度');
        return 1.0;
      }
      
      return getToolOpacity(toolConfig);
    } catch (error) {
      console.error('HandwritingAdapter: 透明度获取失败:', error);
      return 1.0;
    }
  }, []);

  // 处理笔迹开始
  const handleStrokeStart = useCallback((stroke, detection) => {
    try {
      console.log('HandwritingAdapter: 开始绘制', {
        tool: getMappedTool(currentTool),
        isStylus: detection?.isStylus
      });

      onStrokeStart?.(stroke, detection);
    } catch (error) {
      console.error('HandwritingAdapter: 处理笔迹开始失败:', error);
    }
  }, [currentTool, getMappedTool, onStrokeStart]);

  // 处理笔迹更新
  const handleStrokeUpdate = useCallback((stroke, detection) => {
    try {
      onStrokeUpdate?.(stroke, detection);
    } catch (error) {
      console.error('HandwritingAdapter: 处理笔迹更新失败:', error);
    }
  }, [onStrokeUpdate]);

  // 处理笔迹结束
  const handleStrokeEnd = useCallback((stroke) => {
    try {
      console.log('HandwritingAdapter: 完成绘制', { pointsCount: stroke?.points?.length || 0 });
      onStrokeEnd?.(stroke);
    } catch (error) {
      console.error('HandwritingAdapter: 处理笔迹结束失败:', error);
    }
  }, [onStrokeEnd]);

  // 自动保存定时器引用
  const saveTimeoutRef = useRef(null);
  const lastSaveTimeRef = useRef(0);
  const pendingSaveRef = useRef(false);

  // 处理笔迹变化
  const handleStrokesChange = useCallback((newStrokes) => {
    try {
      if (!Array.isArray(newStrokes)) {
        console.warn('HandwritingAdapter: 无效的笔迹数据，应为数组');
        return;
      }

      setStrokes(newStrokes);
      onStrokesChange?.(newStrokes);

      // 智能自动保存
      if (documentId && newStrokes.length > 0) {
        // 清除之前的保存定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // 计算保存延迟（根据笔迹数量和时间间隔动态调整）
        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTimeRef.current;
        const strokeCount = newStrokes.length;

        let saveDelay;
        if (strokeCount < 5) {
          saveDelay = 2000; // 少量笔迹，延迟2秒
        } else if (strokeCount < 20) {
          saveDelay = 1500; // 中等笔迹，延迟1.5秒
        } else {
          saveDelay = 1000; // 大量笔迹，延迟1秒
        }

        // 如果距离上次保存时间太短，增加延迟
        if (timeSinceLastSave < 3000) {
          saveDelay = Math.max(saveDelay, 3000 - timeSinceLastSave);
        }

        const saveHandwriting = async () => {
          if (pendingSaveRef.current) {
            console.log('HandwritingAdapter: 保存正在进行中，跳过');
            return;
          }

          pendingSaveRef.current = true;

          try {
            // 优先使用文件管理器保存（如果有文件信息）
            if (filePath && fileName) {
              await handwritingFileManager.saveHandwritingForFile(
                filePath,
                fileName,
                pageNumber,
                newStrokes,
                {
                  documentType,
                  timestamp: Date.now(),
                  autoSave: true,
                  tool: currentTool?.type || 'pen',
                  color: currentColor,
                  strokeWidth: currentStrokeWidth
                }
              );
              console.log(`HandwritingAdapter: 文件关联保存成功 - ${fileName} 页面${pageNumber}: ${newStrokes.length} 个笔迹`);
            } else {
              // 回退到传统保存方式
              const handwritingData = {
                strokes: newStrokes,
                metadata: {
                  fileType: documentType || 'note',
                  documentId: documentId || 'unknown',
                  pageNumber: pageNumber || 1,
                  timestamp: Date.now(),
                  autoSave: true,
                  tool: currentTool?.type || 'pen',
                  color: currentColor,
                  strokeWidth: currentStrokeWidth
                }
              };
              await handwritingPersistence.saveHandwriting(handwritingData);
              console.log(`HandwritingAdapter: 传统保存成功 ${newStrokes.length} 个笔迹`);
            }

            lastSaveTimeRef.current = Date.now();
          } catch (error) {
            console.error('HandwritingAdapter: 自动保存失败:', error);
            // 保存失败时，稍后重试
            setTimeout(() => {
              if ((filePath && fileName) || documentId) {
                saveHandwriting();
              }
            }, 5000);
          } finally {
            pendingSaveRef.current = false;
          }
        };

        // 设置延迟保存
        saveTimeoutRef.current = setTimeout(saveHandwriting, saveDelay);
      }
    } catch (error) {
      console.error('HandwritingAdapter: 处理笔迹变化失败:', error);
    }
  }, [documentId, documentType, pageNumber, onStrokesChange]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清理保存定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 如果有未保存的数据，立即保存
      if (documentId && strokes.length > 0 && !pendingSaveRef.current) {
        const handwritingData = {
          strokes: strokes,
          metadata: {
            fileType: documentType || 'note',
            documentId: documentId || 'unknown',
            pageNumber: pageNumber || 1,
            timestamp: Date.now(),
            finalSave: true
          }
        };
        handwritingPersistence.saveHandwriting(handwritingData).catch(error => {
          console.error('HandwritingAdapter: 最终保存失败:', error);
        });
      }
    };
  }, [documentId, strokes, documentType, pageNumber]);

  // 加载已有的手写数据
  const loadHandwritingData = useCallback(async () => {
    if (!documentId && !(filePath && fileName)) return;

    setIsLoading(true);
    try {
      let handwritingData = null;

      // 优先从文件管理器加载
      if (filePath && fileName) {
        handwritingData = await handwritingFileManager.loadHandwritingForFile(filePath, fileName, pageNumber);
        if (handwritingData) {
          console.log(`HandwritingAdapter: 从文件关联加载 - ${fileName} 页面${pageNumber}: ${handwritingData.strokes.length} 个笔迹`);
        }
      }

      // 如果文件管理器没有数据，尝试传统方式
      if (!handwritingData && documentId) {
        handwritingData = await handwritingPersistence.loadHandwriting(documentId);
        if (handwritingData) {
          console.log(`HandwritingAdapter: 从传统方式加载: ${handwritingData.strokes.length} 个笔迹`);

          // 过滤当前页面的笔迹（如果有分页）
          if (documentType === 'pdf' && pageNumber && handwritingData.strokes) {
            handwritingData.strokes = handwritingData.strokes.filter(stroke =>
              stroke.metadata?.pageNumber === pageNumber
            );
          }
        }
      }

      if (handwritingData && handwritingData.strokes) {
        if (handwritingEngineRef.current && typeof handwritingEngineRef.current.setStrokes === 'function') {
          handwritingEngineRef.current.setStrokes(handwritingData.strokes);
        } else {
          console.warn('HandwritingAdapter: setStrokes方法不可用，延迟设置');
          // 延迟设置，等待引擎初始化
          setTimeout(() => {
            if (handwritingEngineRef.current && typeof handwritingEngineRef.current.setStrokes === 'function') {
              handwritingEngineRef.current.setStrokes(handwritingData.strokes);
            }
          }, 100);
        }
        setStrokes(handwritingData.strokes);
        onStrokesChange?.(handwritingData.strokes);
      } else {
        console.log('HandwritingAdapter: 未找到手写数据，从空白开始');
        setStrokes([]);
        if (handwritingEngineRef.current && typeof handwritingEngineRef.current.setStrokes === 'function') {
          handwritingEngineRef.current.setStrokes([]);
        }
      }
    } catch (error) {
      console.error('HandwritingAdapter: 加载手写数据失败:', error);
      setStrokes([]);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, filePath, fileName, pageNumber, documentType, onStrokesChange]);

  // 初始化时加载数据
  useEffect(() => {
    if (visible && (documentId || (filePath && fileName))) {
      loadHandwritingData();
    }
  }, [visible, documentId, filePath, fileName, pageNumber, loadHandwritingData]);

  // 暴露的方法
  useImperativeHandle(ref, () => ({
    // 清空所有笔迹
    clearStrokes: () => {
      if (handwritingEngineRef.current) {
        handwritingEngineRef.current.clearStrokes();
      }
    },
    
    // 撤销最后一笔
    undoLastStroke: () => {
      if (handwritingEngineRef.current) {
        handwritingEngineRef.current.undoLastStroke();
      }
    },
    
    // 获取当前笔迹
    getStrokes: () => {
      return handwritingEngineRef.current?.getStrokes() || [];
    },
    
    // 设置笔迹
    setStrokes: (newStrokes) => {
      if (handwritingEngineRef.current) {
        handwritingEngineRef.current.setStrokes(newStrokes);
      }
      setStrokes(newStrokes);
    },
    
    // 导出SVG
    exportSVG: () => {
      return handwritingEngineRef.current?.exportSVG() || [];
    },
    
    // 获取边界
    getBounds: () => {
      return handwritingEngineRef.current?.getBounds() || null;
    },
    
    // 重新加载数据
    reload: () => {
      loadHandwritingData();
    },
    
    // 保存数据
    save: async () => {
      if (documentId && strokes.length > 0) {
        try {
          const handwritingData = {
            strokes: strokes,
            metadata: {
              fileType: documentType || 'note',
              documentId: documentId || 'unknown',
              pageNumber: pageNumber || 1,
              timestamp: Date.now()
            }
          };
          await handwritingPersistence.saveHandwriting(handwritingData);
          return true;
        } catch (error) {
          console.error('HandwritingAdapter: 手动保存失败:', error);
          return false;
        }
      }
      return true;
    }
  }), [documentId, documentType, pageNumber, strokes, loadHandwritingData]);

  // 如果不可见或禁用，不渲染
  if (!visible || disabled) {
    return null;
  }

  // 计算当前工具的实际参数
  let mappedTool, actualColor, actualStrokeWidth, actualOpacity;

  try {
    mappedTool = getMappedTool(currentTool);
    actualColor = getActualColor(currentTool, currentColor);
    actualStrokeWidth = getActualStrokeWidth(currentTool, currentStrokeWidth);
    actualOpacity = getOpacity(currentTool);
  } catch (error) {
    console.error('HandwritingAdapter: 计算工具参数失败:', error);
    // 使用默认值
    mappedTool = 'pen';
    actualColor = currentColor || '#000000';
    actualStrokeWidth = currentStrokeWidth || 2;
    actualOpacity = 1.0;
  }

  try {
    // 确保所有必要的依赖项都已正确加载
    if (typeof UniversalHandwritingEngine === 'undefined') {
      console.error('HandwritingAdapter: UniversalHandwritingEngine 组件未定义');
      return null;
    }
    
    // 确保 AdvancedStrokeData 已正确导入
    if (typeof AdvancedStrokeData === 'undefined') {
      console.error('HandwritingAdapter: AdvancedStrokeData 类未定义');
      return null;
    }
    
    return (
      <View style={[
        styles.container,
        style,
        {
          zIndex,
          // 根据模式决定事件处理 - 手指模式时禁用手写，笔模式时启用
          pointerEvents: isFingerMode ? 'none' : 'box-none'
        }
      ]}>
        <UniversalHandwritingEngine
          ref={handwritingEngineRef}
          width={screenWidth}
          height={screenHeight}
          tool={mappedTool}
          strokeColor={actualColor}
          strokeWidth={actualStrokeWidth}
          opacity={actualOpacity}
          enablePressure={enablePressure}
          enableTilt={enableTilt}
          isManualFingerMode={isFingerMode}
          initialScale={scale}
          pdfBounds={pdfBounds}
          originalTool={currentTool}
          documentId={documentId}
          documentType={documentType}
          pageNumber={pageNumber}
          filePath={filePath}
          fileName={fileName}
          onStrokeStart={handleStrokeStart}
          onStrokeUpdate={handleStrokeUpdate}
          onStrokeEnd={handleStrokeEnd}
          onStrokesChange={handleStrokesChange}
          disabled={isLoading}
          style={[styles.handwritingEngine, {
            // 根据模式决定事件处理 - 修复UI阻塞问题
            pointerEvents: isFingerMode ? 'none' : 'auto',
            // 直接写入模式下优化渲染
            opacity: directWriteMode ? 1 : 1,
            zIndex: directWriteMode ? 1001 : 1000
          }]}
        />

        {/* 加载指示器可以在这里添加 */}
      </View>
    );
  } catch (error) {
    console.error('HandwritingAdapter: 渲染失败:', error);
    return null;
  }
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // pointerEvents 动态控制，不在这里设置
  },
  handwritingEngine: {
    flex: 1,
  },
});

HandwritingAdapter.displayName = 'HandwritingAdapter';

export default HandwritingAdapter;
