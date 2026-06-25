/**
 * 知识库节点编辑屏幕
 * @description 提供创建和编辑知识库节点（笔记、概念、文档等）的表单界面。
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Button, Input, Card } from '../../components/common';
import { SPACING, FONT_SIZES } from '../../utils/constants/dimensions';
import { createKnowledgeBaseNode, updateKnowledgeBaseNode } from '../../redux/slices/knowledgeBaseSlice';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const TYPE_OPTIONS = [
  { value: 'note', label: '笔记' },
  { value: 'concept', label: '概念' },
  { value: 'document', label: '文档' },
];

const KnowledgeNodeEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

  const existingNode = route?.params?.node;
  const kbId = route?.params?.kbId;

  const [title, setTitle] = useState(existingNode?.title || '');
  const [description, setDescription] = useState(existingNode?.description || '');
  const [type, setType] = useState(existingNode?.type || 'note');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineHint, setInlineHint] = useState('');

  const notifyNonBlocking = (message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      title: existingNode ? '编辑节点' : '创建新节点',
    });
  }, [navigation, existingNode]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      notifyNonBlocking('标题不能为空');
      return;
    }

    setIsSubmitting(true);
    const nodeData = { title, description, type };

    try {
      if (existingNode) {
        await dispatch(updateKnowledgeBaseNode({ kbId, nodeId: existingNode.id, nodeData })).unwrap();
      } else {
        await dispatch(createKnowledgeBaseNode({ kbId, nodeData })).unwrap();
      }
      notifyNonBlocking(`节点已${existingNode ? '更新' : '创建'}`);
      navigation.goBack();
    } catch (error) {
      notifyNonBlocking(error.message || '操作失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setNoteType = () => setType('note');
  const setConceptType = () => setType('concept');
  const setDocumentType = () => setType('document');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.pageHeaderTopRow}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.knowledgeNodeEdit.back"
            style={styles.backButton}
          />
          <Text style={styles.pageTitle}>{existingNode ? '编辑节点' : '创建新节点'}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
        {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
        <Card style={styles.card}>
        <Input
          label="标题"
          value={title}
          onChangeText={setTitle}
          placeholder="输入节点的标题"
          returnKeyType="next"
        />
        <Input
          label="描述"
          value={description}
          onChangeText={setDescription}
          placeholder="输入节点的简要描述（可选）"
          multiline
          numberOfLines={4}
          style={styles.descriptionInput}
        />
        <Text style={styles.label}>类型</Text>
        <View style={styles.typeSelector}>
          {TYPE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.typeOption,
                type === option.value && styles.typeOptionActive,
                index === TYPE_OPTIONS.length - 1 ? styles.typeOptionLast : null,
              ]}
              onPress={
                option.value === 'note'
                  ? setNoteType
                  : option.value === 'concept'
                    ? setConceptType
                    : setDocumentType
              }
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  type === option.value && styles.typeOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        </Card>

        <Button
          title={existingNode ? '更新节点' : '创建节点'}
          onPress={handleSubmit}
          loading={isSubmitting}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: SPACING.medium,
    paddingBottom: SPACING.medium,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: SPACING.small,
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.large,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.medium,
  },
  hintText: {
    marginBottom: SPACING.small,
    color: theme.colors.warning || '#ff9800',
    fontSize: FONT_SIZES.small,
  },
  card: {
    padding: SPACING.medium,
  },
  descriptionInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginTop: SPACING.medium,
    marginBottom: SPACING.small,
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  typeOption: {
    flex: 1,
    paddingVertical: SPACING.small,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  typeOptionLast: {
    borderRightWidth: 0,
  },
  typeOptionActive: {
    backgroundColor: theme.colors.primary + '22',
  },
  typeOptionText: {
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  typeOptionTextActive: {
    color: theme.colors.primary,
  },
  submitButton: {
    marginTop: SPACING.large,
  },
});

export default KnowledgeNodeEditScreen;
