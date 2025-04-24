/**
 * 现代化Modal对话框组件
 * 支持动画效果和多种样式
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { selectModal, hideModal } from '../../redux/slices/uiSlice';
import { SPACING, BORDER_RADIUS, SHADOW } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 现代化Modal对话框组件
 * 自动连接到Redux状态，显示全局Modal
 */
const Modal = () => {
  const modal = useSelector(selectModal);
  const dispatch = useDispatch();
  const { colors, isDarkMode } = useTheme();

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // 获取动态样式
  const dynamicStyles = getStyles(colors, isDarkMode);

  // 处理模态框显示/隐藏动画
  useEffect(() => {
    if (modal.visible) {
      // 显示动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 隐藏动画
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [modal.visible, fadeAnim, scaleAnim]);

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
    const { title, message, onConfirm, icon, iconColor } = modal.data || {};

    return (
      <View style={dynamicStyles.content}>
        {icon && (
          <View style={[dynamicStyles.iconContainer, { backgroundColor: iconColor || colors.primary + '20' }]}>
            <Icon name={icon} size={32} color={iconColor || colors.primary} />
          </View>
        )}
        {title && <Text style={dynamicStyles.title}>{title}</Text>}
        {message && <Text style={dynamicStyles.message}>{message}</Text>}
        <View style={dynamicStyles.buttonContainer}>
          <Button
            title="确定"
            type="gradient"
            gradientType="primary"
            rounded
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
    const {
      title,
      message,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
      icon,
      iconColor,
      destructive
    } = modal.data || {};

    return (
      <View style={dynamicStyles.content}>
        {icon && (
          <View style={[
            dynamicStyles.iconContainer,
            { backgroundColor: (destructive ? colors.error : iconColor || colors.primary) + '20' }
          ]}>
            <Icon
              name={icon}
              size={32}
              color={destructive ? colors.error : (iconColor || colors.primary)}
            />
          </View>
        )}
        {title && <Text style={dynamicStyles.title}>{title}</Text>}
        {message && <Text style={dynamicStyles.message}>{message}</Text>}
        <View style={dynamicStyles.buttonContainer}>
          <Button
            title={cancelText || "取消"}
            type="outline"
            rounded
            onPress={() => {
              closeModal();
              if (onCancel) onCancel();
            }}
            style={[dynamicStyles.button, dynamicStyles.cancelButton]}
          />
          <Button
            title={confirmText || "确定"}
            type={destructive ? 'gradient' : 'gradient'}
            gradientType={destructive ? 'error' : 'primary'}
            rounded
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
    const { content, showCloseButton } = modal.data || {};

    return (
      <View style={dynamicStyles.customContent}>
        {showCloseButton && (
          <TouchableOpacity
            style={dynamicStyles.closeButton}
            onPress={closeModal}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Icon name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {content || null}
      </View>
    );
  };

  // 计算动画样式
  const animatedOverlayStyle = {
    opacity: fadeAnim,
  };

  const animatedModalStyle = {
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }],
  };

  return (
    <RNModal
      visible={modal.visible}
      transparent
      animationType="none"
      onRequestClose={closeModal}
      statusBarTranslucent
    >
      <Animated.View style={[dynamicStyles.overlay, animatedOverlayStyle]}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={dynamicStyles.overlayTouchable}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <Animated.View style={[dynamicStyles.modalContainer, animatedModalStyle]}>
                {renderContent()}
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </RNModal>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors, isDarkMode) => {
  // 获取屏幕尺寸
  const { width, height } = Dimensions.get('window');

  return {
    // 背景遮罩
    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // 可点击区域
    overlayTouchable: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // 模态框容器
    modalContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.LARGE,
      width: width > 550 ? 500 : width * 0.85,
      maxWidth: 500,
      padding: SPACING.LARGE,
      ...SHADOW.LARGE,
      // 添加边框以增强在暗模式下的可见性
      borderWidth: isDarkMode ? 1 : 0,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    },

    // 内容容器
    content: {
      alignItems: 'center',
      width: '100%',
    },

    // 自定义内容容器
    customContent: {
      width: '100%',
      position: 'relative',
    },

    // 图标容器
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.MEDIUM,
    },

    // 标题
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: SPACING.MEDIUM,
      textAlign: 'center',
    },

    // 消息文本
    message: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: SPACING.LARGE,
      textAlign: 'center',
      lineHeight: 22,
    },

    // 按钮容器
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      marginTop: SPACING.SMALL,
    },

    // 按钮
    button: {
      minWidth: 120,
      marginHorizontal: SPACING.SMALL,
    },

    // 取消按钮
    cancelButton: {
      marginRight: SPACING.SMALL,
    },

    // 关闭按钮
    closeButton: {
      position: 'absolute',
      top: -SPACING.SMALL,
      right: -SPACING.SMALL,
      zIndex: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  };
};

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({});

export default Modal;