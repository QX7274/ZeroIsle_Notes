import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * 卡片类型选择模态框
 * 类似画布选择器的设计，包含颜色样式和底部输入
 */
const CardTypeModal = ({ visible, onClose, onSelectType }) => {
  const { colors } = useTheme();
  const [selectedType, setSelectedType] = useState('blank');
  const [cardName, setCardName] = useState('');

  const cardTypes = [
    {
      id: 'blank',
      title: '普通空白',
      description: '自由创作的空白卡片',
      icon: 'note',
      color: '#2196F3',
    },
    {
      id: 'meeting',
      title: '会议纪要',
      description: '记录会议要点和决议',
      icon: 'group',
      color: '#FF9800',
    },
    {
      id: 'todo',
      title: '待办清单',
      description: '管理任务和待办事项',
      icon: 'check-box',
      color: '#4CAF50',
    },
    {
      id: 'diary',
      title: '日记模板',
      description: '记录日常生活和感想',
      icon: 'today',
      color: '#E91E63',
    },
    {
      id: 'idea',
      title: '创意想法',
      description: '捕捉灵感和创意思路',
      icon: 'lightbulb',
      color: '#FFC107',
    },
    {
      id: 'reading',
      title: '读书笔记',
      description: '记录阅读心得和摘要',
      icon: 'book',
      color: '#9C27B0',
    },
    {
      id: 'project',
      title: '项目规划',
      description: '制定项目计划和进度',
      icon: 'assignment',
      color: '#607D8B',
    },
    {
      id: 'learning',
      title: '学习笔记',
      description: '整理学习内容和知识点',
      icon: 'school',
      color: '#3F51B5',
    },
  ];

  const handleConfirm = () => {
    const selectedTypeData = cardTypes.find(type => type.id === selectedType);
    const finalName = cardName.trim() || selectedTypeData.title;

    console.log('CardTypeModal: 创建卡片:', { type: selectedTypeData, name: finalName });
    onSelectType({ ...selectedTypeData, title: finalName });
    onClose();
    setCardName('');
    setSelectedType('blank');
  };

  console.log('CardTypeModal: 渲染状态 visible =', visible);
  console.log('CardTypeModal: selectedType =', selectedType);
  console.log('CardTypeModal: cardName =', cardName);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              选择卡片类型
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
              选择适合的卡片类型开始创作
            </Text>

            <View style={styles.typesGrid}>
              {cardTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeItem,
                    {
                      backgroundColor: colors.background,
                      borderColor: selectedType === type.id ? colors.primary : colors.border,
                      borderWidth: selectedType === type.id ? 2 : 1,
                    }
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <View style={[styles.iconContainer, { backgroundColor: type.color }]}>
                    <Icon name={type.icon} size={24} color="#FFFFFF" />
                  </View>

                  <View style={styles.typeInfo}>
                    <Text style={[styles.typeName, { color: colors.text }]}>
                      {type.title}
                    </Text>
                    <Text style={[styles.typeDescription, { color: colors.textLight }]}>
                      {type.description}
                    </Text>
                  </View>

                  {selectedType === type.id && (
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
              placeholder="输入卡片名称（可选）"
              placeholderTextColor={colors.textLight}
              value={cardName}
              onChangeText={setCardName}
            />

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                创建卡片
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
    paddingHorizontal: 20,
    zIndex: 9999, // 确保在最顶层
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
  typesGrid: {
    gap: 12,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    position: 'relative',
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },

  typeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
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

export default CardTypeModal;
