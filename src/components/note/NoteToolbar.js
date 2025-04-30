/**
 * 笔记工具栏组件
 * 集成笔的选择、颜色和AI工具
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AIToolbar from './AIToolbar';

// 工具类型
const TOOL_TYPES = {
  PEN: 'pen',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  IMAGE: 'image',
  AI: 'ai',
};

// 笔的类型
const PEN_TYPES = [
  { id: 'pen', label: '钢笔', icon: 'edit', description: '流畅的钢笔书写' },
  { id: 'pencil', label: '铅笔', icon: 'create', description: '自然的铅笔效果' },
  { id: 'brush', label: '毛笔', icon: 'brush', description: '艺术的毛笔效果' },
  { id: 'marker', label: '记号笔', icon: 'format-paint', description: '粗体记号笔' },
  { id: 'highlighter', label: '荧光笔', icon: 'highlight', description: '半透明高亮效果' },
  { id: 'calligraphy', label: '书法笔', icon: 'gesture', description: '变宽书法效果' },
];

// 颜色选项
const COLOR_OPTIONS = [
  { id: 'black', color: '#000000', label: '黑色' },
  { id: 'blue', color: '#2196F3', label: '蓝色' },
  { id: 'red', color: '#F44336', label: '红色' },
  { id: 'green', color: '#4CAF50', label: '绿色' },
  { id: 'yellow', color: '#FFEB3B', label: '黄色' },
  { id: 'purple', color: '#9C27B0', label: '紫色' },
  { id: 'orange', color: '#FF9800', label: '橙色' },
  { id: 'pink', color: '#E91E63', label: '粉色' },
];

// 笔的粗细
const STROKE_WIDTHS = [
  { id: 'thin', width: 2, label: '细' },
  { id: 'medium', width: 4, label: '中' },
  { id: 'thick', width: 6, label: '粗' },
  { id: 'very_thick', width: 10, label: '特粗' },
];

// 形状选项
const SHAPE_OPTIONS = [
  { id: 'line', label: '直线', icon: 'remove', description: '绘制直线' },
  { id: 'arrow', label: '箭头', icon: 'arrow-right-alt', description: '绘制箭头' },
  { id: 'rectangle', label: '矩形', icon: 'crop-square', description: '绘制矩形' },
  { id: 'circle', label: '圆形', icon: 'radio-button-unchecked', description: '绘制圆形' },
  { id: 'triangle', label: '三角形', icon: 'change-history', description: '绘制三角形' },
  { id: 'diamond', label: '菱形', icon: 'crop-din', description: '绘制菱形' },
  { id: 'pentagon', label: '五边形', icon: 'pentagon', description: '绘制五边形' },
  { id: 'hexagon', label: '六边形', icon: 'hexagon', description: '绘制六边形' },
  { id: 'star', label: '星形', icon: 'star', description: '绘制星形' },
  { id: 'cloud', label: '云形', icon: 'cloud', description: '绘制云形' },
];

const NoteToolbar = ({
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onShapeChange,
  onAIProcessResult,
  selectedText,
  isEditMode = true,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [activeTool, setActiveTool] = useState(TOOL_TYPES.PEN);
  const [activePenType, setActivePenType] = useState('pen');
  const [activeColor, setActiveColor] = useState('black');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState('medium');
  const [activeShape, setActiveShape] = useState('line');
  const [showAITools, setShowAITools] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeWidthPicker, setShowStrokeWidthPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);

  // 处理工具变化
  const handleToolChange = (tool) => {
    setActiveTool(tool);

    if (tool === TOOL_TYPES.AI) {
      setShowAITools(!showAITools);
    } else {
      setShowAITools(false);
      onToolChange && onToolChange(tool, {
        penType: activePenType,
        color: getColorById(activeColor),
        strokeWidth: getStrokeWidthById(activeStrokeWidth),
        shape: activeShape,
      });
    }
  };

  // 处理笔类型变化
  const handlePenTypeChange = (penType) => {
    setActivePenType(penType);
    setActiveTool(TOOL_TYPES.PEN);
    onToolChange && onToolChange(TOOL_TYPES.PEN, {
      penType,
      color: getColorById(activeColor),
      strokeWidth: getStrokeWidthById(activeStrokeWidth),
    });
  };

  // 处理颜色变化
  const handleColorChange = (colorId) => {
    setActiveColor(colorId);
    setShowColorPicker(false);
    const color = getColorById(colorId);
    onColorChange && onColorChange(color);
  };

  // 处理笔粗细变化
  const handleStrokeWidthChange = (widthId) => {
    setActiveStrokeWidth(widthId);
    setShowStrokeWidthPicker(false);
    const width = getStrokeWidthById(widthId);
    onStrokeWidthChange && onStrokeWidthChange(width);
  };

  // 处理形状变化
  const handleShapeChange = (shapeId) => {
    setActiveShape(shapeId);
    setShowShapePicker(false);
    onShapeChange && onShapeChange(shapeId);
  };

  // 处理AI处理结果
  const handleAIProcessResult = (result, toolId) => {
    onAIProcessResult && onAIProcessResult(result, toolId);
  };

  // 获取颜色对象
  const getColorById = (colorId) => {
    const colorObj = COLOR_OPTIONS.find(c => c.id === colorId);
    return colorObj ? colorObj.color : '#000000';
  };

  // 获取笔粗细
  const getStrokeWidthById = (widthId) => {
    const widthObj = STROKE_WIDTHS.find(w => w.id === widthId);
    return widthObj ? widthObj.width : 2;
  };

  // 渲染主工具栏
  const renderMainToolbar = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.toolbarContainer}
    >
      {/* 绘图工具组 */}
      <View style={styles.toolGroup}>
        {/* 笔工具 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.PEN && styles.activeToolButton,
            activeTool === TOOL_TYPES.PEN && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.PEN)}
        >
          <Icon
            name={PEN_TYPES.find(p => p.id === activePenType)?.icon || 'edit'}
            size={24}
            color={activeTool === TOOL_TYPES.PEN ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.PEN ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            {PEN_TYPES.find(p => p.id === activePenType)?.label || '钢笔'}
          </Text>
        </TouchableOpacity>

        {/* 荧光笔 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.HIGHLIGHTER && styles.activeToolButton,
            activeTool === TOOL_TYPES.HIGHLIGHTER && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.HIGHLIGHTER)}
        >
          <Icon
            name="highlight"
            size={24}
            color={activeTool === TOOL_TYPES.HIGHLIGHTER ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.HIGHLIGHTER ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            荧光笔
          </Text>
        </TouchableOpacity>

        {/* 橡皮擦 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.ERASER && styles.activeToolButton,
            activeTool === TOOL_TYPES.ERASER && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.ERASER)}
        >
          <Icon
            name="auto-fix-high"
            size={24}
            color={activeTool === TOOL_TYPES.ERASER ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.ERASER ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            橡皮擦
          </Text>
        </TouchableOpacity>
      </View>

      {/* 分隔线 */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 形状和文本工具组 */}
      <View style={styles.toolGroup}>
        {/* 形状 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.SHAPE && styles.activeToolButton,
            activeTool === TOOL_TYPES.SHAPE && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.SHAPE)}
        >
          <Icon
            name="category"
            size={24}
            color={activeTool === TOOL_TYPES.SHAPE ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.SHAPE ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            形状
          </Text>
        </TouchableOpacity>

        {/* 文本 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.TEXT && styles.activeToolButton,
            activeTool === TOOL_TYPES.TEXT && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.TEXT)}
        >
          <Icon
            name="text-fields"
            size={24}
            color={activeTool === TOOL_TYPES.TEXT ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.TEXT ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            文本
          </Text>
        </TouchableOpacity>

        {/* 图片 */}
        <TouchableOpacity
          style={[
            styles.toolButton,
            activeTool === TOOL_TYPES.IMAGE && styles.activeToolButton,
            activeTool === TOOL_TYPES.IMAGE && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => handleToolChange(TOOL_TYPES.IMAGE)}
        >
          <Icon
            name="image"
            size={24}
            color={activeTool === TOOL_TYPES.IMAGE ? colors.primary : colors.text}
          />
          <Text
            variant="caption"
            size="tiny"
            color={activeTool === TOOL_TYPES.IMAGE ? 'primary' : 'textSecondary'}
            style={styles.toolButtonLabel}
          >
            图片
          </Text>
        </TouchableOpacity>
      </View>

      {/* 分隔线 */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 样式工具组 */}
      <View style={styles.toolGroup}>
        {/* 颜色选择 */}
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => setShowColorPicker(!showColorPicker)}
        >
          <View style={[styles.colorIndicator, { backgroundColor: getColorById(activeColor) }]} />
          <Text
            variant="caption"
            size="tiny"
            color="textSecondary"
            style={styles.toolButtonLabel}
          >
            颜色
          </Text>
        </TouchableOpacity>

        {/* 笔粗细 */}
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => setShowStrokeWidthPicker(!showStrokeWidthPicker)}
        >
          <Icon name="line-weight" size={24} color={colors.text} />
          <Text
            variant="caption"
            size="tiny"
            color="textSecondary"
            style={styles.toolButtonLabel}
          >
            粗细
          </Text>
        </TouchableOpacity>
      </View>

      {/* 分隔线 */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* AI工具 */}
      <TouchableOpacity
        style={[
          styles.toolButton,
          activeTool === TOOL_TYPES.AI && styles.activeToolButton,
          activeTool === TOOL_TYPES.AI && { backgroundColor: colors.primaryLight }
        ]}
        onPress={() => handleToolChange(TOOL_TYPES.AI)}
      >
        <Icon
          name="psychology"
          size={24}
          color={activeTool === TOOL_TYPES.AI ? colors.primary : colors.text}
        />
        <Text
          variant="caption"
          size="tiny"
          color={activeTool === TOOL_TYPES.AI ? 'primary' : 'textSecondary'}
          style={styles.toolButtonLabel}
        >
          AI工具
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // 渲染颜色选择器
  const renderColorPicker = () => (
    <Modal
      visible={showColorPicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowColorPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowColorPicker(false)}
      >
        <View
          style={[
            styles.colorPickerContainer,
            { backgroundColor: colors.card, top: 60, right: 100 }
          ]}
        >
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map(color => (
              <TouchableOpacity
                key={color.id}
                style={[
                  styles.colorOption,
                  { backgroundColor: color.color },
                  activeColor === color.id && styles.activeColorOption
                ]}
                onPress={() => handleColorChange(color.id)}
              />
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染笔粗细选择器
  const renderStrokeWidthPicker = () => (
    <Modal
      visible={showStrokeWidthPicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowStrokeWidthPicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowStrokeWidthPicker(false)}
      >
        <View
          style={[
            styles.strokeWidthPickerContainer,
            { backgroundColor: colors.card, top: 60, right: 60 }
          ]}
        >
          {STROKE_WIDTHS.map(width => (
            <TouchableOpacity
              key={width.id}
              style={[
                styles.strokeWidthOption,
                activeStrokeWidth === width.id && { backgroundColor: colors.primaryLight }
              ]}
              onPress={() => handleStrokeWidthChange(width.id)}
            >
              <View
                style={[
                  styles.strokeWidthIndicator,
                  {
                    height: width.width,
                    backgroundColor: colors.text
                  }
                ]}
              />
              <Text
                variant="body"
                size="small"
                color={activeStrokeWidth === width.id ? 'primary' : 'text'}
                style={styles.strokeWidthLabel}
              >
                {width.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染形状选择器
  const renderShapePicker = () => (
    <Modal
      visible={showShapePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowShapePicker(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowShapePicker(false)}
      >
        <View
          style={[
            styles.shapePickerContainer,
            { backgroundColor: colors.card, top: 60, left: 100 }
          ]}
        >
          <View style={styles.shapeGrid}>
            {SHAPE_OPTIONS.map(shape => (
              <TouchableOpacity
                key={shape.id}
                style={[
                  styles.shapeOption,
                  activeShape === shape.id && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => handleShapeChange(shape.id)}
              >
                <Icon
                  name={shape.icon}
                  size={24}
                  color={activeShape === shape.id ? colors.primary : colors.text}
                />
                <Text
                  variant="caption"
                  color={activeShape === shape.id ? 'primary' : 'text'}
                >
                  {shape.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // 如果不是编辑模式，只显示AI工具栏
  if (!isEditMode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {showAITools && (
          <AIToolbar
            onProcessResult={handleAIProcessResult}
            selectedText={selectedText}
          />
        )}
        <TouchableOpacity
          style={[
            styles.aiOnlyButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            showAITools && { backgroundColor: colors.primaryLight }
          ]}
          onPress={() => setShowAITools(!showAITools)}
        >
          <Icon
            name="psychology"
            size={24}
            color={showAITools ? colors.primary : colors.text}
          />
          <Text
            variant="body"
            size="medium"
            color={showAITools ? 'primary' : 'text'}
            style={styles.aiOnlyButtonText}
          >
            AI工具
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderMainToolbar()}
      {showAITools && (
        <AIToolbar
          onProcessResult={handleAIProcessResult}
          selectedText={selectedText}
        />
      )}
      {renderColorPicker()}
      {renderStrokeWidthPicker()}
      {renderShapePicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolButton: {
    width: 50,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    paddingVertical: 4,
  },
  activeToolButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  toolButtonLabel: {
    marginTop: 4,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  colorPickerContainer: {
    position: 'absolute',
    padding: 8,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 120,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: 5,
    borderWidth: 1,
    borderColor: 'white',
  },
  activeColorOption: {
    borderWidth: 2,
    borderColor: '#000',
  },
  strokeWidthPickerContainer: {
    position: 'absolute',
    padding: 8,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  strokeWidthOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
  },
  strokeWidthIndicator: {
    width: 40,
    borderRadius: 4,
  },
  strokeWidthLabel: {
    marginLeft: 8,
  },
  shapePickerContainer: {
    position: 'absolute',
    padding: 8,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 180,
  },
  shapeOption: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  aiOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    margin: 8,
  },
  aiOnlyButtonText: {
    marginLeft: 8,
  },
});

export default NoteToolbar;
