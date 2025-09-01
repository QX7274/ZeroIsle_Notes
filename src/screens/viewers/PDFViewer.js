import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
import { launchImageLibrary } from 'react-native-image-picker';

import HandwritingCanvas from '../../components/handwriting/HandwritingCanvas';
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
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PDFViewer = ({ route, navigation }) => {
  const { uri, title, noteId, fromFileHistory } = route.params || {};
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

  // 企业级手写相关状态
  const [isHandwritingMode, setIsHandwritingMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState({});
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [scale, setScale] = useState(1);

  // 企业级手写笔检测状态
  const [inputType, setInputType] = useState('finger'); // 'finger' | 'pen'
  const [isPenActive, setIsPenActive] = useState(false);
  const [currentPressure, setCurrentPressure] = useState(0.5);
  const [handwritingPaths, setHandwritingPaths] = useState({});
  const [isDrawing, setIsDrawing] = useState(false);
  const [isStylusActive, setIsStylusActive] = useState(false);


  // 引用
  const pdfRef = useRef(null);
  const handwritingRef = useRef(null);

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
    console.log(`手写模式: ${isHandwritingMode}`);
    console.log(`加载中: ${isLoading}`);
    console.log(`错误: ${error}`);
    console.log('=== PDF状态更新结束 ===');
  }, [currentPage, totalPages, isHandwritingMode, isLoading, error]);

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
      // 保存当前页面的注释
      if (handwritingRef.current) {
        saveAnnotations();
      }

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

  // 监听手写模式状态变化和页面变化
  useEffect(() => {
    if (isHandwritingMode && currentPage > 0) {
      // 加载当前页面的注释
      loadAnnotations(currentPage);
    }
  }, [isHandwritingMode, currentPage]);

  const loadPDF = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTotalPages(0); // 重置页数

      // 检查URI格式
      if (!uri) {
        throw new Error('无效的PDF文件URI');
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

  // 切换手写模式
  const toggleHandwritingMode = () => {
    setIsHandwritingMode(prev => {
      const newMode = !prev;
      console.log(`切换手写模式: ${newMode ? '开启' : '关闭'}`);

      // 如果开启手写模式，加载当前页面的注释
      if (newMode) {
        loadAnnotations(currentPage);
      } else {
        // 如果关闭手写模式，保存当前注释
        saveAnnotations();
      }

      return newMode;
    });
  };

  // 保存注释按钮处理函数
  const handleSaveAnnotations = () => {
    saveAnnotations();
  };

  // 统一保存功能
  const saveToLocal = async () => {
    const pdfData = {
      annotations: annotations || [],
      images: images || [],
      currentPage: currentPage || 1,
      totalPages: totalPages || 1,
      updatedAt: new Date().toISOString()
    };
    await SaveUtils.savePDFAnnotations(noteId || uri || title, pdfData, offlineStorageService);
  };

  // 关闭手写模式按钮处理函数
  const handleCloseHandwritingMode = () => {
    toggleHandwritingMode();
  };

  // 图片上传处理函数
  const handleImageUpload = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('用户取消了图片选择');
        return;
      }

      if (response.errorMessage) {
        console.error('图片选择错误:', response.errorMessage);
        Alert.alert('错误', '图片选择失败: ' + response.errorMessage);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        console.log('选择的图片:', asset);

        // 这里可以实现将图片添加到PDF注释中的逻辑
        Alert.alert(
          '图片选择成功',
          `已选择图片: ${asset.fileName}\n大小: ${(asset.fileSize / 1024 / 1024).toFixed(2)}MB\n\n图片插入功能正在开发中`,
          [
            { text: '确定', onPress: () => console.log('图片处理完成') }
          ]
        );
      }
    });
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

  // 图片插入处理函数
  const handleImageInsert = async (imageData) => {
    console.log('=== 开始处理图片插入 ===');
    console.log('图片数据:', imageData);

    if (!imageData || !imageData.uri) {
      console.error('无效的图片数据');
      Alert.alert('错误', '无效的图片数据');
      return;
    }

    // 作为漂浮图片加入层（不直接嵌入PDF内容）
    try {
      await addFloatingImage({ uri: imageData.uri });
      Alert.alert('已添加', '图片已作为浮层加入，可拖拽移动');
    } catch (e) {
      console.warn('添加图片浮层失败', e);
    }
    
    try {
      // 计算图片在PDF页面中的合适尺寸
      const screenWidth = Dimensions.get('window').width;
      const maxImageWidth = screenWidth * 0.3; // 图片最大宽度为屏幕宽度的30%
      const maxImageHeight = 200; // 最大高度200px

      let imageWidth = imageData.width;
      let imageHeight = imageData.height;

      // 按比例缩放图片
      if (imageWidth > maxImageWidth) {
        const ratio = maxImageWidth / imageWidth;
        imageWidth = maxImageWidth;
        imageHeight = imageHeight * ratio;
      }

      if (imageHeight > maxImageHeight) {
        const ratio = maxImageHeight / imageHeight;
        imageHeight = maxImageHeight;
        imageWidth = imageWidth * ratio;
      }

      // 默认插入位置（屏幕中央）
      const defaultX = (screenWidth - imageWidth) / 2;
      const defaultY = 200; // 距离顶部200px

      const imageInsertData = {
        uri: imageData.uri,
        width: imageWidth,
        height: imageHeight,
        x: defaultX,
        y: defaultY,
        fileName: imageData.fileName || 'image.jpg',
        type: imageData.type || 'image/jpeg'
      };

      console.log('处理后的图片插入数据:', imageInsertData);

      // 将图片添加到手写画布中
      if (handwritingRef.current) {
        if (typeof handwritingRef.current.addImage === 'function') {
          handwritingRef.current.addImage(imageInsertData);
          console.log('✅ 图片已添加到手写画布');
        } else {
          console.warn('❌ HandwritingCanvas没有addImage方法，需要实现');
          Alert.alert('提示', '图片插入功能正在开发中');
        }
      } else {
        // 手写画布未启用时，忽略该步骤；图片已作为浮层加入
        console.log('手写画布未初始化：已改为添加漂浮图片层，不再报错');
      }
    } catch (error) {
      console.error('图片插入处理失败:', error);
      Alert.alert('错误', '图片插入失败: ' + error.message);
    }

    console.log('=== 图片插入处理结束 ===');

    try {
      // 计算图片在PDF页面中的合适尺寸
      const screenWidth = Dimensions.get('window').width;
      const maxImageWidth = screenWidth * 0.3; // 图片最大宽度为屏幕宽度的30%
      const maxImageHeight = 200; // 最大高度200px

      let imageWidth = imageData.width;
      let imageHeight = imageData.height;

      // 按比例缩放图片
      if (imageWidth > maxImageWidth) {
        const ratio = maxImageWidth / imageWidth;
        imageWidth = maxImageWidth;
        imageHeight = imageHeight * ratio;
      }

      if (imageHeight > maxImageHeight) {
        const ratio = maxImageHeight / imageHeight;
        imageHeight = maxImageHeight;
        imageWidth = imageWidth * ratio;
      }

      // 默认插入位置（屏幕中央）
      const defaultX = (screenWidth - imageWidth) / 2;
      const defaultY = 200; // 距离顶部200px

      const imageInsertData = {
        uri: imageData.uri,
        width: imageWidth,
        height: imageHeight,
        x: defaultX,
        y: defaultY,
        fileName: imageData.fileName || 'image.jpg',
        type: imageData.type || 'image/jpeg'
      };

      console.log('处理后的图片插入数据:', imageInsertData);

      // 将图片添加到手写画布中
      if (handwritingRef.current) {
        if (typeof handwritingRef.current.addImage === 'function') {
          handwritingRef.current.addImage(imageInsertData);
          console.log('✅ 图片已添加到手写画布');
        } else {
          console.warn('❌ HandwritingCanvas没有addImage方法，需要实现');
          Alert.alert('提示', '图片插入功能正在开发中');
        }
      } else {
        console.log('手写画布未初始化：已改为添加漂浮图片层，不再报错');
      }
    } catch (error) {
      console.error('图片插入处理失败:', error);
      Alert.alert('错误', '图片插入失败: ' + error.message);
    }

    console.log('=== 图片插入处理结束 ===');
  };

  // 保存手写注释
  const saveAnnotations = async () => {
    if (handwritingRef.current) {
      try {
        // 触发HandwritingCanvas的captureCanvas方法
        handwritingRef.current.captureCanvas();

        // 注意：实际的保存操作会在HandwritingCanvas的onCapture回调中处理
        // 如果有noteId，将注释保存到存储中
        if (noteId && annotations[currentPage]) {
          const annotationKey = `annotation_${noteId}_${currentPage}`;
          await offlineStorageService.setItem(annotationKey, annotations[currentPage]);
          console.log('保存注释到存储:', annotationKey);

          Alert.alert('成功', '注释已保存');
        }
      } catch (error) {
        console.error('保存注释失败:', error);
        Alert.alert('错误', '保存注释失败');
      }
    }
  };

  // 加载手写注释
  const loadAnnotations = async (page) => {
    try {
      let annotationData = annotations[page];

      // 如果内存中没有注释数据且有noteId，尝试从存储中加载
      if (!annotationData && noteId) {
        const annotationKey = `annotation_${noteId}_${page}`;
        annotationData = await offlineStorageService.getItem(annotationKey);

        // 如果找到了存储的注释，更新内存中的状态
        if (annotationData) {
          console.log(`从存储中加载页面${page}的注释数据`);
          setAnnotations(prev => ({
            ...prev,
            [page]: annotationData
          }));
        }
      }

      // 如果有注释数据，加载到画布
      if (annotationData && handwritingRef.current) {
        console.log('加载页面注释到画布:', page);

        // 检查HandwritingCanvas是否有loadImageData方法
        if (typeof handwritingRef.current.loadImageData === 'function') {
          handwritingRef.current.loadImageData(annotationData);
        }
        // 检查是否有setImageData方法
        else if (typeof handwritingRef.current.setImageData === 'function') {
          handwritingRef.current.setImageData(annotationData);
        }
        // 检查是否有fromDataURL方法
        else if (typeof handwritingRef.current.fromDataURL === 'function') {
          handwritingRef.current.fromDataURL(annotationData);
        }
        // 如果没有上述方法，尝试使用其他可能的方法
        else {
          console.warn('HandwritingCanvas没有提供加载图像数据的方法');
          // 可能需要实现一个自定义方法来处理这种情况
        }
      } else if (handwritingRef.current) {
        // 如果没有注释数据，清空画布
        console.log('清空画布，无注释数据');
        if (typeof handwritingRef.current.clearCanvas === 'function') {
          handwritingRef.current.clearCanvas();
        }
      }
    } catch (error) {
      console.error('加载注释失败:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
    <ToolbarContainer>
      <AllInOneToolbar
        onToolChange={() => {}}
        onColorChange={setStrokeColor}
        onStrokeWidthChange={setStrokeWidth}
        onImageUpload={(image) => addFloatingImage(image)}
        onBookmarkAdd={handleAddBookmark}
        onBookmarkList={() => setBookmarkVisible(true)}
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
      
      {isLoading && (
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
        <View style={styles.pdfContainer}>
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
                  console.log(`加载第${page}页的注释`);
                  loadAnnotations(page);
                  console.log('=== PDF页面变化处理结束 ===');
                }, 200);
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
            enableSwipe={!isStylusActive}
            scrollEnabled={!isStylusActive}
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
              }, 100);
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
          {/* 暂时禁用手写覆盖层 */}
          {/* <GlobalStylusOverlay
            color={strokeColor}
            width={strokeWidth}
            onStrokeStart={() => setIsStylusActive(true)}
            onStrokeEnd={() => setTimeout(() => setIsStylusActive(false), 120)}
          /> */}
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

});

export default PDFViewer;