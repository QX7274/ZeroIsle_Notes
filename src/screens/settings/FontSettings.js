/**
 * 字体设置屏幕
 */
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { Alert } from 'react-native';
import { useFontSize } from '../../context/FontSizeContext';

const FontSettings = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();
  const { fontSize, setFontSize } = useFontSize();

  // 从Redux获取设置
  const settings = useSelector(state => state.settings);

  // 字体大小选项
  const fontSizeOptions = [
    { value: 'small', label: '小', icon: 'format-size' },
    { value: 'medium', label: '中', icon: 'format-size' },
    { value: 'large', label: '大', icon: 'format-size' },
  ];

  // 更新字体大小
  const updateFontSize = async (value) => {
    try {
      // 保存到Redux
      const newSettings = { ...settings, fontSize: value };
      dispatch(updateSettings(newSettings));

      // 使用FontSizeContext更新全局字体大小
      await setFontSize(value);

      // 显示成功提示
      Alert.alert('设置已更新', '字体大小设置已保存并立即生效。');

      // 记录日志
      console.log(`字体大小已更改为: ${value}`);

      // 返回上一页
      navigation.goBack();
    } catch (error) {
      console.error('更新字体大小失败:', error);
      Alert.alert('错误', '更新字体大小失败，请重试');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {fontSizeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              {
                backgroundColor: colors.card,
                borderColor: fontSize === option.value ? colors.primary : 'transparent',
              },
            ]}
            onPress={() => updateFontSize(option.value)}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Icon name={option.icon} size={24} color={colors.primary} />
            </View>

            <View style={styles.optionInfo}>
              <Text
                variant="heading"
                level="h6"
              >
                {option.label}
              </Text>

              <Text
                variant="body"
                color="hint"
              >
                {option.value === 'small' ? '较小的字体大小' :
                 option.value === 'medium' ? '默认字体大小' : '较大的字体大小'}
              </Text>
            </View>

            {fontSize === option.value && (
              <Icon name="check-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.previewContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.previewTitle}
          >
            预览
          </Text>

          <View style={[styles.previewCard, { backgroundColor: colors.card }]}>
            <Text
              variant="heading"
              level="h5"
              style={[
                styles.previewHeading,
                { fontSize: fontSize === 'small' ? 18 : fontSize === 'medium' ? 20 : 22 },
              ]}
            >
              零屿笔记
            </Text>

            <Text
              variant="body"
              style={[
                styles.previewBody,
                { fontSize: fontSize === 'small' ? 14 : fontSize === 'medium' ? 16 : 18 },
              ]}
            >
              这是一段示例文本，用于展示不同字体大小的效果。您可以通过上面的选项来更改应用的字体大小设置。
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  previewTitle: {
    marginBottom: 16,
    marginLeft: 8,
  },
  previewCard: {
    padding: 20,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewHeading: {
    marginBottom: 16,
  },
  previewBody: {
    lineHeight: 24,
  },
});

export default FontSettings;
