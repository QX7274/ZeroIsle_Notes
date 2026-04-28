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
  ToastAndroid,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { Button, Input, Card } from '../../components/common';
import { SPACING, FONT_SIZES } from '../../utils/constants/dimensions';
import { createKnowledgeBaseNode, updateKnowledgeBaseNode } from '../../redux/slices/knowledgeBaseSlice';

const KnowledgeNodeEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const existingNode = route.params?.node;
  const kbId = route.params?.kbId;

  const [title, setTitle] = useState(existingNode?.title || '');
  const [description, setDescription] = useState(existingNode?.description || '');
  const [type, setType] = useState(existingNode?.type || 'note'); // 'note', 'concept', 'document'
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
        {/* TODO: Add a component to select node type (e.g., Segmented Control or Picker) */}
        <Text style={styles.label}>类型: {type}</Text>
      </Card>

      <Button
        title={existingNode ? '更新节点' : '创建节点'}
        onPress={handleSubmit}
        loading={isSubmitting}
        style={styles.submitButton}
      />
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  },
  submitButton: {
    marginTop: SPACING.large,
  },
});

export default KnowledgeNodeEditScreen;

