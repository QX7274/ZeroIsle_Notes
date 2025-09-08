/**
 * 手写功能测试页面
 * 用于测试手动模式切换和笔迹位置一致性
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UniversalHandwritingEngine from '../components/handwriting/UniversalHandwritingEngine';
import AllInOneToolbar from '../components/common/AllInOneToolbar';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const HandwritingTestScreen = () => {
  const { colors } = useTheme();
  const handwritingRef = useRef(null);
  
  // 工具栏状态
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // 手动模式切换状态
  const [isFingerMode, setIsFingerMode] = useState(false);
  
  // 缩放和偏移状态
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // 处理工具变化
  const handleToolChange = (tool) => {
    setCurrentTool(tool.type);
    console.log('工具切换:', tool);
  };

  // 处理颜色变化
  const handleColorChange = (color) => {
    setCurrentColor(color);
    console.log('颜色切换:', color);
  };

  // 处理笔触粗细变化
  const handleStrokeWidthChange = (width) => {
    setCurrentStrokeWidth(width);
    console.log('笔触粗细切换:', width);
  };

  // 处理撤销
  const handleUndo = () => {
    if (handwritingRef.current) {
      handwritingRef.current.undoLastStroke();
      console.log('撤销操作');
    }
  };

  // 处理重做
  const handleRedo = () => {
    console.log('重做操作 (暂未实现)');
  };

  // 处理清除
  const handleClear = (type) => {
    if (handwritingRef.current) {
      handwritingRef.current.clearStrokes();
      console.log('清除操作:', type);
    }
  };

  // 处理模式切换
  const handleModeToggle = (fingerMode) => {
    setIsFingerMode(fingerMode);
    if (handwritingRef.current) {
      handwritingRef.current.setManualFingerMode(fingerMode);
    }
    console.log('模式切换:', fingerMode ? '手指模式' : '手写笔模式');
  };

  // 处理笔迹变化
  const handleStrokesChange = (strokes) => {
    setCanUndo(strokes.length > 0);
    console.log('笔迹数量:', strokes.length);
  };

  // 处理笔迹开始
  const handleStrokeStart = (stroke) => {
    console.log('开始绘制:', stroke.id);
  };

  // 处理笔迹更新
  const handleStrokeUpdate = (stroke) => {
    // console.log('更新绘制:', stroke.id);
  };

  // 处理笔迹结束
  const handleStrokeEnd = (stroke) => {
    console.log('结束绘制:', stroke.id, '点数:', stroke.points.length);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 工具栏 */}
      <AllInOneToolbar
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onStrokeWidthChange={handleStrokeWidthChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onClear={handleClear}
        initialTool={currentTool}
        initialColor={currentColor}
        initialStrokeWidth={currentStrokeWidth}
        onModeToggle={handleModeToggle}
        isFingerMode={isFingerMode}
      />

      {/* 状态信息 */}
      <View style={[styles.statusBar, { backgroundColor: colors.card }]}>
        <Text style={[styles.statusText, { color: colors.text }]}>
          模式: {isFingerMode ? '👆 手指' : '🖊️ 手写笔'} | 
          工具: {currentTool} | 
          颜色: {currentColor} | 
          粗细: {currentStrokeWidth}px
        </Text>
      </View>

      {/* 手写区域 */}
      <View style={styles.handwritingContainer}>
        {/* 背景内容 - 模拟文档 */}
        <ScrollView
          style={styles.backgroundContent}
          contentContainerStyle={styles.backgroundContentContainer}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
          maximumZoomScale={3}
          minimumZoomScale={0.5}
          onScroll={(event) => {
            const { contentOffset } = event.nativeEvent;
            setOffsetX(-contentOffset.x);
            setOffsetY(-contentOffset.y);
          }}
          scrollEventThrottle={16}
        >
          <View style={[styles.documentPage, { backgroundColor: colors.surface }]}>
            <Text style={[styles.documentTitle, { color: colors.text }]}>
              测试文档
            </Text>
            <Text style={[styles.documentContent, { color: colors.textSecondary }]}>
              这是一个测试文档，用于验证手写功能。{'\n\n'}
              在手写笔模式下，您可以在此页面上书写。{'\n\n'}
              在手指模式下，您可以滑动和缩放此页面，笔迹会跟随文档内容一起移动。{'\n\n'}
              请测试以下功能：{'\n'}
              • 手写笔模式下的书写{'\n'}
              • 手指模式下的滑动缩放{'\n'}
              • 模式切换的流畅性{'\n'}
              • 笔迹位置的一致性{'\n\n'}
              您可以使用右上角的按钮切换模式。
            </Text>
          </View>
        </ScrollView>

        {/* 手写层 */}
        <UniversalHandwritingEngine
          ref={handwritingRef}
          width={screenWidth}
          height={screenHeight - 200} // 减去工具栏和状态栏高度
          tool={currentTool}
          strokeColor={currentColor}
          strokeWidth={currentStrokeWidth}
          onStrokeStart={handleStrokeStart}
          onStrokeUpdate={handleStrokeUpdate}
          onStrokeEnd={handleStrokeEnd}
          onStrokesChange={handleStrokesChange}
          fileType="note"
          documentId="test-document"
          pageNumber={1}
          initialScale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          style={styles.handwritingEngine}
        />
      </View>

      {/* 调试信息 */}
      {__DEV__ && (
        <View style={[styles.debugInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            调试: 缩放={scale.toFixed(2)} 偏移=({offsetX.toFixed(0)}, {offsetY.toFixed(0)})
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  handwritingContainer: {
    flex: 1,
    position: 'relative',
  },
  backgroundContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundContentContainer: {
    padding: 20,
    minHeight: screenHeight,
    minWidth: screenWidth,
  },
  documentPage: {
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 600,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  documentContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  handwritingEngine: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default HandwritingTestScreen;
