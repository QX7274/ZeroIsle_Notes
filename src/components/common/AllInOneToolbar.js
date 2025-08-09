import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path } from 'react-native-svg';
import { Text } from './Typography';
import { useTheme } from '../../context/ThemeContext';
import { noteAIService } from '../../services/notes/noteAIService';
import { chatHistoryService as aiHistoryService } from '../../services/ai/chatHistoryService';
import { launchImageLibrary } from 'react-native-image-picker';

// 预定义颜色
const COLORS = [
  '#000000', // 黑色
  '#FF0000', // 红色
  '#0000FF', // 蓝色
  '#008000', // 绿色
  '#FFA500', // 橙色
  '#800080', // 紫色
  '#FFC0CB', // 粉色
  '#FFFF00', // 黄色
  '#00FFFF', // 青色
  '#A52A2A', // 棕色
  '#4B0082', // 靛蓝
  '#006400', // 深绿
  '#8B4513', // 棕褐色
  '#4682B4', // 钢蓝
  '#D2691E', // 巧克力色
  '#9ACD32', // 黄绿色
  '#CD5C5C', // 印度红
  '#708090', // 石板灰
];

// 预定义笔触粗细
const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12, 16, 20];

// 绘图工具类型
const DRAWING_TOOLS = Object.freeze({
  PEN: 'pen',
  PENCIL: 'pencil',
  BRUSH: 'brush',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  CALLIGRAPHY: 'calligraphy',
  SELECT: 'select',
  MOVE: 'move',
  UNDO: 'undo',
  REDO: 'redo',
  CLEAR: 'clear'
});

// 形状类型
const SHAPES = Object.freeze({
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  DIAMOND: 'diamond', // 菱形
  PARALLELOGRAM: 'parallelogram', // 平行四边形
  ELLIPSE: 'ellipse', // 椭圆
  ARROW: 'arrow',
  ARC: 'arc', // 弧形
  STAR: 'star',
  POLYGON: 'polygon',
  CURVE: 'curve'
});

// AI工具类型
const AI_TOOLS = [
  { id: 'translate', label: '翻译', icon: 'translate', description: '翻译选中的文本' },
  { id: 'code_recognition', label: '代码识别', icon: 'code-braces', description: '识别并格式化代码' },
  { id: 'math_formula', label: '数学公式', icon: 'function-variant', description: '识别数学公式并转换为LaTeX' },
  { id: 'summarize', label: '摘要', icon: 'text-box', description: '生成文本摘要' },
  { id: 'extract_keywords', label: '提取关键词', icon: 'key', description: '从文本中提取关键词' },
  { id: 'explain', label: '解释', icon: 'help', description: '解释选中的内容' },
  { id: 'rewrite', label: '改写', icon: 'pencil', description: '改写选中的文本' },
  { id: 'grammar', label: '语法检查', icon: 'spellcheck', description: '检查文本的语法和拼写' },
  { id: 'simplify', label: '简化', icon: 'text-short', description: '简化复杂的文本' },
];

// 擦除区域大小选项
const ERASER_SIZES = [
  { size: 8, label: '小' },
  { size: 16, label: '中' },
  { size: 24, label: '大' },
  { size: 32, label: '特大' }
];

