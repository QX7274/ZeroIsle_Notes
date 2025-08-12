import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Svg, { Rect, Line } from 'react-native-svg';

/**
 * 画布样式选择模态框
 * 类似CreateContentModal的样式，用于选择画布纸张样式
 */
const CanvasStyleModal = ({ visible, onClose, onSelect }) => {
  const { colors } = useTheme();
  const [selectedStyle, setSelectedStyle] = useState('white');
  const [canvasName, setCanvasName] = useState('');
  
  const canvasStyles = [
    {
      id: 'white',
      name: '白色纸张',
      description: '纯白色背景，适合一般绘画',
      backgroundColor: '#FFFFFF',
      pattern: null
    },
    {
      id: 'yellow',
      name: '淡黄色纸张',
      description: '温暖的淡黄色背景，护眼舒适',
      backgroundColor: '#FFF8DC',
      pattern: null
    },
    {
      id: 'grid',
      name: '方格纸',
      description: '网格背景，适合绘制图表和几何图形',
      backgroundColor: '#FFFFFF',
      pattern: 'grid'
    },
    {
      id: 'lines',
      name: '横线纸',
      description: '横线背景，适合书写和笔记',
      backgroundColor: '#FFFFFF',
      pattern: 'lines'
    }
  ];
  
  // 渲染样式预览
  const renderStylePreview = (style) => {
    const previewSize = 60;
    
    return (
      <View style={[styles.previewContainer, { backgroundColor: style.backgroundColor }]}>
        <Svg width={previewSize} height={previewSize}>
          <Rect
            width={previewSize}
            height={previewSize}
            fill={style.backgroundColor}
            stroke="#E0E0E0"
            strokeWidth={1}
          />
          
          {style.pattern === 'grid' && (
            <>
              {/* 垂直线 */}
              {[15, 30, 45].map(x => (
                <Line
                  key={`v${x}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={previewSize}
                  stroke="#E0E0E0"
                  strokeWidth={0.5}
                />
              ))}
              {/* 水平线 */}
              {[15, 30, 45].map(y => (
                <Line
                  key={`h${y}`}
                  x1={0}
                  y1={y}
                  x2={previewSize}
                  y2={y}
                  stroke="#E0E0E0"
                  strokeWidth={0.5}
                />
              ))}
            </>
          )}
          
          {style.pattern === 'lines' && (
            <>
              {/* 水平线 */}
              {[15, 30, 45].map(y => (
                <Line
                  key={`line${y}`}
                  x1={0}
                  y1={y}
                  x2={previewSize}
                  y2={y}
                  stroke="#E0E0E0"
                  strokeWidth={0.5}
                />
              ))}
            </>
          )}
        </Svg>
      </View>
    );
  };
  
  const handleConfirm = () => {
    const finalName = canvasName.trim() || `无限画布 ${new Date().toLocaleString()}`;
    onSelect(selectedStyle, finalName);
    onClose();
    setCanvasName('');
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              选择画布样式
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={[styles.closeButtonText, { color: colors.textLight }]}>
                ×
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.subtitle, { color: colors.textLight }]}>
              选择适合您需求的画布背景样式
            </Text>
            
            <View style={styles.stylesGrid}>
              {canvasStyles.map((style) => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.styleItem,
                    {
                      backgroundColor: colors.background,
                      borderColor: selectedStyle === style.id ? colors.primary : colors.border,
                      borderWidth: selectedStyle === style.id ? 2 : 1,
                    }
                  ]}
                  onPress={() => setSelectedStyle(style.id)}
                >
                  {renderStylePreview(style)}
                  
                  <View style={styles.styleInfo}>
                    <Text style={[styles.styleName, { color: colors.text }]}>
                      {style.name}
                    </Text>
                    <Text style={[styles.styleDescription, { color: colors.textLight }]}>
                      {style.description}
                    </Text>
                  </View>
                  
                  {selectedStyle === style.id && (
                    <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                      <Text style={styles.selectedText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <View style={styles.footer}>
            <TextInput
              style={[
                styles.nameInput,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  color: colors.text
                }
              ]}
              placeholder="输入名称（默认日期）"
              placeholderTextColor={colors.textLight}
              value={canvasName}
              onChangeText={setCanvasName}
            />


            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                创建画布
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  stylesGrid: {
    gap: 12,
  },
  styleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    position: 'relative',
  },
  previewContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  styleInfo: {
    flex: 1,
  },
  styleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  styleDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  nameInput: {
    flex: 2,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButton: {
    // backgroundColor will be set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CanvasStyleModal;
