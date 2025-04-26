/**
 * 设置屏幕
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { DEFAULT_SETTINGS } from '../../utils/constants/config';
import { offlineStorageService } from '../../services/offlineStorage';
import DeviceInfo from 'react-native-device-info';

const SettingsScreen = ({ navigation }) => {
  const { theme, setTheme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();
  
  // 从Redux获取设置
  const settings = useSelector(state => state.settings);
  const user = useSelector(state => state.auth.user);
  
  // 本地状态
  const [appVersion, setAppVersion] = useState('');
  const [offlineStatus, setOfflineStatus] = useState(offlineStorageService.getStatus());
  
  // 获取应用版本
  useEffect(() => {
    const getVersion = async () => {
      const version = await DeviceInfo.getVersion();
      const buildNumber = await DeviceInfo.getBuildNumber();
      setAppVersion(`${version} (${buildNumber})`);
    };
    
    getVersion();
  }, []);
  
  // 监听离线存储服务状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (['connectionChange', 'offlineModeChange'].includes(event.type)) {
        setOfflineStatus(offlineStorageService.getStatus());
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  // 更新设置
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    dispatch(updateSettings(newSettings));
    
    // 特殊处理主题
    if (key === 'theme') {
      setTheme(value);
    }
    
    // 特殊处理离线模式
    if (key === 'offlineMode') {
      offlineStorageService.setOfflineMode(value);
    }
  };
  
  // 处理重置设置
  const handleResetSettings = () => {
    Alert.alert(
      '重置设置',
      '确定要将所有设置恢复为默认值吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '重置',
          onPress: () => {
            dispatch(updateSettings(DEFAULT_SETTINGS));
            setTheme(DEFAULT_SETTINGS.theme);
            offlineStorageService.setOfflineMode(DEFAULT_SETTINGS.offlineMode);
          },
          style: 'destructive',
        },
      ]
    );
  };
  
  // 渲染设置项
  const renderSettingItem = ({ icon, title, description, onPress, value, type = 'navigate' }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={type === 'switch'}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primary + '20' }]}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      
      <View style={styles.settingInfo}>
        <Text
          variant="body"
          size="medium"
          bold
        >
          {title}
        </Text>
        
        {description && (
          <Text
            variant="caption"
            color="hint"
          >
            {description}
          </Text>
        )}
      </View>
      
      {type === 'navigate' && (
        <Icon name="chevron-right" size={24} color={colors.text} />
      )}
      
      {type === 'switch' && (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={value ? colors.primary : colors.card}
        />
      )}
      
      {type === 'value' && (
        <Text
          variant="body"
          size="small"
          color="hint"
        >
          {value}
        </Text>
      )}
    </TouchableOpacity>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 账户设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            账户
          </Text>
          
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {user ? (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={() => navigation.navigate('Profile')}
              >
                <View style={styles.profileInfo}>
                  <Text
                    variant="heading"
                    level="h6"
                  >
                    {user.username || '未设置用户名'}
                  </Text>
                  <Text
                    variant="caption"
                    color="hint"
                  >
                    {user.email || '未设置邮箱'}
                  </Text>
                </View>
                
                <Icon name="chevron-right" size={24} color={colors.text} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={() => navigation.navigate('Login')}
              >
                <View style={styles.profileInfo}>
                  <Text
                    variant="heading"
                    level="h6"
                  >
                    未登录
                  </Text>
                  <Text
                    variant="caption"
                    color="hint"
                  >
                    点击登录或注册
                  </Text>
                </View>
                
                <Icon name="chevron-right" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* 外观设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            外观
          </Text>
          
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'palette',
              title: '主题',
              description: settings.theme === 'light' ? '浅色' : 
                          settings.theme === 'dark' ? '深色' : '跟随系统',
              onPress: () => navigation.navigate('ThemeSettings'),
              type: 'navigate',
            })}
            
            {renderSettingItem({
              icon: 'format-size',
              title: '字体大小',
              description: settings.fontSize === 'small' ? '小' : 
                          settings.fontSize === 'medium' ? '中' : '大',
              onPress: () => navigation.navigate('FontSettings'),
              type: 'navigate',
            })}
          </View>
        </View>
        
        {/* 数据设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            数据
          </Text>
          
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'cloud-off',
              title: '离线模式',
              description: settings.offlineMode ? '已启用' : '已禁用',
              onPress: () => navigation.navigate('OfflineData'),
              type: 'navigate',
            })}
            
            {renderSettingItem({
              icon: 'save',
              title: '自动保存',
              description: '编辑笔记时自动保存',
              onPress: (value) => updateSetting('autoSave', value),
              value: settings.autoSave,
              type: 'switch',
            })}
            
            {renderSettingItem({
              icon: 'backup',
              title: '备份与恢复',
              description: '管理笔记备份',
              onPress: () => navigation.navigate('BackupRestore'),
              type: 'navigate',
            })}
          </View>
        </View>
        
        {/* 通知设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            通知
          </Text>
          
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'notifications',
              title: '通知',
              description: settings.notificationEnabled ? '已启用' : '已禁用',
              onPress: () => navigation.navigate('NotificationSettings'),
              type: 'navigate',
            })}
          </View>
        </View>
        
        {/* 关于 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            关于
          </Text>
          
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'info',
              title: '关于零屿笔记',
              onPress: () => navigation.navigate('About'),
              type: 'navigate',
            })}
            
            {renderSettingItem({
              icon: 'help',
              title: '帮助与反馈',
              onPress: () => navigation.navigate('Help'),
              type: 'navigate',
            })}
            
            {renderSettingItem({
              icon: 'new-releases',
              title: '版本',
              value: appVersion,
              onPress: () => {},
              type: 'value',
            })}
          </View>
        </View>
        
        {/* 重置设置 */}
        <TouchableOpacity
          style={[styles.resetButton, { backgroundColor: colors.error + '20' }]}
          onPress={handleResetSettings}
        >
          <Icon name="restore" size={20} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            color="error"
            style={styles.resetButtonText}
          >
            重置所有设置
          </Text>
        </TouchableOpacity>
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 8,
  },
  sectionContent: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileInfo: {
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  resetButtonText: {
    marginLeft: 8,
  },
});

export default SettingsScreen;
