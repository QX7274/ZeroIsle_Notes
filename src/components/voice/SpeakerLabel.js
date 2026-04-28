import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Pressable,
  Easing,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';

/**
 * 说话人标签组件
 * 显示说话人信息，支持自定义名称
 * 优化版本：更现代的UI和交互体验
 */
const SpeakerLabel = ({
  speakerId,
  speakerName = null,
  isActive = false,
  size = 'medium',
  style = {},
  editable = false,
  onRename = null,
  similarity = null,
  color = null, // 允许外部传入颜色
}) => {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 动画效果
  useEffect(() => {
    if (isActive) {
      // 激活状态动画
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    } else {
      // 重置动画
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  // 根据说话人ID生成颜色
  const getSpeakerColor = (id) => {
    // 如果外部传入了颜色，优先使用
    if (color) {return color;}

    const colorPalette = [
      '#4285F4', // 蓝色
      '#EA4335', // 红色
      '#34A853', // 绿色
      '#FBBC05', // 黄色
      '#8E44AD', // 紫色
      '#F39C12', // 橙色
      '#16A085', // 青色
      '#E74C3C', // 深红色
      '#3498DB', // 浅蓝色
      '#2C3E50',  // 深蓝色
    ];

    // 确保ID是数字
    const numericId = typeof id === 'number' ? id : parseInt(id, 10) || 0;
    return colorPalette[numericId % colorPalette.length];
  };

  // 根据说话人ID获取图标
  const getSpeakerIcon = (id) => {
    const icons = [
      'account',
      'account-tie',
      'human-male',
      'human-female',
      'account-voice',
      'account-star',
      'account-supervisor',
      'account-circle',
      'account-box',
      'account-network',
    ];

    // 确保ID是数字
    const numericId = typeof id === 'number' ? id : parseInt(id, 10) || 0;
    return icons[numericId % icons.length];
  };

  // 根据尺寸获取样式
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { height: 26, paddingHorizontal: 8 },
          text: { fontSize: 12 },
          icon: 14,
        };
      case 'large':
        return {
          container: { height: 40, paddingHorizontal: 14 },
          text: { fontSize: 16 },
          icon: 20,
        };
      case 'medium':
      default:
        return {
          container: { height: 32, paddingHorizontal: 12 },
          text: { fontSize: 14 },
          icon: 16,
        };
    }
  };

  // 处理长按事件
  const handleLongPress = () => {
    if (editable && onRename) {
      // 触觉反馈动画
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setEditName(displayName);
      setIsEditing(true);
    }
  };

  // 处理重命名
  const handleRename = () => {
    if (onRename && editName.trim()) {
      onRename(speakerId, editName.trim());
    }
    setIsEditing(false);
  };

  // 处理点击编辑按钮
  const handleEditPress = () => {
    if (editable && onRename) {
      setEditName(displayName);
      setIsEditing(true);
    }
  };

  const sizeStyles = getSizeStyles();
  const speakerColor = getSpeakerColor(speakerId);
  const speakerIcon = getSpeakerIcon(speakerId);
  const displayName = speakerName || `说话人 ${(typeof speakerId === 'number' ? speakerId : parseInt(speakerId, 10) || 0) + 1}`;

  // 显示相似度指示器
  const renderSimilarityIndicator = () => {
    if (similarity === null || size === 'small') {return null;}

    // 相似度颜色
    let indicatorColor = '#ccc';
    if (similarity > 0.9) {indicatorColor = '#4CAF50';}
    else if (similarity > 0.7) {indicatorColor = '#FFC107';}
    else if (similarity > 0.5) {indicatorColor = '#FF9800';}
    else {indicatorColor = '#F44336';}

    return (
      <View
        style={[
          styles.similarityIndicator,
          { backgroundColor: indicatorColor },
        ]}
      />
    );
  };

  // 获取渐变颜色
  const getGradientColors = () => {
    if (isActive) {
      return [
        speakerColor,
        speakerColor + 'EE',
      ];
    } else {
      return [
        speakerColor + '20',
        speakerColor + '30',
      ];
    }
  };

  return (
    <>
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        }}
      >
        <TouchableOpacity
          activeOpacity={editable ? 0.6 : 0.8}
          onLongPress={handleLongPress}
          disabled={!editable}
        >
          <LinearGradient
            colors={getGradientColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.container,
              sizeStyles.container,
              {
                borderColor: isActive ? 'transparent' : speakerColor,
                shadowColor: isActive ? speakerColor : 'transparent',
                elevation: isActive ? 3 : 0,
              },
              style,
            ]}
          >
            <Icon
              name={speakerIcon}
              size={sizeStyles.icon}
              color={isActive ? '#fff' : speakerColor}
              style={styles.icon}
            />
            <Text
              style={[
                styles.text,
                sizeStyles.text,
                { color: isActive ? '#fff' : speakerColor },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>

            {renderSimilarityIndicator()}

            {editable && (
              <TouchableOpacity
                onPress={handleEditPress}
                style={styles.editButton}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Icon
                  name="pencil-outline"
                  size={sizeStyles.icon - 2}
                  color={isActive ? '#fff' : speakerColor}
                  style={styles.editIcon}
                />
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* 编辑模态框 */}
      <Modal
        visible={isEditing}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditing(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsEditing(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.card,
                borderLeftWidth: 4,
                borderLeftColor: speakerColor,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Icon name={speakerIcon} size={24} color={speakerColor} style={styles.modalIcon} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                重命名说话人
              </Text>
            </View>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="输入说话人名称"
              placeholderTextColor={colors.text + '80'}
              autoFocus={true}
              returnKeyType="done"
              onSubmitEditing={handleRename}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.cancelButton,
                  { backgroundColor: colors.border },
                ]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  { backgroundColor: speakerColor },
                ]}
                onPress={handleRename}
              >
                <Text style={styles.buttonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
  },
  editButton: {
    padding: 2,
  },
  editIcon: {
    marginLeft: 4,
    opacity: 0.8,
  },
  similarityIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#4285F4',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default SpeakerLabel;
