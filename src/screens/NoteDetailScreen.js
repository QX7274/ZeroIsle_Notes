import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateNote } from '../redux/slices/notesSlice';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/Ionicons';
import { DrawingToolbar, DrawingCanvas } from '../components/canvas';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import Pdf from 'react-native-pdf';
import { notesApi } from '../services/api';

const NoteDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { note } = route.params || {};

  const [isLoading, setIsLoading] = useState(false);
  const [noteData, setNoteData] = useState(null);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const contentRef = useRef(null);
  const scrollViewRef = useRef(null);

  // 绘图画布
  const drawingCanvas = DrawingCanvas({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 200,
    backgroundColor: 'transparent',
    onStrokeEnd: (path) => {
      // 保存绘图路径到注释
      const newAnnotation = {
        id: Date.now().toString(),
        page: currentPage,
        path,
      };
      setAnnotations([...annotations, newAnnotation]);
    },
    onScreenshotTaken: (uri) => {
      // 处理截图
      handleScreenshotTaken(uri);
    },
  });

  useEffect(() => {
    if (note && note.id) {
      loadNoteDetail(note.id);
    }
  }, [note]);

  // 加载笔记详情
  const loadNoteDetail = async (noteId) => {
    try {
      setIsLoading(true);
      const response = await notesApi.getById(noteId);

      if (response.success) {
        setNoteData(response.data);

        // 加载注释
        if (response.data.annotations) {
          setAnnotations(response.data.annotations);
        }
      } else {
        Alert.alert('错误', '加载笔记失败');
      }
    } catch (error) {
      console.error('加载笔记详情失败:', error);
      Alert.alert('错误', '加载笔记详情失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 保存笔记
  const saveNote = async () => {
    try {
      setIsLoading(true);

      // 更新笔记数据，包括注释
      const updatedNote = {
        ...noteData,
        annotations,
      };

      // 调用API保存笔记
      const response = await notesApi.update(noteData.id, updatedNote);

      if (response.success) {
        // 更新Redux状态
        dispatch(updateNote({
          id: noteData.id,
          noteData: updatedNote,
        }));

        ToastAndroid.show('笔记已保存', ToastAndroid.SHORT);
      } else {
        throw new Error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存笔记失败:', error);
      Alert.alert('错误', error.message || '保存笔记失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理截图
  const handleScreenshotTaken = async (uri) => {
    try {
      // 创建截图笔记
      const fileName = `screenshot_${Date.now()}.png`;
      const newPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      // 复制截图到应用目录
      await RNFS.copyFile(uri, newPath);

      // 创建新笔记
      const screenshotNote = {
        title: `截图 ${new Date().toLocaleString()}`,
        content: '',
        type: 'image',
        metadata: {
          imagePath: newPath,
        },
      };

      // 保存截图笔记
      const response = await notesApi.create(screenshotNote);

      if (response.success) {
        ToastAndroid.show('截图已保存为新笔记', ToastAndroid.SHORT);
      } else {
        throw new Error(response.message || '保存截图失败');
      }
    } catch (error) {
      console.error('保存截图失败:', error);
      Alert.alert('错误', '保存截图失败');
    }
  };

  // 渲染PDF文档
  const renderPDF = () => {
    if (!noteData || !noteData.metadata || !noteData.metadata.pdfPath) {
      return null;
    }

    const source = { uri: noteData.metadata.pdfPath };

    return (
      <View style={styles.pdfContainer}>
        <Pdf
          source={source}
          onPageChanged={(page) => setCurrentPage(page)}
          style={styles.pdf}
          onError={(error) => {
            console.error('PDF加载错误:', error);
          }}
        />
      </View>
    );
  };

  // 渲染图片
  const renderImage = () => {
    if (!noteData || !noteData.metadata || !noteData.metadata.imagePath) {
      return null;
    }

    return (
      <Image
        source={{ uri: noteData.metadata.imagePath }}
        style={styles.image}
        resizeMode="contain"
      />
    );
  };

  // 渲染文本内容
  const renderTextContent = () => {
    if (!noteData) return null;

    return (
      <View style={styles.textContainer}>
        <Text variant="heading" level="h1" style={styles.title}>
          {noteData.title}
        </Text>
        <Text variant="body" style={styles.content}>
          {noteData.content}
        </Text>
      </View>
    );
  };

  // 渲染画布内容
  const renderCanvasContent = () => {
    if (!noteData || noteData.type !== 'canvas') return null;

    return (
      <View style={styles.canvasContainer}>
        {/* 这里可以渲染画布内容 */}
        <Text>画布内容</Text>
      </View>
    );
  };

  // 渲染注释
  const renderAnnotations = () => {
    if (!annotations || annotations.length === 0) return null;

    // 只渲染当前页的注释
    const currentPageAnnotations = annotations.filter(
      (annotation) => annotation.page === currentPage
    );

    return (
      <View style={styles.annotationsContainer}>
        {currentPageAnnotations.map((annotation) => (
          <View key={annotation.id} style={styles.annotationItem}>
            {/* 这里可以渲染注释内容 */}
          </View>
        ))}
      </View>
    );
  };

  // 渲染加载状态
  if (isLoading && !noteData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 绘图工具栏 */}
      {showDrawingTools && (
        <DrawingToolbar
          onToolChange={drawingCanvas.handleToolChange}
          onColorChange={drawingCanvas.handleColorChange}
          onStrokeWidthChange={drawingCanvas.handleStrokeWidthChange}
          onUndo={drawingCanvas.handleUndo}
          onRedo={drawingCanvas.handleRedo}
          canUndo={drawingCanvas.canUndo}
          canRedo={drawingCanvas.canRedo}
          onScreenshot={drawingCanvas.handleScreenshot}
          onClear={drawingCanvas.handleClear}
        />
      )}

      {/* 内容区域 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View ref={contentRef} style={styles.contentContainer}>
          {/* 根据笔记类型渲染不同内容 */}
          {noteData && noteData.type === 'pdf' && renderPDF()}
          {noteData && noteData.type === 'image' && renderImage()}
          {noteData && (noteData.type === 'note' || !noteData.type) && renderTextContent()}
          {noteData && noteData.type === 'canvas' && renderCanvasContent()}

          {/* 绘图画布 */}
          {showDrawingTools && drawingCanvas.render()}

          {/* 注释 */}
          {renderAnnotations()}
        </View>
      </ScrollView>

      {/* 底部工具栏 */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={() => setShowDrawingTools(!showDrawingTools)}
        >
          <Icon
            name={showDrawingTools ? 'brush-outline' : 'brush'}
            size={24}
            color={colors.text}
          />
          <Text style={[styles.bottomBarButtonText, { color: colors.text }]}>
            {showDrawingTools ? '隐藏绘图' : '显示绘图'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={() => {
            // 导航到知识图谱分析页面
            navigation.navigate('KnowledgeAnalysis', {
              noteId: noteData?.id,
              noteTitle: noteData?.title
            });
          }}
        >
          <Icon name="analytics-outline" size={24} color={colors.text} />
          <Text style={[styles.bottomBarButtonText, { color: colors.text }]}>
            知识图谱
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={saveNote}
        >
          <Icon name="save-outline" size={24} color={colors.text} />
          <Text style={[styles.bottomBarButtonText, { color: colors.text }]}>
            保存
          </Text>
        </TouchableOpacity>
      </View>
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
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  textContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  title: {
    marginBottom: 20,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  content: {
    lineHeight: 26,
    fontSize: 16,
  },
  pdfContainer: {
    flex: 1,
    height: Dimensions.get('window').height - 200,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 200,
    borderRadius: 16,
  },
  image: {
    width: '100%',
    height: Dimensions.get('window').height - 200,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  canvasContainer: {
    flex: 1,
    height: Dimensions.get('window').height - 200,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  annotationsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  annotationItem: {
    position: 'absolute',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  bottomBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bottomBarButtonText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default NoteDetailScreen;
