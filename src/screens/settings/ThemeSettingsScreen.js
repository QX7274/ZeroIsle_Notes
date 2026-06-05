import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const ThemeSettingsScreen = ({ navigation }) => {
  const { theme, setThemeType } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings);

  const themeOptions = [
    { value: 'light', label: '浅色', icon: 'wb-sunny' },
    { value: 'dark', label: '深色', icon: 'nights-stay' },
    { value: 'system', label: '跟随系统', icon: 'settings-system-daydream' },
  ];

  const updateTheme = (value) => {
    const newSettings = { ...settings, theme: value };
    dispatch(updateSettings(newSettings));
    setThemeType(value);
    navigation.goBack();
  };

  const renderThemeOption = ({ value, label, icon }) => {
    const isSelected = settings.theme === value;
    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.themeOption,
          styles.glassCard,
          isSelected && { borderColor: colors.primary, borderWidth: 2 },
        ]}
        onPress={() => updateTheme(value)}
        testID={`action.settings.theme.select.${value}`}
      >
        <View
          style={[
            styles.themePreview,
            {
              backgroundColor:
                value === 'light'
                  ? '#FFFFFF'
                  : value === 'dark'
                    ? '#121212'
                    : '#F6FAFF',
            },
          ]}
        >
          <View style={styles.previewHeader}>
            <View
              style={[
                styles.previewStatusBar,
                { backgroundColor: value === 'dark' ? '#1E1E1E' : '#DFEBFA' },
              ]}
            />
          </View>
          <View style={styles.previewContent}>
            <View
              style={[
                styles.previewText,
                { backgroundColor: value === 'dark' ? '#373737' : '#CFDDF2' },
              ]}
            />
            <View
              style={[
                styles.previewText,
                {
                  width: '70%',
                  backgroundColor: value === 'dark' ? '#373737' : '#CFDDF2',
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.themeInfo}>
          <Icon name={icon} size={22} color={isSelected ? colors.primary : colors.text} />
          <Text
            variant="body"
            size="medium"
            style={[styles.themeLabel, { color: isSelected ? colors.primary : colors.text }]}
          >
            {label}
          </Text>
          {isSelected ? <Icon name="check-circle" size={18} color={colors.primary} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: '#F3F8FF' }]} testID="state.settings.theme.state.ready">
      <View testID="state.settings.theme.visibility.visible" />
      <View testID={`state.settings.theme.current.${settings.theme || 'unknown'}`} />
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.settings.theme.back"
          style={styles.backButton}
        />
        <Text variant="heading" level="h5" style={styles.pageTitle}>主题设置</Text>
      </View>
      <ScrollView style={styles.content} testID="list.settings.theme.options">
        <Text variant="body" size="medium" color="hint" style={styles.description}>
          选择应用的主题外观。
        </Text>
        <View style={styles.themeOptions}>{themeOptions.map(renderThemeOption)}</View>
        <Text variant="caption" color="hint" style={styles.note} testID="state.settings.theme.note">
          选择“跟随系统”会根据设备深浅色模式自动切换。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
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
  description: { marginBottom: 16 },
  themeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderColor: 'rgba(76,141,255,0.18)',
    borderWidth: 1,
    borderRadius: 14,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  themeOption: {
    width: '48%',
    overflow: 'hidden',
    marginBottom: 16,
  },
  themePreview: {
    height: 140,
    padding: 8,
  },
  previewHeader: {
    height: 18,
    marginBottom: 8,
  },
  previewStatusBar: {
    height: 8,
    width: '100%',
    borderRadius: 4,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
  },
  previewText: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    marginBottom: 8,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(76,141,255,0.14)',
  },
  themeLabel: {
    flex: 1,
    marginLeft: 8,
  },
  note: {
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default ThemeSettingsScreen;
