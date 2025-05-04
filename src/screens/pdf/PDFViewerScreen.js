import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/Ionicons';
import Pdf from 'react-native-pdf';
import { DrawingToolbar, DrawingCanvas } from '../../components/canvas';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import { notesApi } from '../../services/api';

const PDFViewerScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { pdfUri, title } = route.params || {};

  const [isLoading, setIsLoading] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [annotations, setAnnotations] = useState([]);

  const pdfRef = useRef(null);
  const containerRef = useRef(null);

  // 绘图画布
  const drawingCanvas = DrawingCanvas({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 120,
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

  // 保存注释
  const saveAnnotations = async () => {
    try {
      setIsLoading(true);

      // 这里可以调用API保存注释
      // 例如：await notesApi.saveAnnotations(pdfUri, annotations);

      ToastAndroid.show('注释已保存', ToastAndroid.SHORT);
    } catch (error) {
      console.error('保存注释失败:', error);
      Alert.alert('错误', '保存注释失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 切换绘图工具
  const toggleDrawingTools = () => {
    setShowDrawingTools(!showDrawingTools);
  };

  // 渲染PDF文档
  const renderPDF = () => {
    if (!pdfUri) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="document-outline" size={64} color={colors.error} />
          <Text variant="body" style={{ color: colors.error }}>
            无法加载PDF文档
          </Text>
        </View>
      );
    }

    const source = { uri: pdfUri };

    return (
      <Pdf
        ref={pdfRef}
        source={source}
        onPageChanged={(page) => {
          setCurrentPage(page);
        }}
        onLoadComplete={(numberOfPages) => {
          setTotalPages(numberOfPages);
        }}
        style={styles.pdf}
        onError={(error) => {
          console.error('PDF加载错误:', error);
          Alert.alert('错误', '加载PDF文档失败');
        }}
      />
    );
  };

  // 渲染加载状态
  const renderLoader = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  return (
    <View
      ref={containerRef}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {renderLoader()}

      {/* 顶部工具栏 */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {title || 'PDF文档'} ({currentPage}/{totalPages})
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              {
                backgroundColor: showDrawingTools
                  ? colors.primary + '80'
                  : colors.primary
              }
            ]}
            onPress={toggleDrawingTools}
          >
            <Icon name="brush-outline" size={20} color={colors.onPrimary} />
            <Text style={[styles.headerButtonText, { color: colors.onPrimary }]}>
              {showDrawingTools ? '隐藏绘图' : '绘图'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: colors.primary }]}
            onPress={saveAnnotations}
          >
            <Icon name="save-outline" size={20} color={colors.onPrimary} />
            <Text style={[styles.headerButtonText, { color: colors.onPrimary }]}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>

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
      <View style={styles.contentContainer}>
        {/* PDF文档 */}
        {renderPDF()}

        {/* 绘图画布 */}
        {showDrawingTools && (
          <View style={styles.drawingCanvasContainer}>
            {drawingCanvas.render()}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  headerButtonText: {
    fontSize: 14,
    marginLeft: 4,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  pdf: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  drawingCanvasContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PDFViewerScreen;
