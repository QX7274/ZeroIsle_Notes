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
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateNote } from '../../redux/slices/notesSlice';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { InfiniteDrawingCanvas } from '../../components/canvas';
import { AllInOneToolbar } from '../../components/common';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import Pdf from 'react-native-pdf';
import notesApi from '../../services/api/notesApi';

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
  const drawingCanvas = InfiniteDrawingCanvas({
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
    // 从route.params中获取noteId
    const noteId = route.params?.noteId;
    console.log('NoteDetailScreen useEffect - route.params:', route.params);

    if (noteId) {
      console.log('使用route.params.noteId加载笔记:', noteId);
      loadNoteDetail(noteId);
    } else if (note && (note.id || note._id)) {
      const id = note.id || note._id;
      console.log('使用note.id或note._id加载笔记:', id);
      loadNoteDetail(id);
    } else {
      console.warn('没有有效的笔记ID，无法加载笔记详情');
    }
  }, [route.params, note]);

  // 检查是否是PDF文件，如果是，则导航到PDFViewer
  useEffect(() => {
    if (noteData) {
      // 检查是否是PDF文件
      const isPdf =
        noteData.type === 'pdf' ||
        noteData.file_type === 'pdf' ||
        (noteData.file_name && noteData.file_name.toLowerCase().endsWith('.pdf')) ||
        (noteData.file_uri && noteData.file_uri.toLowerCase().endsWith('.pdf'));

      // 检查是否有文件URI
      if (isPdf && noteData.file_uri) {
        console.log('检测到PDF文件，导航到PDFViewer:', noteData.file_uri);

        // 导航到PDFViewer
        navigation.navigate('PDFViewer', {
          uri: noteData.file_uri,
          title: noteData.title || '未命名PDF',
          noteId: noteData.id || noteData._id
        });
      } else if (isPdf) {
        // 如果是PDF但没有file_uri，尝试使用其他字段
        const possibleUris = [
          noteData.uri,
          noteData.path,
          noteData.file_path,
          noteData.url
        ].filter(Boolean);

        if (possibleUris.length > 0) {
          console.log('检测到PDF文件，使用备用URI导航到PDFViewer:', possibleUris[0]);

          // 导航到PDFViewer
          navigation.navigate('PDFViewer', {
            uri: possibleUris[0],
            title: noteData.title || '未命名PDF',
            noteId: noteData.id || noteData._id
          });
        } else {
          console.warn('检测到PDF文件，但没有有效的URI:', noteData);
        }
      }
    }
  }, [noteData]);

  // 加载笔记详情
  const loadNoteDetail = async (noteId) => {
    try {
      setIsLoading(true);
      console.log(`开始加载笔记详情 (ID: ${noteId})`);
      const startTime = Date.now();

      // 设置加载超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('笔记加载超时，请稍后重试'));
        }, 20000); // 20秒超时
      });

      // 尝试多种方式获取笔记
      let response = null;

      try {
        // 1. 首先尝试使用notesApi.getNote
        console.log('尝试使用notesApi.getNote获取笔记');
        const responsePromise = notesApi.getNote(noteId);
        response = await Promise.race([responsePromise, timeoutPromise]);
      } catch (apiError) {
        console.warn('使用notesApi.getNote获取笔记失败:', apiError);

        // 2. 如果失败，尝试使用notesApi.getById
        try {
          console.log('尝试使用notesApi.getById获取笔记');
          response = await Promise.race([notesApi.getById(noteId), timeoutPromise]);
        } catch (getByIdError) {
          console.warn('使用notesApi.getById获取笔记失败:', getByIdError);

          // 3. 如果仍然失败，尝试直接从offlineStorageService获取
          try {
            console.log('尝试直接从offlineStorageService获取笔记');
            const { offlineStorageService } = require('../../services/offline/offlineStorageService');
            const note = await offlineStorageService.getNote(noteId);

            if (note) {
              response = {
                success: true,
                data: note
              };
            } else {
              throw new Error('未找到笔记');
            }
          } catch (storageError) {
            console.error('所有获取笔记的方法都失败:', storageError);
            throw new Error('无法获取笔记数据，请重启应用后重试');
          }
        }
      }

      console.log(`笔记详情加载完成，耗时: ${Date.now() - startTime}ms`);

      if (response && response.success) {
        // 确保笔记数据有效
        if (!response.data) {
          throw new Error('获取到的笔记数据为空');
        }

        // 统一ID字段
        const noteData = {
          ...response.data,
          id: response.data.id || response.data._id || noteId,
          _id: response.data._id || response.data.id || noteId
        };

        console.log('设置笔记数据:', noteData.title);
        setNoteData(noteData);

        // 加载注释
        if (noteData.annotations) {
          setAnnotations(noteData.annotations);
        }
      } else {
        const errorMsg = response?.message || '加载笔记失败';
        console.error('加载笔记失败:', errorMsg);
        Alert.alert('错误', errorMsg);
      }
    } catch (error) {
      console.error('加载笔记详情失败:', error);

      // 提供更详细的错误信息
      let errorMessage = '加载笔记详情失败';

      if (error.message) {
        if (error.message.includes('超时')) {
          errorMessage = '笔记加载超时，可能是数据库操作耗时较长。请稍后重试。';
        } else if (error.message.includes('数据库')) {
          errorMessage = '数据库操作失败，请重启应用后重试。';
        } else {
          errorMessage = `加载失败: ${error.message}`;
        }
      }

      Alert.alert('错误', errorMessage);
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
      const response = notesApi.updateNote(noteData.id, updatedNote);

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
      const response = notesApi.createNote(screenshotNote);

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

    // 确保标题和内容有默认值
    const title = noteData.title || '无标题笔记';
    const content = noteData.content || '暂无内容';

    return (
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {title}
        </Text>
        <Text style={styles.content}>
          {content}
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
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            正在加载笔记...
          </Text>
          <Text style={[styles.loadingSubText, { color: colors.text }]}>
            首次加载可能需要较长时间
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部固定工具栏 */}
      {showDrawingTools && (
        <View style={styles.toolbarContainer}>
          <AllInOneToolbar
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
        </View>
      )}

      {/* 内容区域 */}
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { marginTop: showDrawingTools ? 0 : 0 }]}
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

        <TouchableOpacity
          style={styles.bottomBarButton}
          onPress={async () => {
            if (noteData) {
              Alert.alert(
                '删除笔记',
                '确定要删除这条笔记吗？此操作无法撤销。',
                [
                  { text: '取消', style: 'cancel' },
                  { 
                    text: '删除', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setIsLoading(true);
                        await dispatch(deleteNote(noteData.id)).unwrap();
                        navigation.goBack();
                        ToastAndroid.show('笔记已删除', ToastAndroid.SHORT);
                      } catch (error) {
                        console.error('删除笔记失败:', error);
                        Alert.alert('删除失败', error.message || '无法删除笔记，请重试');
                      } finally {
                        setIsLoading(false);
                      }
                    }
                  }
                ]
              );
            }
          }}>
          <Icon name="trash-outline" size={24} color={colors.danger} />
          <Text style={[styles.bottomBarButtonText, { color: colors.danger }]}>
            删除
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubText: {
    fontSize: 14,
    marginTop: 10,
    opacity: 0.7,
    textAlign: 'center',
  },
  toolbarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.card,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scrollView: {
    flex: 1,
    marginTop: 50, 
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 20, // 调整顶部内边距
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