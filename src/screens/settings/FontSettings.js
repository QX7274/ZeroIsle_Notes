import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { useFontSize } from '../../context/FontSizeContext';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const FontSettings = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { fontSize, setFontSize } = useFontSize();
  const settings = useSelector((state) => state.settings);

  const fontSizeOptions = [
    { value: 'small', label: '小', icon: 'format-size' },
    { value: 'medium', label: '中', icon: 'format-size' },
    { value: 'large', label: '大', icon: 'format-size' },
  ];

  const updateFontSize = async (value) => {
    try {
      const newSettings = { ...settings, fontSize: value };
      dispatch(updateSettings(newSettings));
      await setFontSize(value);
      Alert.alert('设置已更新', '字体大小设置已保存并立即生效。');
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', '更新字体大小失败，请重试。');
    }
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID="state.settings.font.state.ready">
      <View testID="state.settings.font.visibility.visible" />
      <View testID={`state.settings.font.current.${fontSize || 'unknown'}`} />
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.settings.font.back"
          style={styles.backButton}
        />
        <Text variant="heading" level="h5" style={styles.pageTitle}>字体设置</Text>
      </View>
      <ScrollView style={styles.content} testID="list.settings.font.options">
        {fontSizeOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionItem,
              styles.glassCard,
              { borderColor: fontSize === option.value ? colors.primary : 'rgba(76,141,255,0.18)' },
            ]}
            onPress={() => updateFontSize(option.value)}
            testID={`action.settings.font.select.${option.value}`}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Icon name={option.icon} size={24} color={colors.primary} />
            </View>

            <View style={styles.optionInfo}>
              <Text variant="heading" level="h6">{option.label}</Text>
              <Text variant="body" color="hint">
                {option.value === 'small'
                  ? '较小的字体大小'
                  : option.value === 'medium'
                    ? '默认字体大小'
                    : '较大的字体大小'}
              </Text>
            </View>

            {fontSize === option.value ? (
              <Icon name="check-circle" size={24} color={colors.primary} />
            ) : null}
          </TouchableOpacity>
        ))}

        <View style={styles.previewContainer}>
          <Text variant="heading" level="h6" style={styles.previewTitle}>预览</Text>
          <View style={[styles.previewCard, styles.glassCard]}>
            <Text
              variant="heading"
              level="h5"
              style={{ marginBottom: 14, fontSize: fontSize === 'small' ? 18 : fontSize === 'medium' ? 20 : 22 }}
              testID="state.settings.font.previewTitle"
            >
              ZeroIsle Notes
            </Text>
            <Text
              variant="body"
              style={{ lineHeight: 24, fontSize: fontSize === 'small' ? 14 : fontSize === 'medium' ? 16 : 18 }}
              testID="state.settings.font.previewBody"
            >
              这是预览文本，用于展示不同字体大小的显示效果。你可以通过上方选项快速调整全局字体设置。
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: {
    flex: 1,
  },
  content: { flex: 1 },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginBottom: 14,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionInfo: {
    flex: 1,
  },
  previewContainer: {
    marginTop: 20,
    marginBottom: 32,
  },
  previewTitle: {
    marginBottom: 12,
    marginLeft: 8,
  },
  previewCard: {
    padding: 18,
  },
});

export default FontSettings;
