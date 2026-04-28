/**
 * 处理进度模态框组件
 * 用于显示文件处理进度，避免用户感觉UI卡顿
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const ProcessingProgressModal = ({
  visible,
  progress = 0,
  message = '正在处理...',
  stage = 'processing',
  onCancel = null,
  cancelable = false,
}) => {
  const { colors } = useTheme();

  // 确保progress是有效的数字
  const safeProgress = isNaN(progress) || progress === null || progress === undefined ? 0 : Math.max(0, Math.min(100, progress));

  const getStageText = (stage) => {
    const stageMap = {
      preparing: '准备中',
      validating: '验证文件',
      copying: '复制文件',
      formatting: '格式化数据',
      importing: '导入文件',
      uploading: '上传中',
      processing: '处理中',
      verifying: '验证中',
      completed: '完成',
    };
    return stageMap[stage] || '处理中';
  };

  const getProgressColor = (progress) => {
    if (progress < 30) {return '#FF6B6B';}
    if (progress < 70) {return '#FFD93D';}
    return '#6BCF7F';
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      width: width * 0.8,
      maxWidth: 320,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    progressContainer: {
      width: '100%',
      marginBottom: 16,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      transition: 'width 0.3s ease',
    },
    progressText: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    stageText: {
      fontSize: 12,
      color: colors.text + '80',
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 20,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    loadingText: {
      fontSize: 14,
      color: colors.text,
      marginLeft: 12,
    },
    cancelButton: {
      marginTop: 16,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    cancelButtonText: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
    },
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>处理文件</Text>

          {/* 进度条 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${safeProgress}%`,
                    backgroundColor: getProgressColor(safeProgress),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(safeProgress)}%
            </Text>
            <Text style={styles.stageText}>
              {getStageText(stage)}
            </Text>
          </View>

          {/* 消息 */}
          <Text style={styles.message}>{message}</Text>

          {/* 加载指示器 */}
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="small"
              color={getProgressColor(safeProgress)}
            />
            <Text style={styles.loadingText}>
              请稍候，正在后台处理...
            </Text>
          </View>

          {/* 取消按钮 */}
          {cancelable && onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ProcessingProgressModal;
