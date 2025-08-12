import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Alert, Platform, Image, StatusBar } from 'react-native';
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
// 手写功能临时移除
// import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { offlineStorageService } from '../../services/offline';
import { useInputMode } from '../../utils/inputDetection';
import { useDispatch } from 'react-redux';
import { addNote } from '../../redux/slices/notesSlice';

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

  // 组件加载时自动保存初始状态
  useEffect(() => {
    const saveInitialState = async () => {
      try {
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

        console.log('PagedNoteScreen: 初始状态已保存', initialNoteData);
      } catch (error) {
        console.error('PagedNoteScreen: 保存初始状态失败:', error);
      }
    };

    saveInitialState();
  }, []); // 只在组件挂载时执行一次

  
  // 手势处理 - 简化版本，专注于缩放和翻页
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 2) {
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
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 2) {
        // 缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) + 
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        
        if (isScaling.current) {
          const newScale = Math.max(0.5, Math.min(3, initialScale.current * (distance / initialDistance.current)));
          tempScale.current = newScale;

          // 节流更新状态（每16ms更新一次，约60fps）
          const now = Date.now();
          if (!lastTap.current || now - lastTap.current > 16) {
            setScale(newScale);
            lastTap.current = now;
          }
        }
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {

      // 手写功能临时移除
      // if (isDrawing && currentPath) {
      //   const newPages = [...pages];
      //   if (!newPages[currentPage - 1]) {
      //     newPages[currentPage - 1] = { paths: [], images: [] };
      //   }
      //   newPages[currentPage - 1].paths.push({
      //     path: currentPath,
      //     color: strokeColor,
      //     width: strokeWidth,
      //     tool: currentTool
      //   });
      //   setPages(newPages);
      //   setCurrentPath('');
      // }

      // 手指上下滑动翻页检测 - 简化版本
      if (evt.nativeEvent.touches.length <= 1 && Math.abs(gestureState.dy) > 50 && Math.abs(gestureState.dx) < 100) {
        if (gestureState.dy < 0) {
          // 向上滑动 - 下一页
          if (currentPage < totalPages) {
            goToPage(currentPage + 1);
          } else {
            addNewPage();
          }
        } else {
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

    const newImage = {
      id: Date.now(),
      uri: imageUri,
      x: pageWidth / 2 - 50, // 居中显示，减去图片宽度的一半
      y: pageHeight / 2 - 50, // 居中显示，减去图片高度的一半
      scale: 1,
      rotation: 0,
      width: imageData.width || 100,
      height: imageData.height || 100
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
  
  // 手写功能临时移除 - 背景图案渲染
  const renderPattern = () => {
    // 临时返回null，移除SVG渲染
    return null;
    
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
        externalToolbarHeight={Platform.OS === 'ios' ? 65 : 35}
      >
        <View style={styles.pageContainer}>
          <View 
            style={[
              styles.page, 
              { 
                backgroundColor: currentNoteStyle.backgroundColor,
                width: pageWidth * scale,
                height: pageHeight * scale,
                transform: [{ scale }]
              }
            ]}
            {...panResponder.panHandlers}
          >
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
                  left: imageData.x * scale,
                  top: imageData.y * scale,
                  width: (imageData.width || 100) * imageData.scale * scale,
                  height: (imageData.height || 100) * imageData.scale * scale,
                  transform: [{ rotate: `${imageData.rotation}deg` }]
                }}
                resizeMode="contain"
              />
            ))}


          </View>
        </View>
      </ViewerLayout>

      {/* 页码控制器 */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  page: {
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

});

export default PagedNoteScreen;
