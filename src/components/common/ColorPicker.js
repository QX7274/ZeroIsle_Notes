/**
 * 颜色选择器组件
 * 提供简单的颜色选择功能
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

// 预定义颜色
const COLORS = [
  // 基础颜色
  '#000000', // 黑色
  '#FFFFFF', // 白色
  '#FF0000', // 红色
  '#00FF00', // 绿色
  '#0000FF', // 蓝色
  '#FFFF00', // 黄色
  '#FF00FF', // 品红
  '#00FFFF', // 青色
  
  // 扩展颜色
  '#FF9900', // 橙色
  '#9900FF', // 紫色
  '#00CC00', // 深绿色
  '#0099FF', // 天蓝色
  '#FF6666', // 浅红色
  '#996633', // 棕色
  '#999999', // 灰色
  '#663399', // 深紫色
  
  // 更多颜色
  '#FFCCCC', // 浅粉色
  '#CCFFCC', // 浅绿色
  '#CCCCFF', // 浅蓝色
  '#FFFFCC', // 浅黄色
  '#FFCCFF', // 浅紫色
  '#CCFFFF', // 浅青色
];

const ColorPicker = ({ selectedColor, onColorChange, style }) => {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // 渲染颜色项
  const renderColorItem = (color) => {
    const isSelected = color === selectedColor;
    
    return (
      <TouchableOpacity
        key={color}
        style={[
          styles.colorItem,
          { backgroundColor: color },
          isSelected && styles.selectedColorItem,
          isSelected && { borderColor: theme.colors.primary }
        ]}
        onPress={() => {
          onColorChange(color);
          setModalVisible(false);
        }}
      >
        {isSelected && (
          <View style={[
            styles.checkmark,
            { borderColor: color === '#FFFFFF' ? '#000000' : '#FFFFFF' }
          ]}>
            <Text style={{ 
              color: color === '#FFFFFF' ? '#000000' : '#FFFFFF',
              fontSize: 12,
              fontWeight: 'bold'
            }}>
              ✓
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 当前选中的颜色 */}
      <TouchableOpacity
        style={[
          styles.selectedColor,
          { backgroundColor: selectedColor, borderColor: theme.colors.border }
        ]}
        onPress={() => setModalVisible(true)}
      />

      {/* 颜色选择器模态框 */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[
            styles.modalContent,
            { backgroundColor: theme.colors.card }
          ]}>
            <Text style={[
              styles.modalTitle,
              { color: theme.colors.text }
            ]}>
              选择颜色
            </Text>
            
            <ScrollView>
              <View style={styles.colorGrid}>
                {COLORS.map(renderColorItem)}
              </View>
            </ScrollView>
            
            <TouchableOpacity
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[
                styles.closeButtonText,
                { color: theme.colors.onPrimary }
              ]}>
                关闭
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    maxHeight: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorItem: {
    borderWidth: 2,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ColorPicker;
