import React, { useState, useLayoutEffect, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { Text } from '../../components/common/Typography';
import * as Haptics from '../../utils/haptics';
import { createActivity, updateActivity, saveDraft } from '../../redux/slices/personalActivitySlice';
import RichTextEditor from '../../components/personal_activity/RichTextEditor';
import { Card } from '../../components/common';
// Style factory that depends on theme colors
const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  sectionCard: { marginHorizontal: 16, marginTop: 16, padding: 16 },
  sectionTitle: { marginBottom: 16, fontWeight: '600' },
  textInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  // 悬浮发表按钮
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

// Section Component
const FormSection = ({ title, children, styles }) => (
  <Card style={styles.sectionCard}>
    {title && <Text variant="h3" style={styles.sectionTitle}>{title}</Text>}
    {children}
  </Card>
);

const ActivityFormScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useDispatch();
  const { activity } = route.params || {};
  const isEditing = !!activity;

  const [formData, setFormData] = useState({
    content: '',
    images: [],
    content_type: 'activity',
    is_public: true,
  });

  const handlePublish = useCallback(async () => {
    if (!formData.content.trim() && formData.images.length === 0) {
      Alert.alert('缺少内容', '请填写内容或添加图片');
      return;
    }
    try {
      if (isEditing && activity?._id) {
        await dispatch(updateActivity({ id: activity._id, data: formData })).unwrap();
      } else {
        await dispatch(createActivity(formData)).unwrap();
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('发布失败', error.message || '请稍后重试');
    }
  }, [formData, dispatch, navigation, isEditing, activity]);

  const handleSaveDraft = useCallback(async () => {
    if (!formData.content.trim() && formData.images.length === 0) {
      Alert.alert('缺少内容', '草稿不能为空');
      return;
    }
    try {
      await dispatch(saveDraft(formData)).unwrap();
      Alert.alert('已保存', '草稿已保存成功');
      navigation.goBack();
    } catch (error) {
      Alert.alert('保存失败', error.message || '请稍后重试');
    }
  }, [formData, dispatch, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? '编辑动态' : '发布动态',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 16 }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>取消</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleSaveDraft} style={{ marginRight: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>保存</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSaveDraft, isEditing, colors]);

  useEffect(() => {
    if (isEditing && activity) {
      setFormData(prev => ({
        ...prev,
        content: activity.content || '',
        images: activity.images || [],
      }));
    }
  }, [isEditing, activity]);

  const updateForm = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <FormSection title={null} styles={styles}>
            <RichTextEditor
              content={formData.content}
              images={formData.images}
              onContentChange={(content) => updateForm('content', content)}
              onImagesChange={(images) => updateForm('images', images)}
              placeholder="分享新鲜事..."
            />
          </FormSection>
        </ScrollView>

        {/* 悬浮发布按钮 */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={handlePublish} activeOpacity={0.9}>
          <Text style={styles.fabText}>发布</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};



export default ActivityFormScreen;
