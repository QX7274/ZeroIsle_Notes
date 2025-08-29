/**
 * 流畅无限画布界面 - 重新实现版本
 * 支持流畅缩放（最小50%）、各个方向移动、四种样式选择
 * 样式与CanvasStyleModal.js保持一致
 */

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  PanResponder,
  Animated
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import { addNote, updateNote } from '../../redux/slices/notesSlice';

// 导入PDF界面的成熟组件
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import BackButton from '../../components/viewer/BackButton';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import ZoomIndicator from '../../components/common/ZoomIndicator';

import Svg, { Rect, Line, Circle } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FluidInfiniteCanvasScreen = ({ route, navigation }) => {
  const { title = '无限画布', noteId, canvasStyle = 'white', createNew = false } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  // 核心状态
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState(title);
  

  
  // 缩放状态
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  // 引用
  const scrollViewRef = useRef(null);
  const contentRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialTranslate = useRef({ x: 0, y: 0 });
  const isTransforming = useRef(false);

  // 画布样式配置 - 与CanvasStyleModal.js保持一致
  const canvasStyles = {
    white: {
      backgroundColor: '#FFFFFF',
      pattern: null,
      name: '白色纸张',
      description: '纯白色背景，适合一般绘画'
    },
    yellow: {
      backgroundColor: '#FFF8DC',
      pattern: null,
      name: '淡黄色纸张',
      description: '温暖的淡黄色背景，护眼舒适'
    },
    grid: {
      backgroundColor: '#FFFFFF',
      pattern: 'grid',
      name: '方格纸',
      description: '网格背景，适合绘制图表和几何图形'
    },
    lines: {
      backgroundColor: '#FFFFFF',
      pattern: 'lines',
      name: '横线纸',
      description: '横线背景，适合书写和笔记'
    }
  };

  const currentCanvasStyle = canvasStyles[canvasStyle] || canvasStyles.white;

  // 隐藏底部状态栏
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarVisible: false });
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, [navigation]);

  // 返回处理
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // 创建新画布
  const createNewCanvas = async () => {
    try {
      const newNoteId = `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newCanvas = {
        _id: newNoteId,
        id: newNoteId,
        title: noteTitle || '无限画布',
        content: content || '',
        type: 'note',
        file_type: 'canvas',
        content_type: 'canvas',
        canvasStyle: canvasStyle,
        scale: 1,
        translateX: 0,
        translateY: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        isNew: true
      };

      // 保存到本地存储
      const result = await offlineStorageService.saveNote(newCanvas);
      
      if (result.success) {
        setNoteData(newCanvas);
        setPages(newCanvas.pages || [{ content: '', pageNumber: 1 }]);
        setTotalPages(1);
        setScale(newCanvas.scale || 1);
        setTranslateX(newCanvas.translateX || 0);
        setTranslateY(newCanvas.translateY || 0);
        dispatch(addNote(newCanvas));
        console.log('新画布创建成功:', newNoteId, 'isNew:', true);
        return newCanvas;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('创建新画布失败:', error);
      Alert.alert('错误', '创建画布失败，请重试');
      return null;
    }
  };

  // 加载画布数据
  const loadCanvasData = async () => {
    try {
      setIsLoading(true);
      console.log('开始加载画布, noteId:', noteId, 'createNew:', createNew, 'canvasStyle:', canvasStyle);

      if (noteId) {
        // 尝试加载现有画布
        const existingCanvas = await offlineStorageService.getNote(noteId);
        if (existingCanvas) {
          console.log('找到现有画布:', existingCanvas.id);
          setNoteData(existingCanvas);
          setContent(existingCanvas.content || '');
          setNoteTitle(existingCanvas.title || '无限画布');
          

          
          // 恢复缩放和移动状态
          setScale(existingCanvas.scale || 1);
          setTranslateX(existingCanvas.translateX || 0);
          setTranslateY(existingCanvas.translateY || 0);
          
          setIsLoading(false);
          return;
        } else {
          console.log('未找到画布:', noteId);
          // 如果明确要求创建新画布
          if (createNew) {
            console.log('明确要求创建新画布');
            const newCanvas = await createNewCanvas();
            if (newCanvas) {
              setIsLoading(false);
              return;
            }
          } else {
            // 保持空白状态，不创建新画布
            console.log('保持空白状态，不创建新画布');
            setNoteData(null);
            setContent('');
            setNoteTitle(title || '无限画布');
            setIsLoading(false);
            return;
          }
        }
      } else {
        // 没有 noteId
        if (createNew) {
          console.log('没有 noteId，但要求创建新画布');
          const newCanvas = await createNewCanvas();
          if (newCanvas) {
            setIsLoading(false);
            return;
          }
        } else {
          // 保持空白状态
          console.log('没有 noteId，保持空白状态');
          setNoteData(null);
          setContent('');
          setNoteTitle(title || '无限画布');
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('加载画布失败:', error);
      Alert.alert('错误', '加载画布失败，请重试');
      setIsLoading(false);
    }
  };



  // 手势处理 - 支持流畅缩放（最小50%）和各个方向移动
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      return evt.nativeEvent.touches.length === 1 || evt.nativeEvent.touches.length === 2;
    },
    
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return evt.nativeEvent.touches.length === 1 || evt.nativeEvent.touches.length === 2;
    },

    onPanResponderGrant: (evt) => {
      const { touches } = evt.nativeEvent;
      
      if (touches.length === 2) {
        // 双指缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        initialDistance.current = distance;
        initialScale.current = scale;
        initialTranslate.current = { x: translateX, y: translateY };
        isTransforming.current = true;
      } else if (touches.length === 1) {
        // 单指移动
        initialTranslate.current = { x: translateX, y: translateY };
        isTransforming.current = true;
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 2 && isTransforming.current) {
        // 双指缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        const scaleRatio = distance / initialDistance.current;
        let newScale = initialScale.current * scaleRatio;

        // 最小缩放限制为50%
        newScale = Math.max(0.5, Math.min(5, newScale));

        // 添加缩放步进，使缩放更平滑
        const scaleStep = 0.01;
        newScale = Math.round(newScale / scaleStep) * scaleStep;

        setScale(newScale);
        
        // 只在缩放变化时显示指示器
        if (Math.abs(newScale - scale) > 0.01) {
          setShowZoomIndicator(true);
        }
      } else if (touches.length === 1 && isTransforming.current) {
        // 单指移动 - 支持各个方向
        const newTranslateX = initialTranslate.current.x + gestureState.dx;
        const newTranslateY = initialTranslate.current.y + gestureState.dy;
        
        setTranslateX(newTranslateX);
        setTranslateY(newTranslateY);
      }
    },
    
    onPanResponderRelease: () => {
      isTransforming.current = false;
      // 延迟隐藏缩放指示器
      setTimeout(() => {
        setShowZoomIndicator(false);
      }, 2000);
    }
  });

  // 保存画布数据
  const saveCanvasData = async () => {
    try {
      if (!noteData) {
        const newCanvas = await createNewCanvas();
        return newCanvas !== null;
      }

      // 更新现有画布
      const updatedCanvas = {
        ...noteData,
        title: noteTitle,
        content: content,
        canvasStyle: canvasStyle,
        scale: scale,
        translateX: translateX,
        translateY: translateY,
        updated_at: new Date().toISOString()
      };

      console.log('准备保存画布:', updatedCanvas.id);
      
      const result = await offlineStorageService.saveNote(updatedCanvas);

      if (result.success) {
        setNoteData(updatedCanvas);
        dispatch(updateNote(updatedCanvas));
        console.log('画布保存成功:', updatedCanvas.id);
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存画布失败:', error);
      Alert.alert('保存失败', '画布保存失败，请稍后重试');
      return false;
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadCanvasData();
  }, [noteId, createNew, canvasStyle]);

  // 渲染画布背景
  const renderCanvasBackground = () => {
    const style = currentCanvasStyle;
    
    return (
      <View style={[styles.canvasBackground, { backgroundColor: style.backgroundColor }]}>
        {style.pattern === 'lines' && renderLinesPattern()}
        {style.pattern === 'grid' && renderGridPattern()}
        {style.pattern === 'dots' && renderDotsPattern()}
      </View>
    );
  };

  // 渲染横线背景
  const renderLinesPattern = () => {
    return Array.from({ length: Math.floor(screenHeight / 30) }, (_, index) => (
      <View
        key={index}
        style={[
          styles.line,
          { top: (index + 1) * 30 }
        ]}
      />
    ));
  };

  // 渲染网格背景
  const renderGridPattern = () => {
    const gridSize = 20;
    const lines = [];
    
    // 垂直线
    for (let x = 0; x < screenWidth; x += gridSize) {
      lines.push(
        <View
          key={`v-${x}`}
          style={[
            styles.gridLine,
            { left: x, width: 1, height: screenHeight }
          ]}
        />
      );
    }
    
    // 水平线
    for (let y = 0; y < screenHeight; y += gridSize) {
      lines.push(
        <View
          key={`h-${y}`}
          style={[
            styles.gridLine,
            { top: y, height: 1, width: screenWidth }
          ]}
        />
      );
    }
    
    return lines;
  };

  // 渲染点阵背景
  const renderDotsPattern = () => {
    const dotSpacing = 20;
    const dots = [];
    
    for (let x = dotSpacing; x < screenWidth; x += dotSpacing) {
      for (let y = dotSpacing; y < screenHeight; y += dotSpacing) {
        dots.push(
          <View
            key={`dot-${x}-${y}`}
            style={[
              styles.dot,
              { left: x, top: y }
            ]}
          />
        );
      }
    }
    
    return dots;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="正在加载画布..." />
      </View>
    );
  }

  // 渲染画布内容
  const renderCanvasContent = () => {
    return (
      <View style={styles.canvasContainer}>
        {/* 画布背景 */}
        {renderCanvasBackground()}
        
        {/* 画布内容 */}
        <View style={styles.canvasContent}>
          <Text style={[styles.canvasText, { color: colors.text }]}>
            {content || ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={() => {}}
          onColorChange={() => {}}
          onStrokeWidthChange={() => {}}
          onImageUpload={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
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
          <SaveButton
            onSave={saveCanvasData}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
          />
        }
        title={noteTitle}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={noteData?.id}
        navigation={navigation}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              transform: [
                { scale: scale },
                { translateX: translateX },
                { translateY: translateY }
              ]
            }
          ]}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
          scrollEnabled={true}
          bounces={true}

          scrollEventThrottle={16}
          {...panResponder.panHandlers}
        >
          {/* 渲染画布内容 */}
          {renderCanvasContent()}
        </ScrollView>
      </ViewerLayout>



      {/* 缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={30}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  canvasContainer: {
    position: 'relative',
    minHeight: screenHeight * 2, // 支持更大的画布
    minWidth: screenWidth * 2,   // 支持更大的画布
    padding: 20,
  },
  canvasBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  line: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#E0E0E0',
  },
  canvasContent: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 40,
    minHeight: screenHeight - 80,
  },
  canvasText: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
});

export default FluidInfiniteCanvasScreen;
