/**
 * 主题设置屏幕
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';

const ThemeSettingsScreen = ({ navigation }) => {
  const { theme, setThemeType } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取设置
  const settings = useSelector(state => state.settings);

  // 主题选项
  const themeOptions = [
    { value: 'light', label: '浅色', icon: 'wb-sunny' },
    { value: 'dark', label: '深色', icon: 'nights-stay' },
    { value: 'system', label: '跟随系统', icon: 'settings-system-daydream' },
  ];

  // 更新主题
  const updateTheme = (value) => {
    const newSettings = { ...settings, theme: value };
    dispatch(updateSettings(newSettings));
    setThemeType(value);
    navigation.goBack();
  };

  // 渲染主题选项
  const renderThemeOption = ({ value, label, icon }) => {
    const isSelected = settings.theme === value;

    return (
      <TouchableOpacity
        key={value}
        style={[
          styles.themeOption,
          { backgroundColor: colors.card },
          isSelected && { borderColor: colors.primary, borderWidth: 2 }
        ]}
        onPress={() => updateTheme(value)}
      >
        <View
          style={[
            styles.themePreview,
            {
              backgroundColor: value === 'light' ? '#FFFFFF' :
                             value === 'dark' ? '#121212' :
                             '#F5F5F5'
            }
          ]}
        >
          <View style={styles.previewHeader}>
            <View
              style={[
                styles.previewStatusBar,
                {
                  backgroundColor: value === 'light' ? '#F5F5F5' :
                                 value === 'dark' ? '#1E1E1E' :
                                 '#E0E0E0'
                }
              ]}
            />
          </View>

          <View style={styles.previewContent}>
            <View
              style={[
                styles.previewText,
                {
                  backgroundColor: value === 'light' ? '#E0E0E0' :
                                 value === 'dark' ? '#333333' :
                                 '#CCCCCC'
                }
              ]}
            />
            <View
              style={[
                styles.previewText,
                {
                  width: '70%',
                  backgroundColor: value === 'light' ? '#E0E0E0' :
                                 value === 'dark' ? '#333333' :
                                 '#CCCCCC'
                }
              ]}
            />
          </View>
        </View>

        <View style={styles.themeInfo}>
          <Icon
            name={icon}
            size={24}
            color={isSelected ? colors.primary : colors.text}
          />
          <Text
            variant="body"
            size="medium"
            color={isSelected ? 'primary' : 'text'}
            style={styles.themeLabel}
          >
            {label}
          </Text>

          {isSelected && (
            <Icon name="check-circle" size={20} color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        <Text
          variant="body"
          size="medium"
          color="hint"
          style={styles.description}
        >
          选择应用的主题外观
        </Text>

        <View style={styles.themeOptions}>
          {themeOptions.map(renderThemeOption)}
        </View>

        <Text
          variant="caption"
          color="hint"
          style={styles.note}
        >
          选择"跟随系统"将根据设备的深色模式设置自动切换主题
        </Text>
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
    padding: 16,
  },
  description: {
    marginBottom: 16,
  },
  themeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  themeOption: {
    width: '48%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  themePreview: {
    height: 150,
    padding: 8,
  },
  previewHeader: {
    height: 20,
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
    borderTopColor: '#f0f0f0',
  },
  themeLabel: {
    flex: 1,
    marginLeft: 8,
  },
  note: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ThemeSettingsScreen;
