/**
 * Terms of Service Screen
 * Displays the application's Terms of Service.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

const TermsOfServiceScreen = () => {
  const { theme } = useTheme();

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
  });

  return (
    <View style={styles.container} testID="state.settings.terms.state.ready">
      <View testID="state.settings.terms.visibility.visible" />
      <View testID="state.settings.terms.sections.count.8" />
      <ScrollView contentContainerStyle={styles.scrollContent} testID="list.settings.terms.sections">
        <Text style={styles.title} testID="state.settings.terms.title">服务条款</Text>
        <Text style={styles.lastUpdated}>最后更新：2026年5月17日</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.1">1. 服务概述</Text>
          <Text style={styles.paragraph}>
            欢迎使用 ZeroIsle Notes。本应用提供笔记创建、编辑、同步与 AI 辅助等功能。
            使用本服务即表示你已阅读并同意以下条款。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.2">2. 账户注册</Text>
          <Text style={styles.paragraph}>
            你需要注册账户以使用完整功能。注册时请提供真实、准确的信息，
            并妥善保管账号凭证，账户下发生的活动将由你负责。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.3">3. 用户内容</Text>
          <Text style={styles.paragraph}>
            你保留对所创建内容的所有权。未经许可，我们不会访问或分享你的私有内容。
            你同意不发布违法、侵权或有害内容。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.4">4. 隐私保护</Text>
          <Text style={styles.paragraph}>
            我们重视你的隐私，具体处理方式请参阅《隐私政策》。
            你可以按规定导出数据或提交账户删除请求。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.5">5. 订阅与付款</Text>
          <Text style={styles.paragraph}>
            部分高级功能需要订阅。订阅默认自动续费，你可在商店或系统设置中随时取消。
            取消后仍可使用至当前计费周期结束。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.6">6. 服务变更</Text>
          <Text style={styles.paragraph}>
            我们可能基于产品迭代对服务进行更新或调整。
            重大变更会提前通知；必要时我们可暂停或终止部分服务。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.7">7. 免责声明</Text>
          <Text style={styles.paragraph}>
            服务按“现状”提供，我们不保证服务始终无中断或无错误。
            在法律允许范围内，我们对间接损失不承担责任。
          </Text>

          <Text style={styles.sectionTitle} testID="entry.settings.terms.section.8">8. 联系我们</Text>
          <Text style={styles.paragraph}>
            如有任何问题，请联系：support@zeroislenotes.com
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default TermsOfServiceScreen;
