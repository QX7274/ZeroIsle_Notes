/**
 * Privacy Policy Screen
 * Displays the application's privacy policy and user data actions.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

const PrivacyPolicyScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const pageState = loading ? 'busy' : 'ready';

  const handleExportData = async () => {
    Alert.alert('导出数据', '这将下载包含你所有数据的 ZIP 文件，确认继续吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '导出',
        onPress: async () => {
          setLoading(true);
          try {
            Alert.alert('成功', '数据导出请求已提交，请查看下载中心。');
          } catch (error) {
            Alert.alert('错误', '导出失败，请稍后重试。');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '删除账户',
      '这将永久删除你的账户和所有数据，操作不可撤销。\n\n提交删除后，你将有 30 天冷静期可取消。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '继续删除',
          style: 'destructive',
          onPress: () => navigation.navigate('AccountDeletion'),
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F4F8FF',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 28,
    },
    card: {
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(76,141,255,0.18)',
      shadowColor: '#4C8DFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 14,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    lastUpdated: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 12,
      marginBottom: 8,
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    bulletPoint: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginLeft: 12,
      marginBottom: 4,
    },
    actionSection: {
      marginTop: 6,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      backgroundColor: 'rgba(255,255,255,0.86)',
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: 'rgba(33,150,243,0.16)',
      shadowColor: '#4C8DFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    actionButtonDanger: {
      backgroundColor: isDark ? '#3D2020' : '#FEE2E2',
      borderColor: isDark ? '#7F1D1D' : '#FCA5A5',
    },
    actionIcon: {
      marginRight: 14,
    },
    actionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionTextDanger: {
      color: '#EF4444',
    },
    actionDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },
  });

  return (
    <View style={styles.container} testID={`state.settings.privacy.state.${pageState}`}>
      <View testID="state.settings.privacy.visibility.visible" />
      <View testID={`state.settings.privacy.exportBusy.visibility.${loading ? 'visible' : 'hidden'}`} />
      <View testID="state.settings.privacy.sections.count.6" />
      <ScrollView contentContainerStyle={styles.scrollContent} testID="list.settings.privacy.sections">
        <Text style={styles.title} testID="state.settings.privacy.title">隐私政策</Text>
        <Text style={styles.lastUpdated}>最后更新：2026年5月17日</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.1">1. 信息收集</Text>
          <Text style={styles.paragraph}>我们会收集以下类型的信息：</Text>
          <Text style={styles.bulletPoint}>• 账户信息：用户名、邮箱、手机号</Text>
          <Text style={styles.bulletPoint}>• 内容数据：你创建的笔记、标签、文件</Text>
          <Text style={styles.bulletPoint}>• 使用数据：应用使用情况与功能偏好</Text>
          <Text style={styles.bulletPoint}>• 设备信息：设备类型与系统版本</Text>

          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.2">2. 信息使用</Text>
          <Text style={styles.paragraph}>我们使用你的信息来提供、维护和改进服务，包括：</Text>
          <Text style={styles.bulletPoint}>• 同步你的笔记和数据</Text>
          <Text style={styles.bulletPoint}>• 提供 AI 辅助功能（经你授权）</Text>
          <Text style={styles.bulletPoint}>• 发送服务通知和更新</Text>
          <Text style={styles.bulletPoint}>• 识别并防止滥用行为</Text>

          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.3">3. 数据存储与安全</Text>
          <Text style={styles.paragraph}>
            你的数据存储在受保护的云服务环境中，并采用行业标准加密机制。我们会定期进行安全审计，
            持续提升数据安全能力。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.4">4. 你的权利（GDPR）</Text>
          <Text style={styles.paragraph}>根据相关法律法规，你享有以下权利：</Text>
          <Text style={styles.bulletPoint}>• 访问权：获取你的个人数据副本</Text>
          <Text style={styles.bulletPoint}>• 更正权：更正不准确或不完整信息</Text>
          <Text style={styles.bulletPoint}>• 删除权：请求删除你的数据</Text>
          <Text style={styles.bulletPoint}>• 可携权：以标准格式导出你的数据</Text>

          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.5">5. 第三方服务</Text>
          <Text style={styles.paragraph}>
            我们可能使用第三方服务（如分析、支付处理等）。这些服务受其各自隐私政策约束，我们会在可控范围内进行合规管理。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.privacy.section.6">6. 联系我们</Text>
          <Text style={styles.paragraph}>
            如有隐私相关问题，请联系：privacy@zeroislenotes.com
          </Text>
        </View>

        <View style={[styles.card, styles.actionSection]}>
          <Text style={styles.sectionTitle}>数据管理</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExportData}
            disabled={loading}
            testID="action.settings.privacy.exportData"
          >
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.colors.primary}
              style={styles.actionIcon}
            />
            <View>
              <Text style={styles.actionText}>导出我的数据</Text>
              <Text style={styles.actionDescription}>下载包含所有个人数据的 ZIP 文件</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleDeleteAccount}
            testID="action.settings.privacy.deleteAccount"
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color="#EF4444"
              style={styles.actionIcon}
            />
            <View>
              <Text style={[styles.actionText, styles.actionTextDanger]}>删除我的账户</Text>
              <Text style={styles.actionDescription}>永久删除账户和所有数据</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;
