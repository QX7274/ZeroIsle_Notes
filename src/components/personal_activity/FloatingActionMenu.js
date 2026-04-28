/**
 * 浮动操作菜单组件 - 支持多种内容创建选项
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';

const { width } = Dimensions.get('window');

const FloatingActionMenu = ({ onCreateDiary, onCreateThought, onCreateActivity }) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;

    Haptics.mediumFeedback();

    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    setIsOpen(!isOpen);
  };

  const handleMenuItemPress = (action) => {
    Haptics.lightFeedback();
    toggleMenu();
    setTimeout(() => {
      action();
    }, 200);
  };

  const menuItems = [
    {
      key: 'diary',
      title: '写日记',
      icon: 'book',
      color: '#FF6B6B',
      action: () => handleMenuItemPress(onCreateDiary),
    },
    {
      key: 'thought',
      title: '记想法',
      icon: 'lightbulb',
      color: '#4ECDC4',
      action: () => handleMenuItemPress(onCreateThought),
    },
    {
      key: 'activity',
      title: '记活动',
      icon: 'event',
      color: '#45B7D1',
      action: () => handleMenuItemPress(onCreateActivity),
    },
  ];

  const mainButtonRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  return (
    <>
      {/* 背景遮罩 */}
      {isOpen && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={toggleMenu}
            activeOpacity={1}
          />
        </Animated.View>
      )}

      {/* 菜单项 */}
      <View style={styles.menuContainer} pointerEvents="box-none">
        {menuItems.map((item, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(60 + index * 60)],
          });

          const scale = animation.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 0.8, 1],
          });

          const opacity = animation.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, 0.8, 1],
          });

          return (
            <Animated.View
              key={item.key}
              style={[
                styles.menuItem,
                {
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.menuButton,
                  { backgroundColor: item.color },
                ]}
                onPress={item.action}
                activeOpacity={0.8}
              >
                <Icon name={item.icon} size={24} color="#fff" />
              </TouchableOpacity>

              <View style={[styles.menuLabel, { backgroundColor: colors.card }]}>
                <Text variant="caption" style={[styles.menuLabelText, { color: colors.text }]}>
                  {item.title}
                </Text>
              </View>
            </Animated.View>
          );
        })}

        {/* 主按钮 */}
        <Animated.View
          style={[
            styles.mainButton,
            {
              backgroundColor: colors.primary,
              transform: [{ rotate: mainButtonRotation }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.mainButtonTouchable}
            onPress={toggleMenu}
            activeOpacity={0.8}
          >
            <Icon name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 998,
  },
  menuContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 999,
  },
  menuItem: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    bottom: 0,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuLabel: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  menuLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  mainButtonTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FloatingActionMenu;
