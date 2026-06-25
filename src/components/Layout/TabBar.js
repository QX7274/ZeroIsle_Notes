/**
 * 标签栏组件
 * 提供一个自定义的底部标签栏，用于在不同页面之间导航
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 获取屏幕宽度
const { width } = Dimensions.get('window');

/**
 * 标签栏组件
 * @param {Array} tabs - 标签数组，每个标签包含 { key, label, icon, badge }
 * @param {string} activeTab - 当前激活的标签key
 * @param {function} onTabPress - 标签点击回调，参数为标签key
 * @param {boolean} showLabels - 是否显示标签文本
 * @param {boolean} showIndicator - 是否显示指示器
 * @param {boolean} animated - 是否使用动画
 * @param {object} style - 自定义样式
 */
const TabBar = ({
  tabs = [],
  activeTab,
  onTabPress,
  showLabels = true,
  showIndicator = true,
  animated = true,
  style,
}) => {
  // 使用主题
  const { theme } = useTheme();
  const { colors } = theme;

  // 获取安全区域
  const insets = useSafeAreaInsets();

  // 状态
  const [activeIndex, setActiveIndex] = useState(0);

  // 动画值
  const [indicatorPosition] = useState(() => new Animated.Value(0));

  // 当activeTab变化时，更新activeIndex
  useEffect(() => {
    const index = tabs.findIndex((tab) => tab.key === activeTab);
    if (index !== -1) {
      setActiveIndex(index);

      // 如果使用动画，则执行指示器动画
      if (animated && showIndicator) {
        Animated.spring(indicatorPosition, {
          toValue: index * (width / tabs.length),
          useNativeDriver: false,
          friction: 8,
          tension: 50,
        }).start();
      } else {
        indicatorPosition.setValue(index * (width / tabs.length));
      }
    }
  }, [activeTab, tabs, animated, showIndicator, indicatorPosition]);

  // 处理标签点击
  const handleTabPress = (tab, index) => {
    if (onTabPress) {
      onTabPress(tab.key);
    }
  };

  // 渲染标签
  const renderTab = (tab, index) => {
    const isActive = index === activeIndex;

    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.tab}
        onPress={() => handleTabPress(tab, index)}
        activeOpacity={0.7}
      >
        <View style={styles.tabContent}>
          {/* 图标 */}
          <Icon
            name={tab.icon}
            size={24}
            color={isActive ? colors.primary : colors.textSecondary}
          />

          {/* 标签文本 */}
          {showLabels && (
            <Text
              variant="caption"
              style={[
                styles.tabLabel,
                {
                  color: isActive ? colors.primary : colors.textSecondary,
                  marginTop: 2,
                },
              ]}
            >
              {tab.label}
            </Text>
          )}

          {/* 徽章 */}
          {tab.badge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.error,
                  top: 0,
                  right: showLabels ? -10 : -5,
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  color: colors.onError,
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              >
                {typeof tab.badge === 'number' && tab.badge > 99
                  ? '99+'
                  : tab.badge}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染指示器
  const renderIndicator = () => {
    if (!showIndicator) {return null;}

    return (
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.primary,
            width: width / tabs.length - 40,
            left: indicatorPosition,
            transform: [
              {
                translateX: 20,
              },
            ],
          },
        ]}
      />
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
        style,
      ]}
    >
      {/* 指示器 */}
      {renderIndicator()}

      {/* 标签 */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => renderTab(tab, index))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    textAlign: 'center',
    fontSize: 12,
  },
  indicator: {
    position: 'absolute',
    height: 3,
    borderRadius: 1.5,
    bottom: Platform.OS === 'ios' ? 0 : 0,
  },
  badge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});

export default TabBar;