const AllInOneToolbar = ({
  // 绘图工具相关props
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onClear,
  initialTool = DRAWING_TOOLS.PEN,
  initialColor = '#000000',
  initialStrokeWidth = 2,

  // AI工具相关props
  onAIToolSelect,
  selectedText,
  onAIProcessResult,
  onImageUpload,
}) => {
  const { colors } = useTheme();
  const [activeTool, setActiveTool] = useState(initialTool);
  const [activeColor, setActiveColor] = useState(initialColor);
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(initialStrokeWidth);
  const [activeShape, setActiveShape] = useState(SHAPES.LINE);
  const [activeEraserSize, setActiveEraserSize] = useState(16); // 默认中等擦除区域大小

  // AI工具相关状态
  const [showAIToolModal, setShowAIToolModal] = useState(false);
  const [showAIHistoryModal, setShowAIHistoryModal] = useState(false);
  const [selectedAITool, setSelectedAITool] = useState(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiHistory, setAIHistory] = useState([]);

  // 选择器状态
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeWidthPicker, setShowStrokeWidthPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showEraserSizePicker, setShowEraserSizePicker] = useState(false);

  // 处理图片上传
  const handleImageUpload = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      console.log('图片选择响应:', response);

      if (response.didCancel) {
        console.log('用户取消了图片选择');
        return;
      }

      if (response.errorMessage) {
        console.error('图片选择错误:', response.errorMessage);
        Alert.alert('错误', '选择图片失败: ' + response.errorMessage);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        console.log('选择的图片:', asset);

        // 调用回调函数，传递图片信息
        if (onImageUpload) {
          onImageUpload({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileName: asset.fileName,
            fileSize: asset.fileSize,
            type: asset.type
          });
        }
      }
    });
  };

  // 加载AI历史记录
  useEffect(() => {
    loadAIHistory();
  }, []);

  // 当工具改变时通知父组件
  useEffect(() => {
    if (onToolChange) {
      if (activeTool === DRAWING_TOOLS.SHAPE) {
        onToolChange({ type: activeTool, shape: activeShape });
      } else if (activeTool === DRAWING_TOOLS.ERASER) {
        onToolChange({ type: activeTool, size: activeEraserSize });
      } else {
        onToolChange({ type: activeTool });
      }
    }
  }, [activeTool, activeShape, activeEraserSize]);

  // 当颜色改变时通知父组件
  useEffect(() => {
    if (onColorChange && activeTool !== DRAWING_TOOLS.ERASER) {
      onColorChange(activeColor);
    }
  }, [activeColor, activeTool]);

  // 当笔触粗细改变时通知父组件
  useEffect(() => {
    if (onStrokeWidthChange) {
      if (activeTool === DRAWING_TOOLS.ERASER) {
        onStrokeWidthChange(activeEraserSize);
      } else {
        onStrokeWidthChange(activeStrokeWidth);
      }
    }
  }, [activeStrokeWidth, activeEraserSize, activeTool]);

  // 加载AI历史记录
  const loadAIHistory = async () => {
    try {
      const historyItems = await aiHistoryService.getHistory({ limit: 10 });
      setAIHistory(historyItems);
    } catch (error) {
      console.error('加载AI历史记录失败:', error);
    }
  };

  // 处理绘图工具选择
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    if (tool !== DRAWING_TOOLS.SHAPE) {
      setShowShapePicker(false);
    }
  };

  // 处理形状选择
  const handleShapeSelect = (shape) => {
    setActiveShape(shape);
    setShowShapePicker(false);
  };

  // 处理AI工具选择
  const handleAIToolSelect = async (tool) => {
    setSelectedAITool(tool);
    setShowAIToolModal(false);

    if (!selectedText) {
      Alert.alert('提示', '请先选择文本');
      return;
    }

    try {
      setIsAIProcessing(true);

      // 调用AI处理API
      const result = await processWithAI(tool.id, selectedText);

      // 处理结果
      if (result) {
        const outputText = result.result || result.translated_text || result.data;

        // 添加到历史记录
        await aiHistoryService.addHistory({
          tool: tool.id,
          input: selectedText,
          output: outputText,
          timestamp: new Date()
        });

        // 刷新历史记录
        loadAIHistory();

        // 调用结果处理函数
        if (onAIProcessResult) {
          onAIProcessResult(outputText, tool.id);
        }
      } else {
        throw new Error('AI处理失败，未返回结果');
      }
    } catch (error) {
      console.error(`AI处理失败 (${tool.id}):`, error);
      Alert.alert('处理失败', error.message || '无法处理选中的文本，请稍后重试');
    } finally {
      setIsAIProcessing(false);
    }
  };

  // 使用AI处理文本
  const processWithAI = async (toolId, text) => {
    try {
      let result;

      // 根据工具类型调用不同的API
      switch (toolId) {
        case 'translate':
          result = await noteAIService.translateText(text);
          break;
        case 'code_recognition':
          result = await noteAIService.recognizeCode(text);
          break;
        case 'math_formula':
          result = await noteAIService.recognizeMathFormula(text);
          break;
        case 'summarize':
          result = await noteAIService.summarizeText(text);
          break;
        case 'extract_keywords':
          result = await noteAIService.extractKeywords(text);
          break;
        case 'explain':
          result = await noteAIService.explainText(text);
          break;
        case 'rewrite':
          result = await noteAIService.rewriteText(text);
          break;
        case 'grammar':
        case 'simplify':
        default:
          // 对于其他工具，使用通用处理API
          result = await noteAIService.processText(text, toolId);
          break;
      }

      return result;
    } catch (error) {
      console.error('AI处理请求失败:', error);
      throw error;
    }
  };

  // 渲染颜色选择器
  const renderColorPicker = () => (
    <Modal
      transparent={true}
      visible={showColorPicker}
      animationType="fade"
      onRequestClose={() => setShowColorPicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowColorPicker(false)}
      >
        <View
          style={[styles.colorPickerContainer, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => e.stopPropagation()}
        >
          <Text style={[styles.pickerTitle, { color: colors.text }]}>选择颜色</Text>
          <View style={styles.colorGrid}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorItem,
                  { backgroundColor: color },
                  activeColor === color && styles.activeColorItem,
                ]}
                onPress={() => {
                  setActiveColor(color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // 渲染擦除区域大小选择器
  const renderEraserSizePicker = () => (
    <Modal
      transparent={true}
      visible={showEraserSizePicker}
      animationType="fade"
      onRequestClose={() => setShowEraserSizePicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowEraserSizePicker(false)}
      >
        <View
          style={[styles.strokeWidthPickerContainer, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => e.stopPropagation()}
        >
          <Text style={[styles.pickerTitle, { color: colors.text }]}>选择擦除区域大小</Text>
          <View style={styles.strokeWidthList}>
            {ERASER_SIZES.map((item) => (
              <TouchableOpacity
                key={item.size}
                style={[
                  styles.strokeWidthItem,
                  activeEraserSize === item.size && styles.activeStrokeWidthItem,
                ]}
                onPress={() => {
                  setActiveEraserSize(item.size);
                  setShowEraserSizePicker(false);
                  // 通知父组件擦除区域大小变化
                  if (onStrokeWidthChange && activeTool === DRAWING_TOOLS.ERASER) {
                    onStrokeWidthChange(item.size);
                  }
                }}
              >
                <View
                  style={[
                    styles.strokeWidthPreview,
                    {
                      height: Math.min(item.size / 2, 20),
                      width: Math.min(item.size / 2, 20),
                      borderRadius: Math.min(item.size / 4, 10),
                      backgroundColor: colors.text
                    }
                  ]}
                />
                <Text style={{ color: colors.text }}>{item.label} ({item.size}px)</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // 渲染笔触粗细选择器
  const renderStrokeWidthPicker = () => (
    <Modal
      transparent={true}
      visible={showStrokeWidthPicker}
      animationType="fade"
      onRequestClose={() => setShowStrokeWidthPicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowStrokeWidthPicker(false)}
      >
        <View
          style={[styles.strokeWidthPickerContainer, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => e.stopPropagation()}
        >
          <Text style={[styles.pickerTitle, { color: colors.text }]}>选择粗细</Text>
          <View style={styles.strokeWidthList}>
            {STROKE_WIDTHS.map((width) => (
              <TouchableOpacity
                key={width}
                style={[
                  styles.strokeWidthItem,
                  activeStrokeWidth === width && styles.activeStrokeWidthItem,
                ]}
                onPress={() => {
                  setActiveStrokeWidth(width);
                  setShowStrokeWidthPicker(false);
                }}
              >
                <View
                  style={[
                    styles.strokeWidthPreview,
                    {
                      height: width,
                      backgroundColor: colors.text
                    }
                  ]}
                />
                <Text style={{ color: colors.text }}>{width}px</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // 渲染形状选择器
  const renderShapePicker = () => (
    <View style={[styles.shapePickerContainer, {
      backgroundColor: colors.card,
      borderColor: colors.border,
      display: showShapePicker ? 'flex' : 'none'
    }]}>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.LINE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.LINE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 2, backgroundColor: activeShape === SHAPES.LINE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.RECTANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.RECTANGLE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderWidth: 2, borderColor: activeShape === SHAPES.RECTANGLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CIRCLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CIRCLE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: activeShape === SHAPES.CIRCLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.TRIANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.TRIANGLE)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 2 L22 20 L2 20 Z"
            fill="none"
            stroke={activeShape === SHAPES.TRIANGLE ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 菱形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.DIAMOND && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.DIAMOND)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 2 L22 12 L12 22 L2 12 Z"
            fill="none"
            stroke={activeShape === SHAPES.DIAMOND ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 平行四边形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.PARALLELOGRAM && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.PARALLELOGRAM)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M6 6 L18 6 L22 18 L10 18 Z"
            fill="none"
            stroke={activeShape === SHAPES.PARALLELOGRAM ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 椭圆 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ELLIPSE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ELLIPSE)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 4 C18 4 22 7 22 12 C22 17 18 20 12 20 C6 20 2 17 2 12 C2 7 6 4 12 4 Z"
            fill="none"
            stroke={activeShape === SHAPES.ELLIPSE ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ARROW && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ARROW)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M2 12 L20 12 M15 7 L20 12 L15 17"
            fill="none"
            stroke={activeShape === SHAPES.ARROW ? colors.primary : colors.text}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.STAR && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.STAR)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, position: 'relative' }]}>
        <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '35deg' }] }} />
        <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '-35deg' }] }} />
        <View style={{ position: 'absolute', top: 5, left: 0, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '90deg' }] }} />
      </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.POLYGON && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.POLYGON)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, position: 'relative' }]}>
        <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text }} />
        <View style={{ position: 'absolute', top: 4, left: 2, width: 4, height: 16, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text, transform: [{ rotate: '60deg' }] }} />
        <View style={{ position: 'absolute', top: 4, left: 18, width: 4, height: 16, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text, transform: [{ rotate: '-60deg' }] }} />
      </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CURVE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CURVE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24 }]}>
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path d="M4,12 Q10,4 20,12" stroke={activeShape === SHAPES.CURVE ? colors.primary : colors.text} strokeWidth="2" fill="none" />
        </Svg>
      </View>
      </TouchableOpacity>

      {/* 弧形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ARC && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ARC)}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M4 12 A8 8 0 0 1 20 12"
            fill="none"
            stroke={activeShape === SHAPES.ARC ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );

  // 渲染AI工具选择器
  const renderAIToolModal = () => (
    <Modal
      visible={showAIToolModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAIToolModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowAIToolModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI工具</Text>
            <TouchableOpacity onPress={() => setShowAIToolModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolGrid}>
            {AI_TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.gridToolButton,
                  { backgroundColor: colors.background, borderColor: colors.border }
                ]}
                onPress={() => handleAIToolSelect(tool)}
              >
                <MaterialIcon name={tool.icon} size={24} color={colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  color="text"
                  style={styles.gridToolText}
                >
                  {tool.label}
                </Text>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={styles.gridToolDescription}
                >
                  {tool.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染AI历史记录模态框
  const renderAIHistoryModal = () => (
    <Modal
      visible={showAIHistoryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAIHistoryModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowAIHistoryModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI历史记录</Text>
            <TouchableOpacity onPress={() => setShowAIHistoryModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {aiHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="time-outline" size={48} color={colors.textSecondary} />
              <Text variant="body" color="textSecondary" style={styles.emptyHistoryText}>
                暂无历史记录
              </Text>
            </View>
          ) : (
            <FlatList
              data={aiHistory}
              keyExtractor={(item, index) => `history-${index}`}
              renderItem={({ item }) => (
                <View style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.historyItemHeader}>
                    <Text variant="subtitle" color="text">
                      {AI_TOOLS.find(t => t.id === item.tool)?.label || item.tool}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <Text variant="body" color="textSecondary" numberOfLines={2}>
                    输入: {item.input}
                  </Text>
                  <Text variant="body" color="primary" numberOfLines={2}>
                    输出: {item.output}
                  </Text>
                  <TouchableOpacity
                    style={styles.historyItemButton}
                    onPress={() => {
                      if (onAIProcessResult) {
                        onAIProcessResult(item.output, item.tool);
                      }
                      setShowAIHistoryModal(false);
                    }}
                  >
                    <Text variant="button" color="primary">使用此结果</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染AI处理加载指示器
  const renderAIProcessingIndicator = () => (
    isAIProcessing && (
      <View style={[styles.processingOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
        <View style={[styles.processingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.processingText, { color: colors.text }]}>
            正在处理...
          </Text>
        </View>
      </View>
    )
  );

  // 主工具栏渲染
  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* 绘图工具 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarSection} contentContainerStyle={styles.toolbarContentContainer}>
        {/* 绘图工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.PEN && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.PEN && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.PEN)}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.PEN && { color: colors.primary }
            ]}>钢笔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.PENCIL && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.PENCIL && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.PENCIL)}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.PENCIL && { color: colors.primary }
            ]}>铅笔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.BRUSH && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.BRUSH && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.BRUSH)}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.BRUSH && { color: colors.primary }
            ]}>画笔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.HIGHLIGHTER && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.HIGHLIGHTER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.HIGHLIGHTER)}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.HIGHLIGHTER && { color: colors.primary }
            ]}>荧光笔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.ERASER && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.ERASER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => {
              handleToolSelect(DRAWING_TOOLS.ERASER);
              setShowEraserSizePicker(true);
            }}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.ERASER && { color: colors.primary }
            ]}>橡皮擦</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 样式工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowColorPicker(true)}
          >
            <View style={[styles.propertyContainer, { flexDirection: 'row', alignItems: 'center' }]}>
              <Text style={styles.toolLabel}>颜色</Text>
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: activeColor, marginLeft: 8, width: 16, height: 16, borderRadius: 8 }
                ]}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowStrokeWidthPicker(true)}
          >
            <View style={[styles.propertyContainer, { flexDirection: 'row', alignItems: 'center' }]}>
              <Text style={styles.toolLabel}>粗细</Text>
              <Text style={[styles.strokeWidthValue, { marginLeft: 8 }]}>{activeStrokeWidth}px</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 编辑工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              !canUndo && styles.disabledToolButton
            ]}
            onPress={onUndo}
            disabled={!canUndo}
          >
            <Text style={[styles.toolLabel, !canUndo && { color: colors.textDisabled }]}>撤销</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              !canRedo && styles.disabledToolButton
            ]}
            onPress={onRedo}
            disabled={!canRedo}
          >
            <Text style={[styles.toolLabel, !canRedo && { color: colors.textDisabled }]}>重做</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              Alert.alert(
                '清除选项',
                '请选择要清除的内容：',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '当前显示界面',
                    onPress: () => onClear && onClear('current_view')
                  },
                  {
                    text: '选中的内容',
                    onPress: () => onClear && onClear('selected')
                  },
                  {
                    text: '当前页面',
                    onPress: () => onClear && onClear('current_page')
                  },
                  {
                    text: '整个文档',
                    style: 'destructive',
                    onPress: () => onClear && onClear('entire_document')
                  }
                ]
              );
            }}
          >
            <Text style={styles.toolLabel}>清除</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* AI工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowAIToolModal(true)}
          >
            <Text style={styles.toolLabel}>AI工具</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowAIHistoryModal(true)}
          >
            <Text style={styles.toolLabel}>历史</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 形状和文本工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => {
              handleToolSelect(DRAWING_TOOLS.SHAPE);
              setShowShapePicker(!showShapePicker);
            }}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.SHAPE && { color: colors.primary }
            ]}>形状</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.TEXT && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.TEXT && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.TEXT)}
          >
            <Text style={[
              styles.toolLabel,
              activeTool === DRAWING_TOOLS.TEXT && { color: colors.primary }
            ]}>文本</Text>
          </TouchableOpacity>



          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              console.log('图片按钮被点击');
              handleImageUpload();
            }}
          >
            <Text style={styles.toolLabel}>图片</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 形状选择器 */}
      {renderShapePicker()}

      {/* 颜色选择器 */}
      {renderColorPicker()}

      {/* 笔触粗细选择器 */}
      {renderStrokeWidthPicker()}

      {/* 擦除区域大小选择器 */}
      {renderEraserSizePicker()}

      {/* AI工具模态框 */}
      {renderAIToolModal()}

      {/* AI历史记录模态框 */}
      {renderAIHistoryModal()}

      {/* AI处理加载指示器 */}
      {renderAIProcessingIndicator()}
    </View>
  );
};

