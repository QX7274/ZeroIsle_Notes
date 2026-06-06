/**
 * 帮助与反馈屏幕
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import { analyticsService } from '../../services/analytics/analyticsService';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { showToast } from '../../components/common/ToastHelper';

const FAQ_LIST = [
  {
    id: 1,
    question: '如何创建笔记？',
    answer:
      '在首页点击右下角“+”按钮，选择“新建笔记”即可创建。编辑器支持格式化、插图和链接。',
  },
  {
    id: 2,
    question: '如何使用知识图谱功能？',
    answer:
      '进入“知识图谱”后可新增节点并建立关系。点击“+”创建节点，拖拽连线创建关系，点节点查看详情。',
  },
  {
    id: 3,
    question: '如何备份我的数据？',
    answer:
      '在设置中进入“备份与恢复”，点击“创建备份”即可生成包含笔记和配置的备份文件，并可导出保存。',
  },
  {
    id: 4,
    question: '离线模式支持哪些能力？',
    answer:
      '离线状态下可新建与编辑笔记、使用基础知识图谱、查看已缓存内容。联网后会自动同步离线期间变更。',
  },
  {
    id: 5,
    question: '如何使用手写识别功能？',
    answer:
      '在笔记编辑页点击“手写”进入手写模式，书写后系统会自动识别并转为文本。可在设置中调整识别参数。',
  },
];

const FEEDBACK_TYPES = [
  { value: 'bug', label: '问题反馈', icon: 'bug-report' },
  { value: 'feature', label: '功能建议', icon: 'lightbulb' },
  { value: 'question', label: '使用咨询', icon: 'help' },
  { value: 'other', label: '其他', icon: 'more-horiz' },
];

const HelpScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const user = useSelector((state) => state.auth.user);

  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [contactInfo, setContactInfo] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const pageState = isSubmitting ? 'busy' : 'ready';
  const canSubmit = Boolean(feedbackContent.trim()) && !isSubmitting;

  const submitFeedback = async () => {
    if (!feedbackContent.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      analyticsService.trackEvent('feedback_submitted', {
        type: feedbackType,
        has_contact_info: Boolean(contactInfo),
      });

      setFeedbackContent('');
      Alert.alert('提交成功', '感谢你的反馈，我们会尽快处理');
    } catch (error) {
      console.error('提交反馈失败:', error);
      Alert.alert('提交失败', '请稍后重试');
      analyticsService.trackError(error, { operation: 'submit_feedback' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openLink = async (url) => {
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

  const sendEmail = () => {
    openLink('mailto:support@zeroislenotes.com?subject=ZeroIsle%20Notes%20支持咨询');
  };

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const glassCard = {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderColor: '#CEE3FF',
  };

  return (
    <SafeAreaView style={styles.container} testID={`state.settings.help.state.${pageState}`}>
      <View testID="state.settings.help.visibility.visible" />
      <View testID={`state.settings.help.submit.visibility.${isSubmitting ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.help.submit.enabled.${canSubmit ? 'yes' : 'no'}`} />
      <View testID={`state.settings.help.faqExpanded.visibility.${expandedFaq ? 'visible' : 'hidden'}`} />

      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 12) }, styles.glassCard]}>
        <ScreenHeaderBackButton
          onPress={() => navigation?.goBack?.()}
          testID="action.settings.help.back"
          style={styles.backButton}
        />
        <Text style={[styles.pageTitle, { color: colors.text }]}>帮助与反馈</Text>
      </View>

      <ScrollView style={styles.content} testID="list.settings.help.sections">
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>常见问题</Text>
          {FAQ_LIST.map((item) => {
            const isExpanded = expandedFaq === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, glassCard, isExpanded && styles.cardExpanded]}
                onPress={() => toggleFaq(item.id)}
                activeOpacity={0.86}
                testID={`entry.settings.help.faq.${item.id}`}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.questionText, { color: colors.text }]}>
                    {item.question}
                  </Text>
                  <Icon
                    name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={24}
                    color={colors.text}
                  />
                </View>
                {isExpanded ? (
                  <Text style={[styles.answerText, { color: colors.textSecondary || colors.text }]}>
                    {item.answer}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>联系我们</Text>
          <View style={[styles.card, glassCard]}>
            <Text style={[styles.bodyText, { color: colors.textSecondary || colors.text }]}>
              如果你在使用中遇到问题，欢迎通过以下方式联系我们：
            </Text>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={sendEmail}
              testID="action.settings.help.contactEmail"
            >
              <Icon name="email" size={20} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>
                support@zeroislenotes.com
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => openLink('https://zeroislenotes.com/help')}
              testID="action.settings.help.openHelpCenter"
            >
              <Icon name="language" size={20} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.primary }]}>帮助中心</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>提交反馈</Text>
          <View style={[styles.card, glassCard]}>
            <Text style={[styles.label, { color: colors.text }]}>反馈类型</Text>
            <View style={styles.typeWrap}>
              {FEEDBACK_TYPES.map((type) => {
                const selected = feedbackType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: selected ? '#1D4ED8' : 'rgba(255,255,255,0.92)',
                        borderColor: selected ? '#1D4ED8' : '#BDD7FF',
                      },
                    ]}
                    onPress={() => setFeedbackType(type.value)}
                    testID={`action.settings.help.feedbackType.${type.value}`}
                  >
                    <Icon name={type.icon} size={18} color={selected ? '#FFFFFF' : colors.text} />
                    <Text
                      style={[
                        styles.typeText,
                        { color: selected ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>反馈内容</Text>
            <TextInput
              style={[styles.input, styles.multiInput, { color: colors.text }]}
              placeholder="请详细描述你遇到的问题或建议..."
              placeholderTextColor={colors.textSecondary}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              testID="input.settings.help.feedbackContent"
            />

            <Text style={[styles.label, { color: colors.text }]}>联系方式（选填）</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="邮箱或其他联系方式"
              placeholderTextColor={colors.textSecondary}
              value={contactInfo}
              onChangeText={setContactInfo}
              testID="input.settings.help.contactInfo"
            />
            <Text style={[styles.hint, { color: colors.textSecondary || colors.text }]}>
              提供联系方式有助于我们更快跟进你的问题。
            </Text>

            <Button
              title="提交反馈"
              onPress={submitFeedback}
              disabled={!canSubmit}
              loading={isSubmitting}
              style={styles.submitButton}
              testID="action.settings.help.submitFeedback"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
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
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
    marginLeft: 6,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#4B8CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  cardExpanded: {
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionText: {
    flex: 1,
    marginRight: 12,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  answerText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  bodyText: {
    lineHeight: 22,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  label: {
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
  },
  typeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  typeText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#BDD7FF',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  multiInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  submitButton: {
    marginTop: 4,
  },
});

export default HelpScreen;
