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
import { useTheme } from '../../context/ThemeContext';
import { useSelector } from 'react-redux';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import { analyticsService } from '../../services/analytics/analyticsService';

const HelpScreen = () => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 从Redux获取用户信息
  const user = useSelector(state => state.auth.user);

  // 本地状�?
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [contactInfo, setContactInfo] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // 常见问题列表
  const faqList = [
    {
      id: 1,
      question: '如何创建笔记？',
      answer: '在主页点击右下角的"+"按钮，选择"新建笔记"，即可创建一个新笔记。您可以使用富文本编辑器编辑笔记内容，支持文本格式化、插入图片、添加链接等功能。',
    },
    {
      id: 2,
      question: '如何使用知识图谱功能？',
      answer: '在主菜单中选择"知识图谱"，您可以创建概念节点并建立它们之间的关系。点击"+"按钮添加新节点，拖动节点之间连线建立关系。您还可以通过点击节点查看详细信息和编辑属性。',
    },
    {
      id: 3,
      question: '如何备份我的笔记？',
      answer: '在设置中选择"备份与恢复"，点击"创建备份"按钮即可创建一个包含所有笔记和设置的备份文件。您可以将备份文件导出到其他应用或云存储服务进行保存。',
    },
    {
      id: 4,
      question: '离线模式下可以使用哪些功能？',
      answer: '在离线模式下，您可以创建和编辑笔记、使用基本的知识图谱功能、查看已缓存的内容等。部分需要网络连接的功能（如同步、社区功能等）在离线模式下不可用。当网络恢复后，应用会自动同步您在离线期间的更改。',
    },
    {
      id: 5,
      question: '如何使用手写识别功能？',
      answer: '在笔记编辑界面，点击工具栏中的"手写"按钮，进入手写模式。在手写区域书写内容后，系统会自动识别并转换为文本。您可以在设置中调整手写识别的灵敏度和识别模式。',
    },
  ];

  // 反馈类型选项
  const feedbackTypes = [
    { value: 'bug', label: '问题反馈', icon: 'bug-report' },
    { value: 'feature', label: '功能建议', icon: 'lightbulb' },
    { value: 'question', label: '使用咨询', icon: 'help' },
    { value: 'other', label: '其他', icon: 'more-horiz' },
  ];

  // 提交反馈
  const submitFeedback = async () => {
    // 验证输入
    if (!feedbackContent.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }

    setIsSubmitting(true);

    try {
      // 这里可以添加实际的反馈提交逻辑
      // 例如：await api.submitFeedback({ type: feedbackType, content: feedbackContent, contactInfo });

      // 模拟提交延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 记录分析事件
      analyticsService.trackEvent('feedback_submitted', {
        type: feedbackType,
        has_contact_info: !!contactInfo,
      });

      // 重置表单
      setFeedbackContent('');

      // 显示成功提示
      Alert.alert('提交成功', '感谢您的反馈，我们会尽快处理');
    } catch (error) {
      console.error('提交反馈失败:', error);
      Alert.alert('提交失败', '请稍后重试');

      // 记录错误
      analyticsService.trackError(error, { operation: 'submit_feedback' });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // 发送邮�?
  const sendEmail = () => {
    const url = 'mailto:support@zeroislenotes.com?subject=零屿笔记使用咨询';
    openLink(url);
  };

  // 切换FAQ展开状�?
  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  // 渲染FAQ�?
  const renderFaqItem = ({ id, question, answer }) => {
    const isExpanded = expandedFaq === id;

    return (
      <TouchableOpacity
        key={id}
        style={[
          styles.faqItem,
          { backgroundColor: colors.card },
          isExpanded && styles.faqItemExpanded,
        ]}
        onPress={() => toggleFaq(id)}
        activeOpacity={0.7}
      >
        <View style={styles.faqQuestion}>
          <Text
            variant="body"
            size="medium"
            bold={isExpanded}
            style={styles.faqQuestionText}
          >
            {question}
          </Text>
          <Icon
            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={24}
            color={colors.text}
          />
        </View>

        {isExpanded && (
          <View style={styles.faqAnswer}>
            <Text
              variant="body"
              size="medium"
              color="text"
            >
              {answer}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 常见问题 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            常见问题
          </Text>

          <View style={styles.faqList}>
            {faqList.map(renderFaqItem)}
          </View>
        </View>

        {/* 联系我们 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            联系我们
          </Text>

          <View style={[styles.contactCard, { backgroundColor: colors.card }]}>
            <Text
              variant="body"
              size="medium"
              style={styles.contactText}
            >
              如果您有任何问题或需要帮助，可以通过以下方式联系我们：
            </Text>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={sendEmail}
            >
              <Icon name="email" size={20} color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                color="primary"
                style={styles.contactItemText}
              >
                support@zeroislenotes.com
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => openLink('https://zeroislenotes.com/help')}
            >
              <Icon name="language" size={20} color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                color="primary"
                style={styles.contactItemText}
              >
                帮助中心
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 反馈表单 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            提交反馈
          </Text>

          <View style={[styles.feedbackCard, { backgroundColor: colors.card }]}>
            {/* 反馈类型 */}
            <Text
              variant="body"
              size="medium"
              bold
              style={styles.feedbackLabel}
            >
              反馈类型
            </Text>

            <View style={styles.feedbackTypes}>
              {feedbackTypes.map(type => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.feedbackTypeButton,
                    {
                      backgroundColor: feedbackType === type.value
                        ? colors.primary
                        : colors.background,
                    },
                  ]}
                  onPress={() => setFeedbackType(type.value)}
                >
                  <Icon
                    name={type.icon}
                    size={20}
                    color={feedbackType === type.value ? '#FFFFFF' : colors.text}
                  />
                  <Text
                    variant="caption"
                    color={feedbackType === type.value ? 'card' : 'text'}
                    style={styles.feedbackTypeText}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 反馈内容 */}
            <Text
              variant="body"
              size="medium"
              bold
              style={styles.feedbackLabel}
            >
              反馈内容
            </Text>

            <TextInput
              style={[
                styles.feedbackInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              placeholder="请详细描述您的问题或建议..."
              placeholderTextColor={colors.textSecondary}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* 联系方式 */}
            <Text
              variant="body"
              size="medium"
              bold
              style={styles.feedbackLabel}
            >
              联系方式 (选填)
            </Text>

            <TextInput
              style={[
                styles.contactInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              placeholder="邮箱或其他联系方式"
              placeholderTextColor={colors.textSecondary}
              value={contactInfo}
              onChangeText={setContactInfo}
            />

            <Text
              variant="caption"
              color="hint"
              style={styles.contactHint}
            >
              提供联系方式有助于我们更好地解决您的问题
            </Text>

            {/* 提交按钮 */}
            <Button
              title="提交反馈"
              onPress={submitFeedback}
              style={styles.submitButton}
              disabled={isSubmitting || !feedbackContent.trim()}
              loading={isSubmitting}
            />
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    marginLeft: 8,
  },
  faqList: {
    marginBottom: 8,
  },
  faqItem: {
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  faqItemExpanded: {
    marginBottom: 16,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    marginRight: 16,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  contactCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  contactText: {
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactItemText: {
    marginLeft: 12,
  },
  feedbackCard: {
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  feedbackLabel: {
    marginBottom: 12,
  },
  feedbackTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  feedbackTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  feedbackTypeText: {
    marginLeft: 4,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    minHeight: 120,
  },
  contactInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  contactHint: {
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 8,
  },
});

export default HelpScreen;

