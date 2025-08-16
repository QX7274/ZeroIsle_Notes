import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Alert, Platform, Image, StatusBar,Text} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import PageControl from '../../components/viewer/PageControl';
import { addBookmark } from '../../services/bookmarkService';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { offlineStorageService } from '../../services/offline';
import { useInputMode } from '../../utils/inputDetection';
import { useDispatch } from 'react-redux';
import { addNote } from '../../redux/slices/notesSlice';
import ZoomIndicator from '../../components/common/ZoomIndicator';


/**
 * 分页式笔记屏幕
 * 提供固定页面大小的分页笔记功能，支持多种纸张样式
 */
const PagedNoteScreen = ({ route, navigation }) => {
  const { title = '新建笔记', noteId, noteStyle = 'blank' } = route.params || {};
  const { colors } = useTheme();
  const { getOperationType } = useInputMode();
  const dispatch = useDispatch();
  
  // 页面状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  // 手写功能临时移除
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [pages, setPages] = useState([{ paths: [], images: [] }]); // 每页的内容
  // const [currentPath, setCurrentPath] = useState('');
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  
  // 引用
  const noteRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);

  // 性能优化：使用ref存储临时缩放值，减少重新渲染
  const tempScale = useRef(1);
  const isScaling = useRef(false);
  const initialTranslate = useRef({ x: 0, y: 0 });
  const tempTransform = useRef({ scale: 1, translateX: 0, translateY: 0 });
  const isTransforming = useRef(false);
  
  const docId = noteId || `note_${Date.now()}`;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // A4页面尺寸计算 - 简化版本
  // A4纸的标准比例是 210:297 (约1:1.414)
  const A4_RATIO = 297 / 210;
  const pageWidth = screenWidth - 40; // 留出边距
  const pageHeight = pageWidth * A4_RATIO; // 保持A4比例
  
  // 笔记样式配置
  const noteStyles = {
    blank: {
      backgroundColor: '#FFFFFF',
      pattern: null
    },
    lined: {
      backgroundColor: '#FFFFFF',
      pattern: 'lines'
    },
    grid: {
      backgroundColor: '#FFFFFF',
      pattern: 'grid'
    },
    dotted: {
      backgroundColor: '#FFFFFF',
      pattern: 'dots'
    },
    yellow_lined: {
      backgroundColor: '#FFF8DC',
      pattern: 'lines'
    },
    cornell: {
      backgroundColor: '#FFFFFF',
      pattern: 'cornell'
    }
  };
  
  const currentNoteStyle = noteStyles[noteStyle] || noteStyles.blank;

  // 组件加载时恢复或创建笔记
  useEffect(() => {
    const loadOrCreateNote = async () => {
      try {
        // 首先尝试从存储中加载现有笔记
        const existingNote = await offlineStorageService.getNote(docId);

        if (existingNote && existingNote.type === 'paged_note') {
          console.log('PagedNoteScreen: 恢复现有笔记数据:', existingNote.title);

          // 导入JSON工具函数
          const { safeParseJSON } = require('../../utils/jsonUtils');

          // 恢复笔记状态
          setCurrentPage(existingNote.currentPage || 1);
          setTotalPages(existingNote.totalPages || 1);

          // 安全解析pages字段
          const pages = safeParseJSON(existingNote.pages, [{ paths: [], images: [] }]);
          setPages(Array.isArray(pages) ? pages : [{ paths: [], images: [] }]);

          console.log('PagedNoteScreen: 笔记状态已恢复');
        } else {
          // 创建新笔记
          console.log('PagedNoteScreen: 创建新笔记');

          const initialNoteData = {
            _id: docId,
            id: docId,
            title,
            type: 'paged_note',
            noteStyle,
            currentPage: 1,
            totalPages: 1,
            pages: [{ paths: [], images: [] }],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // 保存到离线存储
          await offlineStorageService.saveNote(initialNoteData);

          // 添加到Redux store
          dispatch(addNote(initialNoteData));

          console.log('PagedNoteScreen: 新笔记已创建并保存');
        }
      } catch (error) {
        console.error('PagedNoteScreen: 加载/创建笔记失败:', error);
      }
    };

    loadOrCreateNote();
  }, []); // 只在组件挂载时执行一次

  // 自动保存功能
  useEffect(() => {
    const autoSave = async () => {
      try {
        const noteData = {
          _id: docId,
          id: docId,
          title,
          type: 'paged_note',
          noteStyle,
          currentPage,
          totalPages,
          pages,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // 自动保存到离线存储
        await offlineStorageService.saveNote(noteData);
        console.log('PagedNoteScreen: 自动保存完成');
      } catch (error) {
        console.error('PagedNoteScreen: 自动保存失败:', error);
      }
    };

    // 延迟自动保存，避免频繁保存
    const timeoutId = setTimeout(autoSave, 2000);
    return () => clearTimeout(timeoutId);
  }, [currentPage, totalPages, pages]); // 当页面数据变化时自动保存

  
  // 手势处理 - 简化版本，专注于缩放和翻页
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 1) {
        // 单指操作 - 平移
        initialTranslate.current = { x: translateX, y: translateY };
        tempTransform.current = { scale, translateX, translateY };
        isTransforming.current = true;
      } else if (touches.length === 2) {
        // 双指操作 - 缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        initialDistance.current = distance;
        initialScale.current = scale;
        tempScale.current = scale;
        isScaling.current = true;
        isTransforming.current = true;
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 1) {
        // 单指平移 - 严格限制边界，防止大幅移动
        if (isTransforming.current) {
          const maxTranslateX = 30;  // 进一步减少水平移动距离
          const maxTranslateY = 15;  // 进一步减少垂直移动距离
          const minTranslateY = -5;  // 防止顶部被拖到下方

          let newTranslateX = initialTranslate.current.x + gestureState.dx * 0.5; // 添加阻尼
          let newTranslateY = initialTranslate.current.y + gestureState.dy * 0.5; // 添加阻尼

          // 严格限制移动范围
          newTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
          newTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));

          tempTransform.current.translateX = newTranslateX;
          tempTransform.current.translateY = newTranslateY;

          // 节流更新状态
          const now = Date.now();
          if (!lastTap.current || now - lastTap.current > 16) {
            setTranslateX(tempTransform.current.translateX);
            setTranslateY(tempTransform.current.translateY);
            lastTap.current = now;
          }
        }
      } else if (touches.length === 2) {
        // 双指缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        if (isScaling.current) {
          // 计算缩放比例 - 添加阻尼效果，提高流畅度
          const scaleRatio = distance / initialDistance.current;
          let rawScale = initialScale.current * scaleRatio;

          // 添加渐进式缩放阻尼，防止一次性放大到最大倍数
          const scaleDiff = rawScale - initialScale.current;
          const dampingFactor = 0.8; // 阻尼系数，降低缩放敏感度
          let newScale = initialScale.current + (scaleDiff * dampingFactor);

          // 限制缩放范围：0.5到3倍，适合笔记阅读
          newScale = Math.max(0.5, Math.min(3, newScale));

          // 添加缩放步进，使缩放更加平滑
          const scaleStep = 0.05;
          newScale = Math.round(newScale / scaleStep) * scaleStep;

          // 计算缩放中心点（屏幕坐标）
          const centerX = (touch1.pageX + touch2.pageX) / 2;
          const centerY = (touch1.pageY + touch2.pageY) / 2;

          // 计算相对于内容的缩放中心点
          const contentCenterX = (centerX - translateX) / scale;
          const contentCenterY = (centerY - translateY) / scale;

          // 计算新的平移量，确保缩放中心保持固定
          const newTranslateX = centerX - contentCenterX * newScale;
          const newTranslateY = centerY - contentCenterY * newScale;

          tempScale.current = newScale;
          tempTransform.current.scale = newScale;
          tempTransform.current.translateX = newTranslateX;
          tempTransform.current.translateY = newTranslateY;

          // 显示缩放指示器
          setShowZoomIndicator(true);

          // 优化节流更新状态，提高响应性
          const now = Date.now();
          if (!lastTap.current || now - lastTap.current > 12) { // 减少节流间隔，提高响应性
            setScale(newScale);
            setTranslateX(newTranslateX);
            setTranslateY(newTranslateY);
            lastTap.current = now;
          }
        }
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      // 结束变换操作
      if (isTransforming.current) {
        setScale(tempTransform.current.scale);
        setTranslateX(tempTransform.current.translateX);
        setTranslateY(tempTransform.current.translateY);
        isTransforming.current = false;

        // 隐藏缩放指示器
        setTimeout(() => {
          setShowZoomIndicator(false);
        }, 100);
      }

      isScaling.current = false;

      // 手指上下滑动翻页检测 - 降低阈值，提高敏感度
      if (evt.nativeEvent.touches.length <= 1 && Math.abs(gestureState.dy) > 30 && Math.abs(gestureState.dx) < 80) {
        if (gestureState.dy < -30) {
          // 向上滑动 - 下一页或添加新页面
          if (currentPage < totalPages) {
            goToPage(currentPage + 1);
          } else {
            addNewPage();
          }
        } else if (gestureState.dy > 30) {
          // 向下滑动 - 上一页
          if (currentPage > 1) {
            goToPage(currentPage - 1);
          }
        }
      }

      setIsDrawing(false);

      // 结束缩放操作，确保最终状态正确
      if (isScaling.current) {
        setScale(tempScale.current);
        isScaling.current = false;
      }
    }
  });
  
  // 工具栏处理
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
  };
  
  const handleColorChange = (color) => {
    setStrokeColor(color);
  };
  
  const handleStrokeWidthChange = (width) => {
    setStrokeWidth(width);
  };
  
  const handleImageUpload = (imageData) => {
    // 处理不同的参数格式
    const imageUri = typeof imageData === 'string' ? imageData : imageData.uri;

    if (!imageUri) {
      console.warn('图片上传失败：无效的图片URI');
      return;
    }

    // 计算合适的图片尺寸
    const maxImageWidth = pageWidth * 0.6; // 最大宽度为页面宽度的60%
    const maxImageHeight = pageHeight * 0.4; // 最大高度为页面高度的40%

    let imageWidth = imageData.width || 200;
    let imageHeight = imageData.height || 200;

    // 按比例缩放图片以适应页面
    if (imageWidth > maxImageWidth || imageHeight > maxImageHeight) {
      const widthRatio = maxImageWidth / imageWidth;
      const heightRatio = maxImageHeight / imageHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      imageWidth = imageWidth * ratio;
      imageHeight = imageHeight * ratio;
    }

    const newImage = {
      id: Date.now(),
      uri: imageUri,
      x: (pageWidth - imageWidth) / 2, // 真正的居中显示
      y: (pageHeight - imageHeight) / 2, // 真正的居中显示
      scale: 1,
      rotation: 0,
      width: imageWidth,
      height: imageHeight
    };

    const newPages = [...pages];
    if (!newPages[currentPage - 1]) {
      newPages[currentPage - 1] = { paths: [], images: [] };
    }
    newPages[currentPage - 1].images.push(newImage);
    setPages(newPages);

    console.log('图片已添加到页面中央:', newImage);
  };
  
  // 页面导航
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      console.log(`PagedNoteScreen: 切换到第 ${pageNum} 页，共 ${totalPages} 页`);
    }
  };

  const addNewPage = () => {
    setPages(prev => [...prev, { paths: [], images: [] }]);
    setTotalPages(prev => prev + 1);
    setCurrentPage(totalPages + 1);
    console.log(`PagedNoteScreen: 添加新页面，当前第 ${totalPages + 1} 页`);
  };

  // 删除当前页面（如果不是最后一页）
  const deleteCurrentPage = () => {
    if (totalPages > 1) {
      const newPages = pages.filter((_, index) => index !== currentPage - 1);
      setPages(newPages);
      setTotalPages(newPages.length);

      // 调整当前页码
      if (currentPage > newPages.length) {
        setCurrentPage(newPages.length);
      }
      console.log(`PagedNoteScreen: 删除页面，剩余 ${newPages.length} 页`);
    }
  };

  // 在当前页面后插入新页面
  const insertPageAfterCurrent = () => {
    const newPages = [...pages];
    newPages.splice(currentPage, 0, { paths: [], images: [] });
    setPages(newPages);
    setTotalPages(newPages.length);
    setCurrentPage(currentPage + 1);
    console.log(`PagedNoteScreen: 在第 ${currentPage} 页后插入新页面`);
  };
  
  // 书签功能
  const handleAddBookmark = () => {
    setBookmarkVisible(true);
  };
  
  // 保存功能
  const saveNote = async () => {
    try {
      const noteData = {
        _id: docId,
        id: docId,
        title,
        type: 'paged_note',
        noteStyle,
        currentPage,
        totalPages,
        pages,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 保存到离线存储
      await offlineStorageService.saveNote(noteData);

      // 添加到Redux store
      dispatch(addNote(noteData));

      Alert.alert('成功', '笔记已保存');
    } catch (error) {
      console.error('保存笔记失败:', error);
      Alert.alert('错误', '保存失败: ' + error.message);
    }
  };
  
  // 背景图案渲染
  const renderPattern = () => {
    const patternSize = 20;
    const lines = [];
    
    if (currentNoteStyle.pattern === 'grid') {
      // 方格纸
      for (let x = 0; x < pageWidth; x += patternSize) {
        lines.push(
          <Line
            key={`v${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={pageHeight}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
      for (let y = 0; y < pageHeight; y += patternSize) {
        lines.push(
          <Line
            key={`h${y}`}
            x1={0}
            y1={y}
            x2={pageWidth}
            y2={y}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
    } else if (currentNoteStyle.pattern === 'lines') {
      // 横线纸
      for (let y = patternSize; y < pageHeight; y += patternSize) {
        lines.push(
          <Line
            key={`line${y}`}
            x1={0}
            y1={y}
            x2={pageWidth}
            y2={y}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
    } else if (currentNoteStyle.pattern === 'dots') {
      // 点阵纸
      for (let x = patternSize; x < pageWidth; x += patternSize) {
        for (let y = patternSize; y < pageHeight; y += patternSize) {
          lines.push(
            <Circle
              key={`dot${x}${y}`}
              cx={x}
              cy={y}
              r={1}
              fill="#E0E0E0"
            />
          );
        }
      }
    } else if (currentNoteStyle.pattern === 'cornell') {
      // 康奈尔笔记格式
      const leftMargin = pageWidth * 0.25;
      const bottomMargin = pageHeight * 0.2;
      
      lines.push(
        <Line
          key="cornell-left"
          x1={leftMargin}
          y1={0}
          x2={leftMargin}
          y2={pageHeight - bottomMargin}
          stroke="#E0E0E0"
          strokeWidth={1}
        />
      );
      lines.push(
        <Line
          key="cornell-bottom"
          x1={0}
          y1={pageHeight - bottomMargin}
          x2={pageWidth}
          y2={pageHeight - bottomMargin}
          stroke="#E0E0E0"
          strokeWidth={1}
        />
      );
      
      // 添加横线
      for (let y = patternSize; y < pageHeight - bottomMargin; y += patternSize) {
        lines.push(
          <Line
            key={`cornell-line${y}`}
            x1={leftMargin}
            y1={y}
            x2={pageWidth}
            y2={y}
            stroke="#E0E0E0"
            strokeWidth={0.3}
          />
        );
      }
    }
    
    return lines;
  };
  
  const currentPageData = pages[currentPage - 1] || { paths: [], images: [] };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 工具栏容器 - 确保在最上层 */}
      <View style={styles.toolbarWrapper}>
        <ToolbarContainer>
          <AllInOneToolbar
            onToolChange={handleToolChange}
            onColorChange={handleColorChange}
            onStrokeWidthChange={handleStrokeWidthChange}
            onImageUpload={handleImageUpload}
            onBookmarkAdd={handleAddBookmark}
            onBookmarkList={() => setBookmarkVisible(true)}
          />
        </ToolbarContainer>
      </View>

      <ViewerLayout
        colors={colors}
        headerLeft={<BackButton onPress={() => navigation.goBack()} color={colors.primary} background={colors.primary + '20'} />}
        headerRight={
          <SaveButton
            onSave={saveNote}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
          />
        }
        title={title}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={docId}
        navigation={navigation}
      >
        <View style={styles.pageContainer}>
          <View
            style={[
              styles.page,
              {
                backgroundColor: currentNoteStyle.backgroundColor,
                width: pageWidth,
                height: pageHeight,
                transform: [
                  { scale },
                  { translateX },
                  { translateY }
                ]
              }
            ]}
            {...panResponder.panHandlers}
          >
            {/* 页面背景样式 */}
            <View style={[styles.pageBackground, { backgroundColor: currentNoteStyle.backgroundColor }]}>
              {/* 根据样式渲染背景图案 */}
              {currentNoteStyle.pattern === 'lines' && (
                <View style={StyleSheet.absoluteFillObject}>
                  {Array.from({ length: Math.floor(pageHeight / 20) }, (_, i) => (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        top: (i + 1) * 20,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: '#E0E0E0',
                      }}
                    />
                  ))}
                </View>
              )}
              {currentNoteStyle.pattern === 'grid' && (
                <View style={StyleSheet.absoluteFillObject}>
                  {/* 垂直线 */}
                  {Array.from({ length: Math.floor(pageWidth / 20) }, (_, i) => (
                    <View
                      key={`v${i}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: (i + 1) * 20,
                        width: 1,
                        backgroundColor: '#E0E0E0',
                      }}
                    />
                  ))}
                  {/* 水平线 */}
                  {Array.from({ length: Math.floor(pageHeight / 20) }, (_, i) => (
                    <View
                      key={`h${i}`}
                      style={{
                        position: 'absolute',
                        top: (i + 1) * 20,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: '#E0E0E0',
                      }}
                    />
                  ))}
                </View>
              )}
              {currentNoteStyle.pattern === 'dots' && (
                <View style={StyleSheet.absoluteFillObject}>
                  {Array.from({ length: Math.floor(pageHeight / 20) }, (_, row) =>
                    Array.from({ length: Math.floor(pageWidth / 20) }, (_, col) => (
                      <View
                        key={`${row}-${col}`}
                        style={{
                          position: 'absolute',
                          top: (row + 1) * 20 - 1,
                          left: (col + 1) * 20 - 1,
                          width: 2,
                          height: 2,
                          borderRadius: 1,
                          backgroundColor: '#E0E0E0',
                        }}
                      />
                    ))
                  )}
                </View>
              )}
            </View>
            {/* 手写功能临时移除 - SVG 绘画层 */}
            {/* <Svg
              style={StyleSheet.absoluteFillObject}
              width={pageWidth}
              height={pageHeight}
            >
              {renderPattern()}

              {currentPageData.paths.map((pathData, index) => (
                <Path
                  key={index}
                  d={pathData.path}
                  stroke={pathData.color}
                  strokeWidth={pathData.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {currentPath && (
                <Path
                  d={currentPath}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg> */}

            {/* 渲染图片 */}
            {currentPageData.images.map((imageData, index) => (
              <Image
                key={index}
                source={{ uri: imageData.uri }}
                style={{
                  position: 'absolute',
                  left: imageData.x,
                  top: imageData.y,
                  width: (imageData.width || 100) * (imageData.scale || 1),
                  height: (imageData.height || 100) * (imageData.scale || 1),
                  transform: [{ rotate: `${imageData.rotation || 0}deg` }]
                }}
                resizeMode="contain"
              />
            ))}

            {/* 页面分隔线和指示器 - 增强可见性 */}
            <>
              <View style={styles.pageSeparator} />
              <View style={styles.pageIndicator} />
              {/* 添加页面编号显示 */}
              <View style={styles.pageNumber}>
                <Text style={styles.pageNumberText}>{currentPage}</Text>
              </View>
              {/* 添加页面边框，使页面边界更清晰 */}
              <View style={styles.pageBorder} />
            </>

            {/* 添加新页面提示 - 在最后一页显示 */}
            {currentPage === totalPages && (
              <View style={styles.addPageHint}>
                <Text style={styles.addPageHintText}>向上滑动或点击{'>'}添加新页面</Text>
              </View>
            )}
          </View>
        </View>
      </ViewerLayout>

      {/* 页码控制器 - 使用内置定位系统，与其他查看器保持一致 */}
      <PageControl
        total={totalPages}
        current={currentPage}
        onPrev={() => goToPage(currentPage - 1)}
        onNext={() => {
          if (currentPage < totalPages) {
            goToPage(currentPage + 1);
          } else {
            addNewPage();
          }
        }}
        onSubmitPage={goToPage}
        storageKey={`note_pagecontrol_${docId}`}
      />

      <BookmarkPanel
        visible={bookmarkVisible}
        onClose={() => setBookmarkVisible(false)}
        docId={docId}
        onJump={(bookmark) => {
          console.log('跳转到书签:', bookmark);
          if (bookmark.page) {
            goToPage(bookmark.page);
          }
          setBookmarkVisible(false);
        }}
      />

      {/* 缩放指示器 - 确保在工具栏下方显示 */}
      <ZoomIndicator
        visible={showZoomIndicator}
        scale={scale}
        autoHideDelay={2000}
        topOffset={80} // 增加偏移量以避免被工具栏遮挡
        style={styles.zoomIndicator}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 工具栏包装器 - 确保在最上层
  toolbarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000, // 确保工具栏在最上层
    elevation: 10, // Android阴影
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'flex-start', // 确保内容从工具栏下方开始
    alignItems: 'center',
    paddingTop: 0, // 移除顶部间距，让内容紧贴工具栏
    paddingHorizontal: 20,
    paddingBottom: 80, // 为底部页码控制器留出空间
  },
  page: {
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginBottom: 60, // 大幅增加页面间距，提供非常明显的分隔
    position: 'relative',
    // 添加明显的边框以增强页面分隔效果
    borderWidth: 3,
    borderColor: '#B0B0B0', // 使用更深的边框颜色
    // 添加强烈的页面阴影效果
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    // 添加背景色区分
    backgroundColor: '#FAFAFA',
  },
  // 添加页面样式背景
  pageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
  },
  // 页面分隔指示器 - 修复位置，确保可见
  pageIndicator: {
    position: 'absolute',
    bottom: 10, // 修复位置，确保在页面内可见
    left: '50%',
    transform: [{ translateX: -60 }],
    width: 120,
    height: 8,
    backgroundColor: '#FF4500', // 使用更醒目的橙红色
    borderRadius: 4,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
    // 添加双重边框增强效果
    borderWidth: 2,
    borderColor: '#DC143C',
    zIndex: 5, // 确保在其他元素之上但不遮挡重要内容
  },
  // 页面分隔线 - 修复位置，确保可见
  pageSeparator: {
    position: 'absolute',
    bottom: 25, // 修复位置，确保在页面内可见
    left: 10,
    right: 10,
    height: 4,
    backgroundColor: '#FF6B6B', // 使用醒目的红色
    borderRadius: 2,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
    // 添加边框增强效果
    borderWidth: 1,
    borderColor: '#FF4444',
    zIndex: 5, // 确保在其他元素之上但不遮挡重要内容
  },

  // 缩放指示器样式
  zoomIndicator: {
    zIndex: 999, // 确保在工具栏下方但在内容上方
  },
  // 页面边框 - 清晰的页面边界
  pageBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    borderStyle: 'solid',
  },
  // 页面编号显示 - 增强视觉效果
  pageNumber: {
    position: 'absolute',
    bottom: -40,
    right: 15,
    backgroundColor: '#FF4500', // 使用醒目的橙红色
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    // 添加边框和阴影
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  pageNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // 添加新页面提示
  addPageHint: {
    position: 'absolute',
    bottom: -60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addPageHintText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },

});

export default PagedNoteScreen;
