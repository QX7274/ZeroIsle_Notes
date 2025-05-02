/**
 * 离线AI工具栏组件
 * 提供离线手写识别等AI功能
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { offlineAIService, MODEL_TYPES_EXPORT, MODEL_STATUS_EXPORT } from '../../services/offlineAIService';

const OfflineAIToolbar = ({ onRecognizeHandwriting }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelStatus, setModelStatus] = useState({
    [MODEL_TYPES_EXPORT.HANDWRITING]: MODEL_STATUS_EXPORT.NOT_LOADED,
    [MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION]: MODEL_STATUS_EXPORT.NOT_LOADED,
  });
  const [offlineEnabled, setOfflineEnabled] = useState(false);

  // 加载模型状态
  useEffect(() => {
    updateModelStatus();
  }, []);

  // 更新模型状态
  const updateModelStatus = () => {
    const status = {
      [MODEL_TYPES_EXPORT.HANDWRITING]: offlineAIService.getModelStatus(MODEL_TYPES_EXPORT.HANDWRITING),
      [MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION]: offlineAIService.getModelStatus(MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION),
    };
    setModelStatus(status);

    // 如果任一模型已加载，则启用离线模式
    if (status[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED ||
        status[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED) {
      setOfflineEnabled(true);
    }
  };

  // 加载模型
  const handleLoadModel = async (modelType) => {
    try {
      setIsProcessing(true);

      // 加载模型
      await offlineAIService.loadModel(modelType);

      // 更新模型状态
      updateModelStatus();

      Alert.alert('成功', `模型已加载: ${modelType}`);
    } catch (error) {
      console.error(`模型加载失败: ${modelType}`, error);
      Alert.alert('错误', `模型加载失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 卸载模型
  const handleUnloadModel = async (modelType) => {
    try {
      setIsProcessing(true);

      // 卸载模型
      await offlineAIService.unloadModel(modelType);

      // 更新模型状态
      updateModelStatus();

      Alert.alert('成功', `模型已卸载: ${modelType}`);
    } catch (error) {
      console.error(`模型卸载失败: ${modelType}`, error);
      Alert.alert('错误', `模型卸载失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理离线模式切换
  const handleOfflineModeToggle = (value) => {
    setOfflineEnabled(value);

    if (value) {
      // 如果启用离线模式，但模型未加载，则提示加载模型
      const handwritingStatus = offlineAIService.getModelStatus(MODEL_TYPES_EXPORT.HANDWRITING);
      if (handwritingStatus !== MODEL_STATUS_EXPORT.LOADED) {
        Alert.alert(
          '加载模型',
          '离线模式需要加载模型，是否现在加载？',
          [
            { text: '取消', style: 'cancel', onPress: () => setOfflineEnabled(false) },
            { text: '加载', onPress: () => handleLoadModel(MODEL_TYPES_EXPORT.HANDWRITING) },
          ]
        );
      }
    }
  };

  // 处理手写识别
  const handleHandwritingRecognition = () => {
    // 检查模型是否已加载
    const status = offlineAIService.getModelStatus(MODEL_TYPES_EXPORT.HANDWRITING);
    if (status !== MODEL_STATUS_EXPORT.LOADED) {
      Alert.alert(
        '模型未加载',
        '请先加载手写识别模型',
        [
          { text: '取消', style: 'cancel' },
          { text: '加载', onPress: () => handleLoadModel(MODEL_TYPES_EXPORT.HANDWRITING) },
        ]
      );
      return;
    }

    // 调用手写识别函数
    if (onRecognizeHandwriting) {
      onRecognizeHandwriting();
    }
  };

  // 渲染工具按钮
  const renderToolButtons = () => {
    return (
      <View style={styles.toolsContainer}>
        <TouchableOpacity
          style={[
            styles.toolButton,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={handleHandwritingRecognition}
        >
          <Icon name="gesture" size={20} color={colors.primary} />
          <Text
            variant="body"
            size="small"
            color="text"
            style={styles.toolButtonText}
          >
            手写识别
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolButton,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={() => setShowSettingsModal(true)}
        >
          <Icon name="settings" size={20} color={colors.textSecondary} />
          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.toolButtonText}
          >
            离线设置
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // 渲染设置模态框
  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">离线AI设置</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingsContainer}>
            <View style={styles.settingItem}>
              <Text variant="body" size="medium" color="text">启用离线模式</Text>
              <Switch
                value={offlineEnabled}
                onValueChange={handleOfflineModeToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={offlineEnabled ? colors.primaryLight : colors.background}
              />
            </View>

            <View style={styles.modelSection}>
              <Text variant="heading" level="h6" style={styles.sectionTitle}>模型管理</Text>

              <View style={styles.modelItem}>
                <View style={styles.modelInfo}>
                  <Text variant="body" size="medium" color="text">手写识别模型</Text>
                  <Text
                    variant="caption"
                    color={modelStatus[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED ? 'success' : 'error'}
                  >
                    {modelStatus[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED ? '已加载' : '未加载'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.modelButton,
                    {
                      backgroundColor: modelStatus[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED
                        ? colors.error
                        : colors.primary
                    }
                  ]}
                  onPress={() => {
                    if (modelStatus[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED) {
                      handleUnloadModel(MODEL_TYPES_EXPORT.HANDWRITING);
                    } else {
                      handleLoadModel(MODEL_TYPES_EXPORT.HANDWRITING);
                    }
                  }}
                >
                  <Text variant="body" size="small" color="white">
                    {modelStatus[MODEL_TYPES_EXPORT.HANDWRITING] === MODEL_STATUS_EXPORT.LOADED ? '卸载' : '加载'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modelItem}>
                <View style={styles.modelInfo}>
                  <Text variant="body" size="medium" color="text">文本分类模型</Text>
                  <Text
                    variant="caption"
                    color={modelStatus[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED ? 'success' : 'error'}
                  >
                    {modelStatus[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED ? '已加载' : '未加载'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.modelButton,
                    {
                      backgroundColor: modelStatus[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED
                        ? colors.error
                        : colors.primary
                    }
                  ]}
                  onPress={() => {
                    if (modelStatus[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED) {
                      handleUnloadModel(MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION);
                    } else {
                      handleLoadModel(MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION);
                    }
                  }}
                >
                  <Text variant="body" size="small" color="white">
                    {modelStatus[MODEL_TYPES_EXPORT.TEXT_CLASSIFICATION] === MODEL_STATUS_EXPORT.LOADED ? '卸载' : '加载'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoSection}>
              <Text variant="body" size="small" color="textSecondary">
                离线模式可以在没有网络连接的情况下使用AI功能，但功能可能受限。
                加载模型会占用设备存储空间和内存。
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // 渲染加载指示器
  const renderLoader = () => {
    if (isProcessing) {
      return (
        <View style={[styles.loaderContainer, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
          <View style={[styles.loaderContent, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              color="text"
              style={styles.loaderText}
            >
              正在处理...
            </Text>
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderToolButtons()}
      {renderSettingsModal()}
      {renderLoader()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  toolsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toolButtonText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingsContainer: {
    padding: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
  },
  modelSection: {
    marginTop: 20,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  modelInfo: {
    flex: 1,
  },
  modelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loaderContent: {
    padding: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loaderText: {
    marginLeft: 20,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default OfflineAIToolbar;
