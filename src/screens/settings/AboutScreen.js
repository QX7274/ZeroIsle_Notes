/**
 * 关于屏幕
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DeviceInfo from 'react-native-device-info';
import { APP_VERSION } from '../../utils/constants/config';

const AboutScreen = () => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 本地状态
  const [appInfo, setAppInfo] = useState({
    version: APP_VERSION,
    buildNumber: '',
    deviceId: '',
  });

  // 获取应用信息
  useEffect(() => {
    const getAppInfo = async () => {
      try {
        const version = await DeviceInfo.getVersion();
        const buildNumber = await DeviceInfo.getBuildNumber();
        const deviceId = await DeviceInfo.getUniqueId();

        setAppInfo({
          version,
          buildNumber,
          deviceId,
        });
      } catch (error) {
        console.error('获取应用信息失败:', error);
      }
    };

    getAppInfo();
  }, []);

  // 打开链接
  const openLink = (url) => {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.error('无法打开链接:', url);
      }
    });
  };

  // 渲染链接项
  const renderLinkItem = ({ icon, title, url }) => (
    <TouchableOpacity
      style={[styles.linkItem, { backgroundColor: colors.card }]}
      onPress={() => openLink(url)}
    >
      <Icon name={icon} size={24} color={colors.primary} />
      <Text
        variant="body"
        size="medium"
        style={styles.linkTitle}
      >
        {title}
      </Text>
      <Icon name="open-in-new" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 应用信息 */}
        <View style={styles.appInfoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />

          <Text
            variant="heading"
            level="h5"
            center
            style={styles.appName}
          >
            零屿笔记
          </Text>

          <Text
            variant="body"
            size="medium"
            color="hint"
            center
          >
            版本 {appInfo.version} ({appInfo.buildNumber})
          </Text>

          <Text
            variant="caption"
            color="hint"
            center
            style={styles.copyright}
          >
            © 2025 零屿笔记团队. 保留所有权利.
          </Text>
        </View>

        {/* 应用描述 */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text
            variant="body"
            size="medium"
            style={styles.description}
          >
            零屿笔记是一款功能强大的笔记应用，集成了知识图谱、手写识别、语音识别等多种智能功能，帮助您更高效地记录和管理知识。
          </Text>
        </View>

        {/* 链接 */}
        <View style={styles.linksContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            相关链接
          </Text>

          {renderLinkItem({
            icon: 'language',
            title: '官方网站',
            url: 'https://zeroislenotes.com',
          })}

          {renderLinkItem({
            icon: 'help',
            title: '帮助中心',
            url: 'https://zeroislenotes.com/help',
          })}

          {renderLinkItem({
            icon: 'policy',
            title: '隐私政策',
            url: 'https://zeroislenotes.com/privacy',
          })}

          {renderLinkItem({
            icon: 'description',
            title: '用户协议',
            url: 'https://zeroislenotes.com/terms',
          })}
        </View>

        {/* 开发者信息 */}
        <View style={styles.developerContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            开发者信息
          </Text>

          <View style={[styles.developerCard, { backgroundColor: colors.card }]}>
            <Text
              variant="body"
              size="medium"
              bold
            >
              零屿笔记团队
            </Text>

            <Text
              variant="body"
              size="small"
              color="hint"
              style={styles.developerInfo}
            >
              邮箱: contact@zeroislenotes.com
            </Text>

            <Text
              variant="body"
              size="small"
              color="hint"
              style={styles.developerInfo}
            >
              地址: 中国
            </Text>
          </View>
        </View>

        {/* 技术信息 */}
        <View style={styles.techInfoContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            技术信息
          </Text>

          <View style={[styles.techInfoCard, { backgroundColor: colors.card }]}>
            <View style={styles.techInfoItem}>
              <Text
                variant="body"
                size="small"
                color="hint"
              >
                设备ID:
              </Text>
              <Text
                variant="body"
                size="small"
              >
                {appInfo.deviceId}
              </Text>
            </View>

            <View style={styles.techInfoItem}>
              <Text
                variant="body"
                size="small"
                color="hint"
              >
                React Native 版本:
              </Text>
              <Text
                variant="body"
                size="small"
              >
                0.71.8
              </Text>
            </View>

            <View style={styles.techInfoItem}>
              <Text
                variant="body"
                size="small"
                color="hint"
              >
                数据库版本:
              </Text>
              <Text
                variant="body"
                size="small"
              >
                1.0.0
              </Text>
            </View>
          </View>
        </View>

        {/* 致谢 */}
        <View style={styles.acknowledgementsContainer}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            致谢
          </Text>

          <View style={[styles.acknowledgementsCard, { backgroundColor: colors.card }]}>
            <Text
              variant="body"
              size="small"
              style={styles.acknowledgementsText}
            >
              感谢所有为零屿笔记做出贡献的开发者和用户。
            </Text>

            <Text
              variant="body"
              size="small"
              style={styles.acknowledgementsText}
            >
              本应用使用了多个开源项目，包括但不限于 React Native、Redux、React Navigation 等。
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
    padding: 16,
  },
  appInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appIcon: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appName: {
    marginBottom: 8,
  },
  copyright: {
    marginTop: 8,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  description: {
    lineHeight: 22,
  },
  sectionTitle: {
    marginBottom: 12,
    marginLeft: 8,
  },
  linksContainer: {
    marginBottom: 24,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  linkTitle: {
    flex: 1,
    marginLeft: 16,
  },
  developerContainer: {
    marginBottom: 24,
  },
  developerCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  developerInfo: {
    marginTop: 8,
  },
  techInfoContainer: {
    marginBottom: 24,
  },
  techInfoCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  techInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  acknowledgementsContainer: {
    marginBottom: 32,
  },
  acknowledgementsCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  acknowledgementsText: {
    marginBottom: 8,
  },
});

export default AboutScreen;
