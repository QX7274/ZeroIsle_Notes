/**
 * 图片查看器组件 - 支持多图浏览和缩放
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const ImageViewer = ({ visible, images = [], initialIndex = 0, onClose }) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // 动画值
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // 重置变换
  const resetTransform = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  // 缩放手势处理
  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startScale = scale.value;
    },
    onActive: (event, context) => {
      scale.value = Math.max(0.5, Math.min(3, context.startScale * event.scale));
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 2.5) {
        scale.value = withSpring(2.5);
      }
    },
  });

  // 平移手势处理
  const panHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      if (scale.value > 1) {
        // 缩放状态下允许平移
        translateX.value = context.startX + event.translationX;
        translateY.value = context.startY + event.translationY;
      } else {
        // 正常状态下水平滑动切换图片
        translateX.value = event.translationX;
      }
    },
    onEnd: (event) => {
      if (scale.value > 1) {
        // 缩放状态下的边界检查
        const maxTranslateX = (width * (scale.value - 1)) / 2;
        const maxTranslateY = (height * (scale.value - 1)) / 2;

        if (translateX.value > maxTranslateX) {
          translateX.value = withSpring(maxTranslateX);
        } else if (translateX.value < -maxTranslateX) {
          translateX.value = withSpring(-maxTranslateX);
        }

        if (translateY.value > maxTranslateY) {
          translateY.value = withSpring(maxTranslateY);
        } else if (translateY.value < -maxTranslateY) {
          translateY.value = withSpring(-maxTranslateY);
        }
      } else {
        // 切换图片逻辑
        if (Math.abs(event.translationX) > width * 0.3) {
          if (event.translationX > 0 && currentIndex > 0) {
            runOnJS(setCurrentIndex)(currentIndex - 1);
          } else if (event.translationX < 0 && currentIndex < images.length - 1) {
            runOnJS(setCurrentIndex)(currentIndex + 1);
          }
        }
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const handleClose = () => {
    resetTransform();
    setCurrentIndex(initialIndex);
    onClose();
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetTransform();
    }
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetTransform();
    }
  };

  if (!visible || !images.length) {return null;}

  const currentImage = images[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* 背景遮罩 */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        {/* 头部工具栏 */}
        <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* 图片容器 */}
        <View style={styles.imageContainer}>
          <PanGestureHandler onGestureEvent={panHandler}>
            <Animated.View style={styles.gestureContainer}>
              <PinchGestureHandler onGestureEvent={pinchHandler}>
                <Animated.View style={[styles.imageWrapper, animatedStyle]}>
                  <Image
                    source={{ uri: currentImage.url }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </View>

        {/* 底部导航 */}
        {images.length > 1 && (
          <View style={[styles.navigation, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              onPress={goToPrevious}
              disabled={currentIndex === 0}
            >
              <Icon
                name="chevron-left"
                size={32}
                color={currentIndex === 0 ? '#666' : '#fff'}
              />
            </TouchableOpacity>

            <View style={styles.indicators}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentIndex && styles.activeIndicator,
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.navButton,
                currentIndex === images.length - 1 && styles.navButtonDisabled,
              ]}
              onPress={goToNext}
              disabled={currentIndex === images.length - 1}
            >
              <Icon
                name="chevron-right"
                size={32}
                color={currentIndex === images.length - 1 ? '#666' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  closeButton: {
    padding: 8,
  },
  counter: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 40,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gestureContainer: {
    width: width,
    height: height - 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: width,
    height: height - 200,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeIndicator: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ImageViewer;
