/**
 * 主题设置屏幕
 * 提供主题类型和风格的设置
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { Text } from '../components/common/Typography';
import { GradientButton, GlassCard } from '../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../utils/haptics';
import * as Animations from '../utils/animations';

const ThemeSettingsScreen = ({ navigation }) => {
  const {
    theme,
    isDarkMode,
    themeType,
    themeStyle,
    toggleTheme,
    setThemeType,
    setThemeStyle,
  } = useTheme();

  const {
    isReduceMotionEnabled,
    getAccessibilityProps,
  } = useAccessibility();

  const { colors, dimensions } = theme;

  // 动画值
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  // 启动进入动画
  useEffect(() => {
    if (!isReduceMotionEnabled) {
      Animations.fadeIn(fadeAnim, 1, 500);
      Animations.scale(scaleAnim, 1, 500);
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, []);

  // 处理主题类型变更
  const handleThemeTypeChange = (type) => {
    Haptics.selectionFeedback();
    setThemeType(type);
  };

  // 处理主题风格变更
  const handleThemeStyleChange = (style) => {
    Haptics.selectionFeedback();
    setThemeStyle(style);
  };

  // 处理主题切换
  const handleToggleTheme = () => {
    Haptics.mediumFeedback();
    toggleTheme();
  };

  // 渲染主题类型选项
  const renderThemeTypeOptions = () => {
    const options = [
      { value: 'light', label: '浅色', icon: 'wb-sunny' },
      { value: 'dark', label: '深色', icon: 'nights-stay' },
      { value: 'system', label: '跟随系统', icon: 'settings-system-daydream' },
    ];

    return (
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              themeType === option.value && {
                backgroundColor: colors.primary + '20',
                borderColor: colors.primary,
              },
              { borderColor: colors.border }
            ]}
            onPress={() => handleThemeTypeChange(option.value)}
            {...getAccessibilityProps(
              `${option.label}主题`,
              `选择${option.label}主题`,
              true,
              themeType === option.value
            )}
          >
            <Icon
              name={option.icon}
              size={24}
              color={themeType === option.value ? colors.primary : colors.text}
            />
            <Text
              variant="body"
              size="medium"
              color={themeType === option.value ? 'primary' : 'text'}
              style={styles.optionLabel}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // 渲染主题风格选项
  const renderThemeStyleOptions = () => {
    return (
      <View style={styles.styleOptionsContainer}>
        {/* 经典风格 */}
        <TouchableOpacity
          style={[
            styles.styleOption,
            themeStyle === 'classic' && {
              borderColor: colors.primary,
            },
            { borderColor: colors.border }
          ]}
          onPress={() => handleThemeStyleChange('classic')}
          {...getAccessibilityProps(
            '经典风格',
            '选择经典风格主题',
            true,
            themeStyle === 'classic'
          )}
        >
          <View
            style={[
              styles.stylePreview,
              {
                backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
              }
            ]}
          >
            <View
              style={[
                styles.stylePreviewHeader,
                {
                  backgroundColor: isDarkMode ? '#1E1E1E' : '#F5F5F5',
                }
              ]}
            >
              <View
                style={[
                  styles.stylePreviewCircle,
                  { backgroundColor: isDarkMode ? '#BB86FC' : '#6200EE' }
                ]}
              />
            </View>
            <View style={styles.stylePreviewContent}>
              <View
                style={[
                  styles.stylePreviewLine,
                  { backgroundColor: isDarkMode ? '#333333' : '#E0E0E0' }
                ]}
              />
              <View
                style={[
                  styles.stylePreviewLine,
                  {
                    width: '70%',
                    backgroundColor: isDarkMode ? '#333333' : '#E0E0E0'
                  }
                ]}
              />
              <View
                style={[
                  styles.stylePreviewButton,
                  { backgroundColor: isDarkMode ? '#BB86FC' : '#6200EE' }
                ]}
              />
            </View>
          </View>
          <Text
            variant="body"
            size="medium"
            color={themeStyle === 'classic' ? 'primary' : 'text'}
            style={styles.styleLabel}
          >
            经典风格
          </Text>
          {themeStyle === 'classic' && (
            <Icon
              name="check-circle"
              size={20}
              color={colors.primary}
              style={styles.styleCheckIcon}
            />
          )}
        </TouchableOpacity>

        {/* 现代风格 */}
        <TouchableOpacity
          style={[
            styles.styleOption,
            themeStyle === 'modern' && {
              borderColor: colors.primary,
            },
            { borderColor: colors.border }
          ]}
          onPress={() => handleThemeStyleChange('modern')}
          {...getAccessibilityProps(
            '现代风格',
            '选择现代风格主题',
            true,
            themeStyle === 'modern'
          )}
        >
          <View
            style={[
              styles.stylePreview,
              {
                backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
                borderRadius: 16,
              }
            ]}
          >
            <View
              style={[
                styles.stylePreviewHeader,
                {
                  backgroundColor: isDarkMode ? '#1E1E1E' : '#F8F9FA',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                }
              ]}
            >
              <View
                style={[
                  styles.stylePreviewCircle,
                  {
                    backgroundColor: isDarkMode ? '#4CC9F0' : '#4361EE',
                    borderRadius: 8,
                  }
                ]}
              />
            </View>
            <View style={styles.stylePreviewContent}>
              <View
                style={[
                  styles.stylePreviewLine,
                  {
                    backgroundColor: isDarkMode ? '#333333' : '#E9ECEF',
                    borderRadius: 8,
                  }
                ]}
              />
              <View
                style={[
                  styles.stylePreviewLine,
                  {
                    width: '70%',
                    backgroundColor: isDarkMode ? '#333333' : '#E9ECEF',
                    borderRadius: 8,
                  }
                ]}
              />
              <View
                style={[
                  styles.stylePreviewGradientButton,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(76, 201, 240, 0.8)'
                      : 'rgba(67, 97, 238, 0.8)',
                    borderRadius: 12,
                  }
                ]}
              />
            </View>
          </View>
          <Text
            variant="body"
            size="medium"
            color={themeStyle === 'modern' ? 'primary' : 'text'}
            style={styles.styleLabel}
          >
            现代风格
          </Text>
          {themeStyle === 'modern' && (
            <Icon
              name="check-circle"
              size={20}
              color={colors.primary}
              style={styles.styleCheckIcon}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text
            variant="h2"
            size="large"
            style={styles.title}
          >
            主题设置
          </Text>
          <Text
            variant="body"
            size="medium"
            color="textSecondary"
            style={styles.description}
          >
            自定义应用的外观和风格，选择适合你的主题
          </Text>
        </View>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="palette" size={24} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.cardTitle}
            >
              主题模式
            </Text>
          </View>

          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.cardDescription}
          >
            选择浅色或深色主题，或跟随系统设置
          </Text>

          {renderThemeTypeOptions()}

          <View style={styles.toggleContainer}>
            <Text
              variant="body"
              size="medium"
            >
              {isDarkMode ? '深色模式' : '浅色模式'}
            </Text>
            <Switch
              value={isDarkMode}
              onValueChange={handleToggleTheme}
              trackColor={{ false: '#767577', true: colors.primary + '80' }}
              thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
              ios_backgroundColor="#767577"
              {...getAccessibilityProps(
                '切换深色模式',
                isDarkMode ? '关闭深色模式' : '开启深色模式',
                true
              )}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="style" size={24} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.cardTitle}
            >
              主题风格
            </Text>
          </View>

          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.cardDescription}
          >
            选择应用的视觉风格
          </Text>

          {renderThemeStyleOptions()}
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="color-lens" size={24} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.cardTitle}
            >
              自定义主题
            </Text>
          </View>

          <Text
            variant="body"
            size="small"
            color="textSecondary"
            style={styles.cardDescription}
          >
            自定义应用的颜色方案，创建专属于你的主题
          </Text>

          <GradientButton
            title="自定义颜色"
            onPress={() => navigation.navigate('ThemeCustomization')}
            style={styles.customizeButton}
          />
        </GlassCard>

        <View style={styles.buttonContainer}>
          <GradientButton
            title="应用设置"
            onPress={() => navigation.goBack()}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    marginLeft: 8,
  },
  cardDescription: {
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  optionLabel: {
    marginLeft: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  styleOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  styleOption: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
    position: 'relative',
  },
  stylePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  stylePreviewHeader: {
    height: 40,
    padding: 8,
  },
  stylePreviewCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stylePreviewContent: {
    padding: 8,
  },
  stylePreviewLine: {
    height: 12,
    width: '100%',
    marginBottom: 8,
  },
  stylePreviewButton: {
    height: 24,
    width: '50%',
    borderRadius: 4,
    marginTop: 16,
  },
  stylePreviewGradientButton: {
    height: 24,
    width: '50%',
    marginTop: 16,
  },
  styleLabel: {
    textAlign: 'center',
  },
  styleCheckIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  buttonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  button: {
    minWidth: 200,
  },
  customizeButton: {
    marginTop: 8,
  },
});

export default ThemeSettingsScreen;
