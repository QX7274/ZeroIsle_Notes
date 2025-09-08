import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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

import documentConversionService from '../../services/document/documentConversionService';

import HandwritingAdapter from '../../components/handwriting/HandwritingAdapter';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import PageControl from '../../components/viewer/PageControl';
import pdfDirectWriteService from '../../services/pdf/PDFDirectWriteService';

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
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PDFViewer = ({ route, navigation }) => {
  const { uri, title, noteId, fromFileHistory, fileType } = route.params || {};
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfSource, setPdfSource] = useState(null);
  const [localFilePath, setLocalFilePath] = useState(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');



  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [scale, setScale] = useState(1);
  const [pdfLayout, setPdfLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });



  // 文档转换状态
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionMessage, setConversionMessage] = useState('');
  const [originalFileInfo, setOriginalFileInfo] = useState(null);

  // AllInOneToolbar状态
  const [currentDrawingTool, setCurrentDrawingTool] = useState({ type: 'pen' });
  const [currentDrawingColor, setCurrentDrawingColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isFingerMode, setIsFingerMode] = useState(true); // 默认为手指模式

  // 引用
  const pdfRef = useRef(null);
  const handwritingAdapterRef = useRef(null);
  const conversionAbortController = useRef(null);

  // AllInOneToolbar处理函数
  const handleToolChange = useCallback((tool) => {
    console.log('PDFViewer: 接收到工具变化:', tool, typeof tool);
    console.log('PDFViewer: 工具详细信息:', JSON.stringify(tool));

    // 确保工具格式正确
    let normalizedTool;
    if (typeof tool === 'string') {
      normalizedTool = { type: tool };
    } else if (tool && typeof tool === 'object' && tool.type) {
      normalizedTool = tool;
    } else {
      console.warn('PDFViewer: 无效的工具格式，使用默认工具');
      normalizedTool = { type: 'pen' };
    }

    setCurrentDrawingTool(normalizedTool);
    console.log('PDFViewer: 工具切换到:', normalizedTool);
  }, []);

  const handleColorChange = useCallback((color) => {
    console.log('PDFViewer: 接收到颜色变化:', color);
    setCurrentDrawingColor(color);
    console.log('PDFViewer: 颜色切换到:', color);
  }, []);

  const handleStrokeWidthChange = useCallback((width) => {
    console.log('PDFViewer: 接收到粗细变化:', width);
    setCurrentStrokeWidth(width);
    console.log('PDFViewer: 笔迹粗细切换到:', width);
  }, []);

  const handleUndo = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.undoLastStroke();
      }
    } catch (error) {
      console.error('PDFViewer: 撤销操作失败:', error);
    }
  }, []);

  const handleRedo = useCallback(() => {
    try {
      // TODO: 实现重做功能
      console.log('PDFViewer: 重做功能待实现');
    } catch (error) {
      console.error('PDFViewer: 重做操作失败:', error);
    }
  }, []);

  const handleClear = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.clearStrokes();
      }
    } catch (error) {
      console.error('PDFViewer: 清空操作失败:', error);
    }
  }, []);

  const handleModeToggle = useCallback((newMode) => {
    setIsFingerMode(newMode);
    console.log('PDFViewer: 模式切换到:', newMode ? '手指模式' : '手写笔模式');
  }, []);

  // 存储待保存的笔迹数据
  const pendingStrokes = useRef([]);

  const handleStrokesChange = useCallback(async (strokes) => {
    try {
      if (!Array.isArray(strokes)) {
        console.warn('PDFViewer: 无效的笔迹数据');
        return;
      }

      setCanUndo(strokes.length > 0);
      setCanRedo(false);
      console.log(`PDFViewer: 笔迹更新，当前数量: ${strokes.length}`);

      // 性能优化：只存储笔迹数据，不立即写入PDF
      pendingStrokes.current = strokes;

      // 确保PDF路径已设置（为后续保存做准备）
      if (!pdfDirectWriteService.currentPDFPath) {
        const pdfPath = localFilePath || (pdfSource && pdfSource.uri);
        if (pdfPath) {
          pdfDirectWriteService.setCurrentPDF(pdfPath);
          console.log('PDFViewer: 设置PDF路径:', pdfPath);
        }
      }
    } catch (error) {
      console.error('PDFViewer: 处理笔迹变化失败:', error);
    }
  }, [localFilePath, pdfSource]);

  // 批量保存所有笔迹到PDF
  const savePendingStrokes = useCallback(async () => {
    try {
      if (pendingStrokes.current.length === 0) {
        console.log('PDFViewer: 没有待保存的笔迹');
        return;
      }

      console.log(`PDFViewer: 开始批量保存 ${pendingStrokes.current.length} 个笔迹`);

      // 确保PDF路径已设置
      if (!pdfDirectWriteService.currentPDFPath) {
        const pdfPath = localFilePath || (pdfSource && pdfSource.uri);
        if (pdfPath) {
          pdfDirectWriteService.setCurrentPDF(pdfPath);
        } else {
          console.warn('PDFViewer: 无法获取PDF路径，跳过保存');
          return;
        }
      }

      // 清空之前的注释，重新添加所有笔迹
      pdfDirectWriteService.clearAnnotations();

      // 批量添加所有笔迹
      for (const stroke of pendingStrokes.current) {
        if (stroke && stroke.points && stroke.points.length > 0) {
          // 确保笔迹有正确的格式
          const formattedStroke = {
            points: stroke.points,
            color: stroke.color || stroke.style?.color || '#000000',
            width: stroke.width || stroke.style?.width || 2,
            opacity: stroke.opacity || stroke.style?.opacity || 1,
            id: stroke.id || `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };

          await pdfDirectWriteService.addStrokeToPage(currentPage, formattedStroke);
        }
      }

      // 一次性保存到PDF
      const success = await pdfDirectWriteService.saveToPDF();
      if (success) {
        console.log('PDFViewer: 批量保存完成，笔迹已写入PDF文件');
        // 清空待保存队列
        pendingStrokes.current = [];
      } else {
        console.error('PDFViewer: 批量保存失败');
      }
    } catch (error) {
      console.error('PDFViewer: 批量保存失败:', error);
    }
  }, [currentPage, localFilePath, pdfSource]);

  // 组件卸载时保存待保存的笔迹
  useEffect(() => {
    return () => {
      if (pendingStrokes.current.length > 0) {
        console.log('PDFViewer: 组件卸载，保存待保存的笔迹');
        savePendingStrokes();
      }
    };
  }, [savePendingStrokes]);

  /**
   * 内存清理函数
   */
  const cleanupMemory = () => {
    try {
      // 取消正在进行的转换
      if (conversionAbortController.current) {
        conversionAbortController.current.abort();
        conversionAbortController.current = null;
      }

      // 清理状态
      setIsConverting(false);
      setConversionProgress(0);
      setConversionMessage('');

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      console.log('PDFViewer: 内存清理完成');
    } catch (error) {
      console.warn('PDFViewer: 内存清理时出错:', error);
    }
  };

  /**
   * 获取文件扩展名
   */
  const getFileExtension = (filename) => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  };

  /**
   * 生成缓存文件路径
   */
  const getCacheFilePath = (originalUri) => {
    const hash = originalUri.replace(/[^a-zA-Z0-9]/g, '_');
    return `${RNFS.DocumentDirectoryPath}/converted_cache/${hash}.pdf`;
  };

  /**
   * 检查缓存文件是否存在
   */
  const checkCacheExists = async (originalUri) => {
    try {
      const cachePath = getCacheFilePath(originalUri);
      const exists = await RNFS.exists(cachePath);

      if (exists) {
        const stats = await RNFS.stat(cachePath);
        console.log('PDFViewer: 找到缓存文件:', cachePath, '大小:', stats.size);
        return cachePath;
      }

      return null;
    } catch (error) {
      console.warn('PDFViewer: 检查缓存失败:', error);
      return null;
    }
  };

  /**
   * 保存转换后的PDF到缓存（优化内存管理）
   */
  const saveToCacheAndLocal = async (pdfBase64, originalUri, fileName) => {
    try {
      // 检查base64数据大小，防止内存溢出
      const estimatedSize = (pdfBase64.length * 3) / 4; // base64解码后的大小估算
      console.log('PDFViewer: PDF数据大小估算:', Math.round(estimatedSize / 1024 / 1024), 'MB');

      if (estimatedSize > 100 * 1024 * 1024) { // 100MB限制
        throw new Error('文件太大，无法处理');
      }

      // 确保缓存目录存在
      const cacheDir = `${RNFS.DocumentDirectoryPath}/converted_cache`;

      // 检查目录是否存在，不存在则创建
      const dirExists = await RNFS.exists(cacheDir);
      if (!dirExists) {
        await RNFS.mkdir(cacheDir);
      }

      // 分块保存到缓存，避免内存峰值
      const cachePath = getCacheFilePath(originalUri);

      // 使用流式写入，减少内存占用
      await RNFS.writeFile(cachePath, pdfBase64, 'base64');

      // 验证文件是否正确保存
      const fileExists = await RNFS.exists(cachePath);
      if (!fileExists) {
        throw new Error('缓存文件保存失败');
      }

      // 也保存到本地文档目录（用于用户访问）
      const localPath = await documentConversionService.savePDFToLocal(pdfBase64, fileName);

      console.log('PDFViewer: PDF已保存到缓存和本地');
      console.log('PDFViewer: 缓存路径:', cachePath);
      console.log('PDFViewer: 本地路径:', localPath);

      // 清理base64数据引用，帮助垃圾回收
      pdfBase64 = null;

      return { cachePath, localPath };
    } catch (error) {
      console.error('PDFViewer: 保存PDF失败:', error);

      // 清理可能的部分文件
      try {
        const cachePath = getCacheFilePath(originalUri);
        const exists = await RNFS.exists(cachePath);
        if (exists) {
          await RNFS.unlink(cachePath);
        }
      } catch (cleanupError) {
        console.warn('PDFViewer: 清理失败的缓存文件时出错:', cleanupError);
      }

      throw error;
    }
  };

  /**
   * 转换文档为PDF（优化内存管理，防止UI阻塞）
   */
  const convertDocumentToPDF = async () => {
    let timeoutId = null;
    let isComponentMounted = true;

    try {
      if (!isComponentMounted) return;

      setIsConverting(true);
      setConversionProgress(0);
      setConversionMessage('正在检查缓存...');

      console.log('PDFViewer: 开始处理文档:', uri);

      // 设置超时保护，防止无限等待
      timeoutId = setTimeout(() => {
        if (isComponentMounted) {
          setError('文档加载超时，请重试');
          setIsConverting(false);
          setIsLoading(false);
        }
      }, 120000); // 2分钟超时

      // 首先检查缓存
      const cachedPath = await checkCacheExists(uri);
      if (cachedPath && isComponentMounted) {
        console.log('PDFViewer: 使用缓存文件:', cachedPath);
        setConversionMessage('正在加载缓存文件...');
        setConversionProgress(100);

        // 清除超时
        if (timeoutId) clearTimeout(timeoutId);

        // 使用requestAnimationFrame确保UI更新不阻塞
        requestAnimationFrame(() => {
          if (isComponentMounted) {
            setPdfSource({ uri: `file://${cachedPath}`, cache: true });
            setLocalFilePath(cachedPath);
            setIsConverting(false);
            setIsLoading(false);
          }
        });
        return;
      }

      if (!isComponentMounted) return;

      // 缓存不存在，需要转换
      setConversionMessage('正在检查服务状态...');
      const healthCheck = await documentConversionService.checkServiceHealth();
      if (!healthCheck.success) {
        throw new Error('文档转换服务不可用，请检查后端服务是否启动');
      }

      if (!isComponentMounted) return;

      setConversionMessage('正在加载文档...');

      // 创建AbortController用于取消转换
      conversionAbortController.current = new AbortController();

      // 使用Promise.race确保超时控制
      const conversionPromise = documentConversionService.convertToPDF(uri, {
        method: 'upload',
        signal: conversionAbortController.current.signal,
        onProgress: (progressInfo) => {
          if (isComponentMounted) {
            console.log('PDFViewer: 转换进度:', progressInfo);
            // 使用requestAnimationFrame确保UI更新流畅
            requestAnimationFrame(() => {
              if (isComponentMounted) {
                setConversionProgress(progressInfo.progress || 0);
                // 显示加载进度而不是转换进度
                const loadingMessages = [
                  '正在加载文档...',
                  '正在处理内容...',
                  '正在生成预览...',
                  '即将完成...'
                ];
                const messageIndex = Math.floor((progressInfo.progress || 0) / 25);
                setConversionMessage(loadingMessages[messageIndex] || '正在加载...');
              }
            });
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('转换超时')), 120000);
      });

      const conversionResult = await Promise.race([conversionPromise, timeoutPromise]);

      // 清除超时
      if (timeoutId) clearTimeout(timeoutId);

      if (!isComponentMounted) return;

      if (!conversionResult.success) {
        throw new Error(conversionResult.error || '文档转换失败');
      }

      console.log('PDFViewer: 转换成功，保存到缓存和本地');
      setConversionMessage('正在保存文件...');

      // 保存到缓存和本地
      const { cachePath, localPath } = await saveToCacheAndLocal(
        conversionResult.pdfBase64,
        uri,
        title || 'document'
      );

      if (!isComponentMounted) return;

      // 使用requestAnimationFrame确保UI更新不阻塞
      requestAnimationFrame(() => {
        if (isComponentMounted) {
          setPdfSource({ uri: `file://${cachePath}`, cache: true });
          setLocalFilePath(localPath);
          setOriginalFileInfo(conversionResult.fileInfo);
          setIsConverting(false);
          setIsLoading(false);
        }
      });

      console.log('PDFViewer: 文档处理完成，使用缓存文件:', cachePath);

    } catch (error) {
      console.error('PDFViewer: 文档处理失败:', error);

      // 清除超时
      if (timeoutId) clearTimeout(timeoutId);

      if (!isComponentMounted) return;

      // 使用requestAnimationFrame确保UI更新不阻塞
      requestAnimationFrame(() => {
        if (isComponentMounted) {
          setError(error.message);
          setIsConverting(false);
          setIsLoading(false);

          // 延迟显示错误对话框，避免阻塞UI
          setTimeout(() => {
            if (isComponentMounted) {
              Alert.alert(
                '加载失败',
                error.message,
                [
                  { text: '重试', onPress: () => {
                    if (isComponentMounted) convertDocumentToPDF();
                  }},
                  { text: '取消', onPress: () => navigation.goBack() }
                ]
              );
            }
          }, 100);
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

  // 添加书签
  const handleAddBookmark = () => {
    setBookmarkVisible(true);
  };

  // 跳转到书签
  const handleJumpToBookmark = (bookmark) => {
    console.log('跳转到书签:', bookmark);
    if (bookmark.page && pdfRef.current) {
      setCurrentPage(bookmark.page);
      // 使用PDF组件的setPage方法跳转
      pdfRef.current.setPage(bookmark.page);
    }
    setBookmarkVisible(false);
  };
  const pageChangeTimeout = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ tabBarVisible: false });
  }, [navigation]);

  // 调试状态变化
  useEffect(() => {
    console.log('=== PDF状态更新 ===');
    console.log(`当前页: ${currentPage}`);
    console.log(`总页数: ${totalPages}`);
    console.log('手写模式: 通过AllInOneToolbar管理');
    console.log(`加载中: ${isLoading}`);
    console.log(`错误: ${error}`);
    console.log('=== PDF状态更新结束 ===');
  }, [currentPage, totalPages, isLoading, error]);

  useEffect(() => {
    // 移除重复的头部按钮设置，现在使用ViewerLayout统一管理

    // 加载PDF文件
    loadPDF();

    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: 'pdf',
        fileName: title,
        noteId
      });
    }

    return () => {
      // 清理内存和取消转换
      cleanupMemory();

      // 清理临时文件
      if (localFilePath && localFilePath.startsWith(RNFS.CachesDirectoryPath)) {
        RNFS.unlink(localFilePath).catch(err => console.error('清理临时文件失败:', err));
      }

      // 清除页面切换定时器
      if (pageChangeTimeout.current) {
        clearTimeout(pageChangeTimeout.current);
      }
    };
  }, []);



  const loadPDF = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTotalPages(0); // 重置页数

      // 检查URI格式
      if (!uri) {
        throw new Error('无效的PDF文件URI');
      }

      // 检查是否需要转换文档
      const fileExtension = getFileExtension(title || uri);
      const needsConversion = fileType === 'ppt' || fileType === 'word' ||
                             ['ppt', 'pptx', 'doc', 'docx'].includes(fileExtension);

      if (needsConversion) {
        console.log('PDFViewer: 检测到需要转换的文档:', { fileType, fileExtension });
        await convertDocumentToPDF();
        return;
      }

      console.log('=== 开始加载PDF文件 ===');
      console.log('URI:', uri);
      console.log('NoteId:', noteId);

      // 如果有noteId，尝试从笔记元数据中获取本地缓存路径
      if (noteId) {
        try {
          const note = await offlineStorageService.getNote(noteId);
          if (note && note.metadata) {
            const metadata = typeof note.metadata === 'string'
              ? JSON.parse(note.metadata)
              : (note.metadata || {});

            console.log('PDFViewer: 笔记元数据:', metadata);

            // 优先使用持久化的本地路径
            if (metadata.localPath) {
              const exists = await RNFS.exists(metadata.localPath);
              if (exists) {
                console.log('PDFViewer: 使用持久化的本地路径:', metadata.localPath);
                setLocalFilePath(metadata.localPath);
                setPdfSource({ uri: `file://${metadata.localPath}`, cache: true });
                setIsLoading(false);
                return;
              } else {
                console.log('PDFViewer: 持久化文件不存在:', metadata.localPath);
              }
            }

            // 如果有本地URI，尝试使用
            if (metadata.localUri) {
              const localPath = metadata.localUri.replace('file://', '');
              const exists = await RNFS.exists(localPath);
              if (exists) {
                console.log('PDFViewer: 使用本地URI路径:', localPath);
                setLocalFilePath(localPath);
                setPdfSource({ uri: metadata.localUri, cache: true });
                setIsLoading(false);
                return;
              }
            }

            // 如果有本地缓存路径，优先使用
            if (metadata.localCachedPath) {
              // 检查本地缓存文件是否存在
              const exists = await RNFS.exists(metadata.localCachedPath);
              if (exists) {
                console.log('PDFViewer: 使用本地缓存文件:', metadata.localCachedPath);
                setLocalFilePath(metadata.localCachedPath);
                setPdfSource({ uri: `file://${metadata.localCachedPath}`, cache: true });
                setIsLoading(false);
                return;
              } else {
                console.log('PDFViewer: 本地缓存文件不存在，需要重新加载');
              }
            }

            // 如果有fileCopyUri，优先使用它
            if (metadata.fileCopyUri) {
              console.log('PDFViewer: 使用文件复制URI:', metadata.fileCopyUri);
              const exists = await RNFS.exists(metadata.fileCopyUri.replace('file://', ''));
              if (exists) {
                setPdfSource({ uri: metadata.fileCopyUri, cache: true });
                setIsLoading(false);
                return;
              }
            }
          }
        } catch (metadataError) {
          console.error('读取笔记元数据失败:', metadataError);
          // 继续使用原始URI
        }
      }

      // 处理不同类型的URI
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        // 网络URI，直接使用
        setPdfSource({ uri, cache: true });
      } else if (uri.startsWith('content://') || uri.startsWith('file://')) {
        // 内容URI或文件URI，需要复制到应用缓存目录
        const fileName = `pdf_${Date.now()}.pdf`;
        const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        try {
          // 使用RNFS.stat检查文件是否可访问
          if (uri.startsWith('content://')) {
            console.log('处理content URI:', uri);

            try {
              // 对于content URI，直接复制到应用缓存目录
              await RNFS.copyFile(uri, destPath);
              console.log('文件复制成功:', destPath);

              // 设置本地文件路径和PDF源
              setLocalFilePath(destPath);
              setPdfSource({ uri: `file://${destPath}`, cache: true });

              // 保存文件路径到笔记元数据中，以便下次打开
              if (noteId) {
                try {
                  const note = await offlineStorageService.getNote(noteId);
                  if (note) {
                    let metadata = note.metadata
                      ? (typeof note.metadata === 'string'
                          ? JSON.parse(note.metadata)
                          : note.metadata)
                      : {};
                    metadata.localCachedPath = destPath;

                    // 更新笔记元数据
                    await offlineStorageService.updateNote(noteId, {
                      metadata: JSON.stringify(metadata)
                    });
                    console.log('已更新笔记元数据，保存本地缓存路径');
                  }
                } catch (metadataError) {
                  console.error('更新笔记元数据失败:', metadataError);
                }
              }
            } catch (copyError) {
              console.error('复制文件失败:', copyError);
              // 如果复制失败，尝试直接使用原始URI
              setPdfSource({ uri, cache: true });
            }
          } else {
            // 对于file URI，先检查是否可访问
            await RNFS.stat(uri.replace('file://', ''));
            await RNFS.copyFile(uri, destPath);
            setLocalFilePath(destPath);
            setPdfSource({ uri: `file://${destPath}`, cache: true });
            console.log('文件已复制到:', destPath);
          }
        } catch (copyError) {
          console.error('复制文件失败:', copyError);
          // 如果复制失败，尝试直接使用原始URI
          setPdfSource({ uri, cache: true });
        }


      } else {
        // 尝试作为本地路径处理
        setPdfSource({ uri: `file://${uri}`, cache: true });
      }
    } catch (error) {
      console.error('加载PDF失败:', error);
      setError(error.message || '加载PDF失败');
      Alert.alert('错误', error.message || '加载PDF失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 预加载PDF信息
  const preloadPDFInfo = async (pdfUri) => {
    try {
      console.log('=== 开始预加载PDF信息 ===');
      console.log('PDF URI:', pdfUri);

      // 这里可以使用PDF库来预先读取PDF信息
      // 由于react-native-pdf的限制，我们需要等待onLoadComplete回调
      // 但我们可以设置一些预期的配置来优化加载

      console.log('PDF预加载配置完成');
    } catch (error) {
      console.error('预加载PDF信息失败:', error);
    }
  };

  // 分享PDF文件
  const handleShare = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可分享的文件');
      }

      const filePath = localFilePath || uri;

      // 使用React Native的Share API分享文件
      await Share.share({
        title: title || '分享PDF文件',
        message: '分享PDF文件',
        url: Platform.OS === 'ios' ? filePath : `file://${filePath}`,
      });
    } catch (error) {
      console.error('分享PDF失败:', error);
      Alert.alert('错误', error.message || '分享PDF失败');
    }
  };

  // 导出PDF文件
  const handleExport = async () => {
    try {
      if (!localFilePath && !uri) {
        throw new Error('没有可导出的文件');
      }

      const filePath = localFilePath || uri;
      const fileName = title || '导出的PDF文件';

      // 导出到下载目录
      const destPath = `${RNFS.DownloadDirectoryPath}/${fileName}.pdf`;

      await RNFS.copyFile(filePath, destPath);

      Alert.alert('成功', `文件已导出到: ${destPath}`);
    } catch (error) {
      console.error('导出PDF失败:', error);
      Alert.alert('错误', error.message || '导出PDF失败');
    }
  };

  // 重命名PDF文件
  const handleRename = async () => {
    try {
      // 显示重命名对话框
      Alert.prompt(
        '重命名文件',
        '请输入新的文件名',
        [
          {
            text: '取消',
            style: 'cancel'
          },
          {
            text: '确定',
            onPress: async (newName) => {
              if (!newName || newName.trim() === '') {
                Alert.alert('错误', '文件名不能为空');
                return;
              }

              if (!noteId) {
                Alert.alert('错误', '无法重命名文件，笔记ID不存在');
                return;
              }

              try {
                // 获取笔记
                const notes = await offlineStorageService.getNotes();
                const noteIndex = notes.findIndex(note => note.id === noteId);

                if (noteIndex >= 0) {
                  // 更新笔记的标题和文件名
                  notes[noteIndex].title = newName;

                  if (notes[noteIndex].file_name) {
                    const fileExt = notes[noteIndex].file_name.split('.').pop();
                    notes[noteIndex].file_name = `${newName}.${fileExt}`;
                  }

                  // 保存更新后的笔记
                  await offlineStorageService.saveNote(notes[noteIndex]);

                  // 更新导航标题
                  navigation.setOptions({ title: newName });

                  Alert.alert('成功', '文件已重命名');
                } else {
                  throw new Error('找不到笔记');
                }
              } catch (error) {
                console.error('重命名文件失败:', error);
                Alert.alert('错误', error.message || '重命名文件失败');
              }
            }
          }
        ],
        'plain-text',
        title || ''
      );
    } catch (error) {
      console.error('重命名PDF失败:', error);
      Alert.alert('错误', error.message || '重命名PDF失败');
    }
  };





  // 统一保存功能
  const saveToLocal = async () => {
    const pdfData = {
      images: images || [],
      currentPage: currentPage || 1,
      totalPages: totalPages || 1,
      updatedAt: new Date().toISOString()
    };
    // 手写数据现在通过HandwritingAdapter自动保存
    console.log('PDF数据保存:', pdfData);
  };





  // 浮动图片状态与持久化
  const [images, setImages] = useState([]); // {id, uri, x, y, z, scale}
  const [deselectTick, setDeselectTick] = useState(0);

  useEffect(() => { (async () => {
    try {
      // 导入JSON工具函数
      const { safeParseJSON } = require('../../utils/jsonUtils');

      const key = `pdf_images_${noteId || uri || title}`;
      const raw = (await offlineStorageService.getItem(key)) || '[]';
      console.log('PDF图片浮层数据类型:', typeof raw);

      const list = safeParseJSON(raw, []);
      if (Array.isArray(list)) {
        setImages(list);
        console.log('PDF图片浮层加载成功，数量:', list.length);
      } else {
        console.warn('PDF图片浮层数据不是数组:', typeof list);
        setImages([]);
      }
    } catch (e) {
      console.warn('加载PDF图片浮层失败', e);
      setImages([]);
    }
  })(); }, [noteId, uri, title]);

  const persistImages = async (next) => {
    try {
      // 导入JSON工具函数
      const { safeStringifyJSON } = require('../../utils/jsonUtils');

      const key = `pdf_images_${noteId || uri || title}`;
      const jsonString = safeStringifyJSON(next, '[]');
      await offlineStorageService.setItem(key, jsonString);
      console.log('PDF图片浮层保存成功，数量:', Array.isArray(next) ? next.length : 0);
    } catch (e) {
      console.warn('保存PDF图片浮层失败', e);
    }
  };

  const addFloatingImage = async (img) => {
    // 获取屏幕尺寸
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    // 计算合适的图片尺寸和中央位置
    const maxWidth = screenWidth * 0.6; // 最大宽度为屏幕宽度的60%
    const maxHeight = screenHeight * 0.4; // 最大高度为屏幕高度的40%

    let imageWidth = img.width || 200;
    let imageHeight = img.height || 200;

    // 按比例缩放图片以适应最大尺寸
    if (imageWidth > maxWidth || imageHeight > maxHeight) {
      const widthRatio = maxWidth / imageWidth;
      const heightRatio = maxHeight / imageHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      imageWidth = imageWidth * ratio;
      imageHeight = imageHeight * ratio;
    }

    // 计算中央位置
    const centerX = (screenWidth - imageWidth) / 2;
    const centerY = (screenHeight - imageHeight) / 2;

    const item = {
      id: `img_${Date.now()}`,
      uri: img.uri,
      x: centerX,
      y: centerY,
      z: 10,
      width: imageWidth,
      height: imageHeight
    };
    const next = [...images, item];
    setImages(next);
    await persistImages(next);

    console.log('PDFViewer: 图片已添加到中央位置:', item);
  };

  const handleMoveFloatingImage = async (id, pos) => {
    const next = images.map(it => it.id === id ? { ...it, ...pos } : it);
    setImages(next); await persistImages(next);
  };

  // 图层功能已取消（保留历史代码以便回溯），不再使用

  const handleRemoveFloatingImage = async (id) => {
    const next = images.filter(it => it.id !== id);
    setImages(next); await persistImages(next);
  };







  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ToolbarContainer>
      <AllInOneToolbar
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onStrokeWidthChange={handleStrokeWidthChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClear={handleClear}
        initialTool={currentDrawingTool?.type || 'pen'}
        initialColor={currentDrawingColor}
        initialStrokeWidth={currentStrokeWidth}
        onImageUpload={(image) => addFloatingImage(image)}
        onBookmarkAdd={handleAddBookmark}
        onBookmarkList={() => setBookmarkVisible(true)}
        showModeToggle={true}
        onModeToggle={handleModeToggle}
        isFingerMode={isFingerMode}
      />
    </ToolbarContainer>
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
        <View style={styles.headerRightContainer}>
          {/* 保存按钮 - 最右侧位置 */}
          <SaveButton
            onSave={saveToLocal}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
            style={styles.saveButtonCompact}
          />
        </View>
      }
      title={title || 'PDF查看器'}
      hasExternalToolbar={true}
      externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
      showHistoryNavigation={true}
      historyNavigationHeight={25}
      noteId={noteId}
      navigation={navigation}
    >
      
      {/* 文档转换进度界面 */}
      {isConverting && (
        <View style={styles.conversionContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.conversionTitle, { color: colors.text }]}>
            正在加载文档
          </Text>
          <Text style={[styles.conversionMessage, { color: colors.textSecondary }]}>
            {conversionMessage}
          </Text>
          <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: colors.primary,
                  width: `${conversionProgress}%`
                }
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.round(conversionProgress)}%
          </Text>
          {originalFileInfo && (
            <Text style={[styles.fileInfo, { color: colors.textSecondary }]}>
              原始格式: {originalFileInfo.file_type?.toUpperCase()}
            </Text>
          )}
        </View>
      )}

      {isLoading && !isConverting && (
        <LoadingIndicator
          message="正在加载PDF文档..."
          subMessage="大文件首次加载可能较慢"
        />
      )}

      {error && (
        <ErrorIndicator
          message="PDF文档加载失败"
          subMessage={error}
          onRetry={loadPDF}
        />
      )}

      {pdfSource && !error && (
        <View
          style={styles.pdfContainer}
          onLayout={(event) => {
            const { x, y, width, height } = event.nativeEvent.layout;
            setPdfLayout({ x, y, width, height });
          }}
        >
          {/* 移除PDF边框，提供更清洁的视觉体验 */}

          {/* 主PDF显示组件 */}
          <Pdf
            key={(pdfSource && pdfSource.uri) || 'pdf'}
            ref={pdfRef}
            source={pdfSource}
            // 内存优化配置
            maxZoom={3}
            minZoom={0.5}
            scale={1.0}
            style={styles.pdf}
            onLoadComplete={(numberOfPages, filePath, width, height, ...args) => {
              console.log('=== PDF加载完成回调触发 ===');
              console.log(`参数 - 页数: ${numberOfPages}, 文件路径: ${filePath}`);
              console.log(`参数 - 宽度: ${width}, 高度: ${height}`);
              console.log('额外参数:', args);
              console.log('PDF源:', JSON.stringify(pdfSource, null, 2));
              console.log('numberOfPages类型:', typeof numberOfPages);
              console.log('numberOfPages值:', numberOfPages);
              console.log('所有参数长度:', arguments.length);

              // 多种方式解析页数
              let pageCount = 0;

              // 方法1: 直接数字
              if (typeof numberOfPages === 'number' && numberOfPages > 0) {
                pageCount = numberOfPages;
                console.log('✅ 方法1成功 - 直接数字:', pageCount);
              }
              // 方法2: 字符串转数字
              else if (typeof numberOfPages === 'string') {
                const parsed = parseInt(numberOfPages, 10);
                if (!isNaN(parsed) && parsed > 0) {
                  pageCount = parsed;
                  console.log('✅ 方法2成功 - 字符串转数字:', pageCount);
                }
              }
              // 方法3: 对象转换
              else if (numberOfPages && typeof numberOfPages === 'object') {
                if (numberOfPages.numberOfPages) {
                  pageCount = parseInt(numberOfPages.numberOfPages, 10);
                  console.log('✅ 方法3成功 - 对象属性:', pageCount);
                } else if (numberOfPages.pageCount) {
                  pageCount = parseInt(numberOfPages.pageCount, 10);
                  console.log('✅ 方法3成功 - pageCount属性:', pageCount);
                }
              }
              // 方法4: 检查其他参数
              else if (args && args.length > 0) {
                for (let i = 0; i < args.length; i++) {
                  const arg = args[i];
                  if (typeof arg === 'number' && arg > 0) {
                    pageCount = arg;
                    console.log(`✅ 方法4成功 - 参数${i}:`, pageCount);
                    break;
                  }
                }
              }

              console.log('最终解析的页数:', pageCount);

              // 确保页数至少为1，防止闪退
              if (pageCount && pageCount > 0) {
                setTotalPages(pageCount);
                console.log(`✅ 成功设置总页数为: ${pageCount}`);
              } else {
                // 如果无法获取页数，默认设置为1
                console.warn('⚠️ 无法获取有效页数，默认设置为1');
                setTotalPages(1);

                // 预加载所有页面信息
                // 保底：依然标记加载完成

                console.warn('❌ 所有方法都无法获取有效页数');
                console.warn('原始参数:', { numberOfPages, filePath, width, height, args });

                // 延迟重试
                setTimeout(() => {
                  console.log('延迟重试获取PDF页数...');
                  // 可以在这里添加其他获取页数的方法
                }, 2000);
              }

              // 设置PDF直接写入服务
              if (filePath || (pdfSource && pdfSource.uri)) {
                const pdfPath = filePath || pdfSource.uri;
                pdfDirectWriteService.setCurrentPDF(pdfPath);
                console.log('PDFViewer: 已设置PDF直接写入服务');
              }

              setIsLoading(false);
              console.log('=== PDF加载完成处理结束 ===');
            }}
            onPageChanged={(page, numberOfPages) => {
              // 同步总页数（有些设备上 onLoadComplete 可能延后或没有返回）
              if (typeof numberOfPages === 'number' && numberOfPages > 0 && numberOfPages !== totalPages) {
                setTotalPages(numberOfPages);
              }
              // 只有当页面真正变化时才执行操作
              if (page !== currentPage) {
                console.log('=== PDF页面变化 ===');
                console.log(`从第${currentPage}页切换到第${page}页`);
                console.log(`总页数(回调): ${numberOfPages} / 状态: ${totalPages}`);
                if (pageChangeTimeout.current) clearTimeout(pageChangeTimeout.current);
                pageChangeTimeout.current = setTimeout(() => {
                  setCurrentPage(page);
                  console.log('=== PDF页面变化处理结束 ===');
                }, 50);
              }
            }}
            onError={(error) => {
              console.error('=== PDF加载错误 ===');
              console.error('错误对象:', error);
              console.error('错误消息:', error.message);
              console.error('PDF源:', JSON.stringify(pdfSource, null, 2));
              console.error('原始URI:', uri);
              console.error('=== PDF加载错误结束 ===');
              setError(error.message || 'PDF加载错误');
              setIsLoading(false);
            }}
            onPressLink={(uri) => {
              console.log(`链接点击: ${uri}`);
            }}
    
            enablePaging={false} // 连续滚动
            horizontal={false} // 垂直方向
            enableRTL={false}
            trustAllCerts={false}
            enableDoubleTapZoom={true}
            enableAnnotationRendering={true}
            fitPolicy={0} // 0=Fit width
            spacing={0} // 去除页间距，避免边框感
            singlePage={false}
            enableSwipe={true}
            scrollEnabled={true}
            minScale={0.5}            // 允许缩小
            maxScale={4.0}            // 放大更多
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={true}
          
            // 优化加载指示器
            activityIndicator={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  正在加载PDF文档...
                </Text>
              </View>
            )}
            activityIndicatorProps={{
              color: colors.primary,
              progressTintColor: colors.primary,
            }}
            renderActivityIndicator={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>
                  正在渲染页面...
                </Text>
              </View>
            )}

            // 缩放事件处理
            onScaleChanged={(scale) => {
              setScale(scale);
              setShowZoomIndicator(true);

              // 延迟隐藏指示器
              setTimeout(() => {
                setShowZoomIndicator(false);
              }, 2000);
            }}


          />
          {/* 漂浮图片层（在 Pdf 组件之后渲染）*/}
          <View onStartShouldSetResponder={()=>{ setDeselectTick(t=>t+1); return false; }}>
            {Array.isArray(images) && images.map(img => (
              <DraggableImage
                key={img.id}
                id={img.id}
                uri={img.uri}
                initial={{ x: img.x, y: img.y }}
                initialScale={img.scale || 1}
                deselectSignal={deselectTick}
                onMove={handleMoveFloatingImage}
                onResize={(id, data)=>{
                  const next = images.map(it=>it.id===id?{...it, scale:data.scale}:it);
                  setImages(next); persistImages(next);
                }}
                onRemove={handleRemoveFloatingImage}
              />
            ))}
          </View>
          {/* 手写适配器层 */}
          {(() => {
            try {
              return (
                <HandwritingAdapter
                  ref={handwritingAdapterRef}
                  currentTool={currentDrawingTool}
                  currentColor={currentDrawingColor}
                  currentStrokeWidth={currentStrokeWidth}
                  documentId={noteId}
                  documentType="pdf"
                  pageNumber={currentPage}
                  filePath={localFilePath || (pdfSource && pdfSource.uri)}
                  fileName={localFilePath ? localFilePath.split('/').pop() : (pdfSource && pdfSource.uri ? pdfSource.uri.split('/').pop() : 'unknown.pdf')}
                  enablePressure={true}
                  enableTilt={true}
                  fingerRejection={false}
                  isFingerMode={isFingerMode}
                  onStrokesChange={handleStrokesChange}
                  style={styles.handwritingLayer}
                  zIndex={1000}
                  visible={true}
                  // 传递PDF边界信息用于边界检测
                  pdfBounds={{
                    width: screenWidth,
                    height: screenHeight
                  }}
                  // 启用直接写入模式以提高性能
                  directWriteMode={true}
                />
              );
            } catch (error) {
              console.error('PDFViewer: HandwritingAdapter渲染失败:', error);
              return null;
            }
          })()}
        </View>
      )}

    
      {/* 缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={-90}
      />

      {/* 书签面板 */}
      <BookmarkPanel
        visible={bookmarkVisible}
        onClose={() => setBookmarkVisible(false)}
        docId={noteId}
        onJump={handleJumpToBookmark}
      />
    </ViewerLayout>
     {/* 使用PageControl组件 */}
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
          storageKey="pdf_viewer_pagecontrol_pos"
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // headerContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   paddingHorizontal: 16,
  //   paddingVertical: 12,
  //   paddingTop: Platform.OS === 'ios' ? 50 : 12, // 适配iOS状态栏
  //   elevation: 4,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.1,
  //   shadowRadius: 2,
  //   zIndex: 90,
  // },
  // backButton: {
  //   marginTop: 20,
  //   padding: 12,
  //   marginRight: 10,
  //   borderRadius: 8,
  //   maxWidth: 48,
  //   maxHeight: 25,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
  // headerTitle: {
  //   flex: 1,
  //   fontSize: 18,
  //   fontWeight: '600',
  //   textAlign: 'center',
  // },
  // headerSpacer: {
  //   width: 40, // 平衡左侧返回按钮的宽度
  // },
  pdfContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    paddingTop: 0,
    backgroundColor: 'transparent',
  },
  pdfBorder: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    bottom: 0,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderStyle: 'solid',
    zIndex: 999,
    pointerEvents: 'none',
  },
  pdf: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent', // 移除灰色边
    paddingTop: 20, // 增加顶部内边距，避免被工具栏遮挡
  },
  headerButtons: {
    flexDirection: 'row',
  },
  // headerButton: {
  //   marginHorizontal: 6,
  //   padding: 3,
  // },
  // loadingContainer: {
  //   position: 'absolute',
  //   top: 0,
  //   left: 0,
  //   right: 0,
  //   bottom: 0,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   backgroundColor: 'rgba(0,0,0,0.3)',
  //   zIndex: 1000,
  // },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  // pageIndicator: {
  //   position: 'absolute',
  //   bottom: Platform.OS === 'ios' ? 24 : 20,
  //   left: '40%',
  //   right: '40%',
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   paddingVertical: 0,
  //   paddingHorizontal: 1,
  //   borderRadius: 20,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 3.84,
  //   elevation: 5,
  //   opacity: 0.9,
  // },

  pageIndicatorWithToolbar: {
    bottom: Platform.OS === 'ios' ? 90 : 72, // 避免与工具栏重叠
  },
  pageText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  pageTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  // pageInput: {
  //   fontSize: 10,
  //   fontWeight: '500',
  //   textAlign: 'center',
  //   paddingVertical: 4,
  //   paddingHorizontal: 20,
  //   maxWidth: 60,
  //   borderWidth: 1,
  //   borderRadius: 8,
  // },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cadff0ff',
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  // handwritingCanvas: {
  //   position: 'absolute',
  //   top: 0, // 从PDF顶部开始
  //   left: 0,
  //   right: 0,
  //   bottom: 0, // 覆盖整个PDF区域
  //   backgroundColor: 'transparent',
  //   zIndex: 100, // 始终在PDF上方
  //   elevation: 10, // Android elevation
  //   pointerEvents: 'box-none', // 允许触摸事件穿透到PDF，但画布本身可以接收触控笔事件
  //   height: '100%', // 确保高度覆盖整个PDF区域
  //   width: '100%', // 确保宽度覆盖整个PDF区域
  // },
  // toolbarContainer: {
  //   position: 'absolute',
  //   top: 0, // 将工具栏移到顶部
  //   left: 0,
  //   right: 0,
  //   zIndex: 180,
  //   backgroundColor: 'transparent',
  //   paddingHorizontal: 0,
  //   paddingTop: 0, 
  // },
  toolbar: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 0, // 移除圆角，让工具栏完全贴合屏幕边缘
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%', // 确保工具栏宽度为100%
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  // handwritingButton: {
  //   position: 'absolute',
  //   bottom: 20,
  //   right: 20,
  //   width: 50,
  //   height: 50,
  //   borderRadius: 25,
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   elevation: 5,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 3.84,
  // },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
  // 文档转换样式
  conversionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  conversionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  conversionMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    width: 200,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    marginBottom: 10,
  },
  fileInfo: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // 手写层样式
  handwritingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'auto',
  },

});

export default PDFViewer;