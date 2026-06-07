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
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DeviceInfo from 'react-native-device-info';
import { APP_VERSION } from '../../utils/constants/config';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { showToast } from '../../components/common/ToastHelper';

const AboutScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const [appInfo, setAppInfo] = useState({
    version: APP_VERSION,
    buildNumber: '',
    deviceId: '',
  });
  const [infoLoadError, setInfoLoadError] = useState('');
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    primaryText: '知道了',
  });

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
        setInfoLoadError(error?.message || 'load-failed');
      }
    };

    getAppInfo();
  }, []);

  const closeDialog = () => {
    setDialogState((current) => ({
      ...current,
      visible: false,
    }));
  };

  const openDialog = ({ title, message, primaryText = '知道了' }) => {
    setDialogState({
      visible: true,
      title,
      message,
      primaryText,
    });
  };

  const openLink = async (url) => {
    if (url.startsWith('https://zeroislenotes.com')) {
      openDialog({
        title: '官网内容暂未上线',
        message: '当前生产域名尚未部署，官网、帮助中心、隐私政策与用户协议网页暂时无法访问。后续域名部署完成后，这些入口会恢复可用。',
      });
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error('unsupported-link');
      }

      await Linking.openURL(url);
    } catch (error) {
      console.warn('无法打开链接:', url, error?.message || error);
      showToast.error('当前链接暂时无法打开，请稍后重试');
    }
  };

  const infoReady = Boolean(appInfo.version && appInfo.buildNumber && appInfo.deviceId);
  const pageState = infoReady ? 'ready' : (infoLoadError ? 'error' : 'loading');

  const renderLinkItem = ({ icon, title, url }) => (
    <TouchableOpacity
      style={[styles.linkItem, { backgroundColor: colors.card }]}
      onPress={() => openLink(url)}
      testID={`action.settings.about.link.${title}`}
    >
      <Icon name={icon} size={24} color={colors.primary} />
      <Text style={styles.linkTitle}>{title}</Text>
      <Icon name="open-in-new" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F6FAFF' }]} testID={`state.settings.about.state.${pageState}`}>
      <View testID={`state.settings.about.info.visibility.${infoReady ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.about.error.visibility.${infoLoadError ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.about.linkDialog.visibility.${dialogState.visible ? 'visible' : 'hidden'}`} />
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, { backgroundColor: colors.card }]}>
        <ScreenHeaderBackButton
          onPress={() => navigation?.goBack?.()}
          testID="action.settings.about.back"
          style={styles.backButton}
        />
        <Text style={[styles.pageTitle, { color: colors.text }]}>关于</Text>
      </View>
      <ScrollView style={styles.content} testID="list.settings.about.sections">
        <View style={styles.appInfoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />

          <Text style={[styles.appName, { color: colors.text }]}>零屿笔记</Text>

          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            版本 {appInfo.version} ({appInfo.buildNumber})
          </Text>

          <Text style={[styles.copyright, { color: colors.textSecondary }]}>
            © 2025 零屿笔记团队. 保留所有权利
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.description, { color: colors.text }]}>
            零屿笔记是一款功能强大的笔记应用，集成了知识图谱、手写识别、语音识别等多种智能功能，帮助您更高效地记录和管理知识。
          </Text>
        </View>

        <View style={styles.linksContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>相关链接</Text>

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

        <View style={styles.developerContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>开发者信息</Text>

          <View style={[styles.developerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.developerName, { color: colors.text }]}>零屿笔记团队</Text>

            <Text style={[styles.developerInfo, { color: colors.textSecondary }]}>
              邮箱: contact@zeroislenotes.com
            </Text>

            <Text style={[styles.developerInfo, { color: colors.textSecondary }]}>
              地址: 中国
            </Text>
          </View>
        </View>

        <View style={styles.techInfoContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>技术信息</Text>

          <View style={[styles.techInfoCard, { backgroundColor: colors.card }]}>
            <View style={styles.techInfoItem}>
              <Text style={[styles.techLabel, { color: colors.textSecondary }]}>设备ID:</Text>
              <Text style={[styles.techValue, { color: colors.text }]}>{appInfo.deviceId}</Text>
            </View>

            <View style={styles.techInfoItem}>
              <Text style={[styles.techLabel, { color: colors.textSecondary }]}>React Native 版本:</Text>
              <Text style={[styles.techValue, { color: colors.text }]}>0.71.8</Text>
            </View>

            <View style={styles.techInfoItem}>
              <Text style={[styles.techLabel, { color: colors.textSecondary }]}>数据库版本:</Text>
              <Text style={[styles.techValue, { color: colors.text }]}>1.0.0</Text>
            </View>
          </View>
        </View>

        <View style={styles.acknowledgementsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>致谢</Text>

          <View style={[styles.acknowledgementsCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.acknowledgementsText, { color: colors.text }]}>
              感谢所有为零屿笔记做出贡献的开发者和用户。
            </Text>

            <Text style={[styles.acknowledgementsText, { color: colors.text }]}>
              本应用使用了多个开源项目，包括但不限于 React Native、Redux、React Navigation 等。
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={dialogState.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}>
              <Icon name="info-outline" size={28} color="#1D4ED8" />
            </View>
            <Text style={styles.dialogTitle}>{dialogState.title}</Text>
            <Text style={styles.dialogMessage}>{dialogState.message}</Text>
            <View style={styles.dialogButtonRow}>
              <TouchableOpacity
                style={styles.dialogPrimaryButton}
                onPress={closeDialog}
                testID="action.settings.about.linkDialog.close"
              >
                <Text style={styles.dialogPrimaryText}>{dialogState.primaryText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const cardCommon = {
  borderRadius: 14,
  elevation: 2,
  shadowColor: '#4C8DFF',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  borderWidth: 1,
  borderColor: '#CFE1FF',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 24,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 15,
  },
  copyright: {
    marginTop: 8,
    fontSize: 13,
  },
  section: {
    padding: 16,
    marginBottom: 24,
    ...cardCommon,
  },
  description: {
    lineHeight: 22,
    fontSize: 15,
  },
  sectionTitle: {
    marginBottom: 12,
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
  },
  linksContainer: {
    marginBottom: 24,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    ...cardCommon,
  },
  linkTitle: {
    flex: 1,
    marginLeft: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  developerContainer: {
    marginBottom: 24,
  },
  developerCard: {
    padding: 16,
    ...cardCommon,
  },
  developerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  developerInfo: {
    marginTop: 8,
    fontSize: 14,
  },
  techInfoContainer: {
    marginBottom: 24,
  },
  techInfoCard: {
    padding: 16,
    ...cardCommon,
  },
  techInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  techLabel: {
    fontSize: 13,
  },
  techValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
  },
  acknowledgementsContainer: {
    marginBottom: 32,
  },
  acknowledgementsCard: {
    padding: 16,
    ...cardCommon,
  },
  acknowledgementsText: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4B8CFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  dialogIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(29,78,216,0.10)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102A43',
  },
  dialogMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#486581',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  dialogPrimaryButton: {
    minWidth: 110,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#1D4ED8',
  },
  dialogPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default AboutScreen;

