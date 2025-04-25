/**
 * 通用Modal对话框组件
 */

import React from 'react';
import { View, Text, StyleSheet, Modal as RNModal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { selectModal, hideModal } from '../../redux/slices/uiSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';

/**
 * 通用Modal对话框组件
 * 自动连接到Redux状态，显示全局Modal
 */
const Modal = () => {
  const modal = useSelector(selectModal);
  const dispatch = useDispatch();
  const { colors } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  const closeModal = () => {
    dispatch(hideModal());
  };

  // 根据modal.type渲染不同的内容
  const renderContent = () => {
    switch (modal.type) {
      case 'alert':
        return renderAlert();
      case 'confirm':
        return renderConfirm();
      case 'custom':
        return renderCustom();
      default:
        return null;
    }
  };

  // 渲染提示对话框
  const renderAlert = () => {
    const { title, message, onConfirm } = modal.data || {};

    return (
      <View style={dynamicStyles.content}>
        {title && <Text style={dynamicStyles.title}>{title}</Text>}
        {message && <Text style={dynamicStyles.message}>{message}</Text>}
        <View style={dynamicStyles.buttonContainer}>
          <Button
            title="确定"
            onPress={() => {
              closeModal();
              if (onConfirm) onConfirm();
            }}
            style={dynamicStyles.button}
          />
        </View>
      </View>
    );
  };

  // 渲染确认对话框
  const renderConfirm = () => {
    const { title, message, onConfirm, onCancel, confirmText, cancelText } = modal.data || {};

    return (
      <View style={dynamicStyles.content}>
        {title && <Text style={dynamicStyles.title}>{title}</Text>}
        {message && <Text style={dynamicStyles.message}>{message}</Text>}
        <View style={dynamicStyles.buttonContainer}>
          <Button
            title={cancelText || "取消"}
            type="outline"
            onPress={() => {
              closeModal();
              if (onCancel) onCancel();
            }}
            style={[dynamicStyles.button, dynamicStyles.cancelButton]}
          />
          <Button
            title={confirmText || "确定"}
            onPress={() => {
              closeModal();
              if (onConfirm) onConfirm();
            }}
            style={dynamicStyles.button}
          />
        </View>
      </View>
    );
  };

  // 渲染自定义内容
  const renderCustom = () => {
    const { content } = modal.data || {};
    return content || null;
  };

  return (
    <RNModal
      visible={modal.visible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <TouchableWithoutFeedback onPress={closeModal}>
        <View style={dynamicStyles.overlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={dynamicStyles.modalContainer}>
              {renderContent()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.white || '#FFFFFF',
    borderRadius: 8, // 使用固定值替代borderRadius.medium
    width: '80%',
    maxWidth: 400,
    padding: SPACING.LARGE,
    shadowColor: colors.shadow || '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text || '#000000',
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary || '#8E8E93',
    marginBottom: SPACING.LARGE,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    minWidth: 100,
    marginHorizontal: SPACING.SMALL,
  },
  cancelButton: {
    marginRight: SPACING.SMALL,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  overlay: {},
  modalContainer: {},
  content: {},
  title: {},
  message: {},
  buttonContainer: {},
  button: {},
  cancelButton: {},
});

export default Modal;