// 样式定义
const styles = StyleSheet.create({
  container: {
    paddingVertical: 1,    // 减少垂直内边距，缩小高度
    paddingHorizontal: 8,  // 减少水平内边距
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    borderRadius: 0,       // 移除圆角，无缝连接屏幕顶部
    marginHorizontal: 0,   // 移除边距，无缝连接
    minHeight: 20,         // 设置最小高度，确保紧凑布局
  },
  toolbarSection: {
    flexDirection: 'row',
  },
  toolbarContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  toolGroup: {
    flexDirection: 'row',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolButton: {
    paddingHorizontal: 8, // 增加水平内边距，让按钮更宽
    paddingVertical: 0,    // 增加垂直内边距，确保文字有足够空间
    borderRadius: 6,       // 稍微减少圆角
    margin: 0,             // 减少外边距
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 20,         // 增加最小高度，确保文字完全显示
    minWidth: 50,          // 设置最小宽度，保持横长形状
    // 按钮会根据文本内容自适应宽度，但保持横长竖窄的形状
  },
  activeToolButton: {
    width: 40,
    height: 35,
    borderWidth: 1,
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    //shadowOffset: { width: 0, height: 1 },
    //shadowOpacity: 0.2,
    //shadowRadius: 1,
    //elevation: 3,
  },
  disabledToolButton: {
    opacity: 0.5,
  },
  toolLabel: {
    fontSize: 7,
    marginTop: 0,
    textAlign: 'center',
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 4,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  shapePickerContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 10,
  },
  shapeItem: {
    padding: 8,
    margin: 2,
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeShapeItem: {
    backgroundColor: '#2563eb20',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridToolButton: {
    width: '31%',
    margin: 4,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridToolText: {
    marginTop: 8,
    fontWeight: '500',
  },
  gridToolDescription: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyItemButton: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb10',
    alignSelf: 'flex-start',
  },
  emptyHistory: {
    padding: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 12,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  colorItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    margin: 4,
  },
  activeColorItem: {
    borderWidth: 2,    
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  strokeWidthPickerContainer: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 12,
    padding: 16,
  },
  strokeWidthList: {
    flexDirection: 'column',
  },
  strokeWidthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  activeStrokeWidthItem: {
    backgroundColor: '#2563eb20',
  },
  strokeWidthPreview: {
    width: 32,
    marginRight: 16,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AllInOneToolbar;