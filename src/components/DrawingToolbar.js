import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Text } from './common/Typography';
import { useTheme } from '../context/ThemeContext';

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

// 工具类型
const TOOLS = {
  PEN: 'pen',
  PENCIL: 'pencil',
  BRUSH: 'brush',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SHAPE: 'shape',
  SCREENSHOT: 'screenshot',
  TEXT: 'text',
  SELECT: 'select',
  LASER: 'laser',
  CALLIGRAPHY: 'calligraphy',
};

// 形状类型
const SHAPES = {
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  ARROW: 'arrow',
  STAR: 'star',
  POLYGON: 'polygon',
  CURVE: 'curve',
};

const DrawingToolbar = ({
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onScreenshot,
  onClear,
  initialTool = TOOLS.PEN,
  initialColor = '#000000',
  initialStrokeWidth = 2,
}) => {
  const { colors } = useTheme();
  const [activeTool, setActiveTool] = useState(initialTool);
  const [activeColor, setActiveColor] = useState(initialColor);
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(initialStrokeWidth);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeWidthPicker, setShowStrokeWidthPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [activeShape, setActiveShape] = useState(SHAPES.LINE);

  // 当工具改变时通知父组件
  useEffect(() => {
    if (onToolChange) {
      if (activeTool === TOOLS.SHAPE) {
        onToolChange({ type: activeTool, shape: activeShape });
      } else {
        onToolChange({ type: activeTool });
      }
    }
  }, [activeTool, activeShape]);

  // 当颜色改变时通知父组件
  useEffect(() => {
    if (onColorChange) {
      onColorChange(activeColor);
    }
  }, [activeColor]);

  // 当笔触粗细改变时通知父组件
  useEffect(() => {
    if (onStrokeWidthChange) {
      onStrokeWidthChange(activeStrokeWidth);
    }
  }, [activeStrokeWidth]);

  // 处理工具选择
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    if (tool !== TOOLS.SHAPE) {
      setShowShapePicker(false);
    }
  };

  // 处理形状选择
  const handleShapeSelect = (shape) => {
    setActiveShape(shape);
    setShowShapePicker(false);
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
    <View style={[
      styles.shapePickerContainer,
      {
        backgroundColor: colors.card,
        borderColor: colors.border,
        display: showShapePicker ? 'flex' : 'none'
      }
    ]}>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.LINE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.LINE)}
      >
        <MaterialIcon name="vector-line" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.RECTANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.RECTANGLE)}
      >
        <MaterialIcon name="rectangle-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CIRCLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CIRCLE)}
      >
        <MaterialIcon name="circle-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.TRIANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.TRIANGLE)}
      >
        <MaterialIcon name="triangle-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ARROW && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ARROW)}
      >
        <MaterialIcon name="arrow-right" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.STAR && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.STAR)}
      >
        <MaterialIcon name="star-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.POLYGON && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.POLYGON)}
      >
        <MaterialIcon name="hexagon-outline" size={24} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CURVE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CURVE)}
      >
        <MaterialIcon name="vector-curve" size={24} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 绘图工具 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.PEN && styles.activeToolButton,
              activeTool === TOOLS.PEN && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.PEN)}
          >
            <MaterialIcon
              name="pen"
              size={24}
              color={activeTool === TOOLS.PEN ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.PENCIL && styles.activeToolButton,
              activeTool === TOOLS.PENCIL && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.PENCIL)}
          >
            <MaterialIcon
              name="pencil"
              size={24}
              color={activeTool === TOOLS.PENCIL ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.BRUSH && styles.activeToolButton,
              activeTool === TOOLS.BRUSH && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.BRUSH)}
          >
            <MaterialIcon
              name="brush"
              size={24}
              color={activeTool === TOOLS.BRUSH ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.HIGHLIGHTER && styles.activeToolButton,
              activeTool === TOOLS.HIGHLIGHTER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.HIGHLIGHTER)}
          >
            <MaterialIcon
              name="marker"
              size={24}
              color={activeTool === TOOLS.HIGHLIGHTER ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.CALLIGRAPHY && styles.activeToolButton,
              activeTool === TOOLS.CALLIGRAPHY && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.CALLIGRAPHY)}
          >
            <MaterialIcon
              name="fountain-pen-tip"
              size={24}
              color={activeTool === TOOLS.CALLIGRAPHY ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.ERASER && styles.activeToolButton,
              activeTool === TOOLS.ERASER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.ERASER)}
          >
            <MaterialIcon
              name="eraser"
              size={24}
              color={activeTool === TOOLS.ERASER ? colors.primary : colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 形状工具 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.SHAPE && styles.activeToolButton,
              activeTool === TOOLS.SHAPE && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => {
              handleToolSelect(TOOLS.SHAPE);
              setShowShapePicker(!showShapePicker);
            }}
          >
            <MaterialIcon
              name={
                activeTool === TOOLS.SHAPE
                  ? activeShape === SHAPES.LINE
                    ? "vector-line"
                    : activeShape === SHAPES.RECTANGLE
                    ? "rectangle-outline"
                    : activeShape === SHAPES.CIRCLE
                    ? "circle-outline"
                    : activeShape === SHAPES.TRIANGLE
                    ? "triangle-outline"
                    : "arrow-right"
                  : "shape-outline"
              }
              size={24}
              color={activeTool === TOOLS.SHAPE ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === TOOLS.TEXT && styles.activeToolButton,
              activeTool === TOOLS.TEXT && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(TOOLS.TEXT)}
          >
            <MaterialIcon
              name="format-text"
              size={24}
              color={activeTool === TOOLS.TEXT ? colors.primary : colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 颜色和粗细选择 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[styles.toolButton, styles.colorButton]}
            onPress={() => setShowColorPicker(true)}
          >
            <View style={[styles.colorPreview, { backgroundColor: activeColor }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowStrokeWidthPicker(true)}
          >
            <MaterialIcon name="gesture" size={24} color={colors.text} />
            <View style={styles.strokeWidthBadge}>
              <Text style={styles.strokeWidthText}>{activeStrokeWidth}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 撤销和重做 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[styles.toolButton, !canUndo && styles.disabledToolButton]}
            onPress={onUndo}
            disabled={!canUndo}
          >
            <Icon
              name="arrow-undo"
              size={24}
              color={canUndo ? colors.text : colors.textDisabled}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, !canRedo && styles.disabledToolButton]}
            onPress={onRedo}
            disabled={!canRedo}
          >
            <Icon
              name="arrow-redo"
              size={24}
              color={canRedo ? colors.text : colors.textDisabled}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* 其他工具 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={onScreenshot}
          >
            <Icon name="scan-outline" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={onClear}
          >
            <Icon name="trash-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 形状选择器 */}
      {renderShapePicker()}

      {/* 颜色选择器模态框 */}
      {renderColorPicker()}

      {/* 笔触粗细选择器模态框 */}
      {renderStrokeWidthPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  toolButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 2,
  },
  activeToolButton: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  disabledToolButton: {
    opacity: 0.5,
  },
  colorButton: {
    position: 'relative',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  strokeWidthBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#CCCCCC',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strokeWidthText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    width: 300,
    padding: 16,
    borderRadius: 8,
    elevation: 5,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  activeColorItem: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  strokeWidthPickerContainer: {
    width: 300,
    padding: 16,
    borderRadius: 8,
    elevation: 5,
  },
  strokeWidthList: {
    alignItems: 'center',
  },
  strokeWidthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  activeStrokeWidthItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  strokeWidthPreview: {
    width: 100,
    marginRight: 16,
  },
  shapePickerContainer: {
    position: 'absolute',
    top: 56,
    left: 120,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    elevation: 5,
    zIndex: 1000,
    width: 220,
  },
  shapeItem: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 2,
  },
  activeShapeItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
});

export default DrawingToolbar;
