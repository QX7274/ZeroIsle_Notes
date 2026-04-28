/**
 * 知识库创建/编辑屏幕
 * @description 用于创建新知识库或编辑现有知识库的基本信息。
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { createKnowledgeBase, updateKnowledgeBase } from '../../redux/slices/knowledgeBaseSlice';
import { Button, Card } from '../../components/common';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';

const ICON_OPTIONS = [
  { name: 'work', label: '工作' },
  { name: 'school', label: '学习' },
  { name: 'group', label: '团队' },
  { name: 'lightbulb', label: '创意' },
  { name: 'code', label: '代码' },
  { name: 'science', label: '科学' },
];

const COLOR_OPTIONS = [
  '#4A90E2',
  '#50E3C2',
  '#F5A623',
  '#E74C3C',
  '#9B59B6',
  '#1ABC9C',
];

const KnowledgeBaseEditScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const dispatch = useDispatch();

  const { currentKnowledgeBase, status, error } = useSelector((state) => state.knowledgeBase);

  const kbId = route.params?.kbId;
  const isEditMode = !!kbId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('work');
  const [selectedColor, setSelectedColor] = useState('#4A90E2');
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
    if (isEditMode && currentKnowledgeBase && currentKnowledgeBase.id === kbId) {
      setName(currentKnowledgeBase.name);
      setDescription(currentKnowledgeBase.description);
      setSelectedIcon(currentKnowledgeBase.icon || 'work');
      setSelectedColor(currentKnowledgeBase.color || '#4A90E2');
    }
  }, [isEditMode, currentKnowledgeBase, kbId]);

  useEffect(() => {
    if (isEditMode) {
      // TODO: 加载现有知识库数据
      navigation.setOptions({ title: '编辑知识库' });
    } else {
      navigation.setOptions({ title: '创建知识库' });
    }
  }, [isEditMode, navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifyNonBlocking('请输入知识库名称');
      return;
    }

    const kbData = {
      name: name.trim(),
      description: description.trim(),
      icon: selectedIcon,
      color: selectedColor,
    };

    try {
      if (isEditMode) {
        await dispatch(updateKnowledgeBase({ id: kbId, ...kbData })).unwrap();
        notifyNonBlocking('知识库已更新');
      } else {
        await dispatch(createKnowledgeBase(kbData)).unwrap();
        notifyNonBlocking('知识库已创建');
      }
      navigation.goBack();
    } catch (err) {
      notifyNonBlocking(err.message || '保存失败，请重试');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      <Card style={styles.card}>
        <Text style={styles.label}>知识库名称 *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：我的项目知识库"
          placeholderTextColor={theme.colors.textSecondary}
        />

        <Text style={styles.label}>描述</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="简要描述这个知识库的用途..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>图标</Text>
        <View style={styles.iconGrid}>
          {ICON_OPTIONS.map(icon => (
            <TouchableOpacity
              key={icon.name}
              style={[
                styles.iconOption,
                selectedIcon === icon.name && styles.iconOptionSelected,
              ]}
              onPress={() => setSelectedIcon(icon.name)}
            >
              <Icon name={icon.name} size={28} color={selectedIcon === icon.name ? theme.colors.primary : theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>颜色</Text>
        <View style={styles.colorGrid}>
          {COLOR_OPTIONS.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                selectedColor === color && styles.colorOptionSelected,
              ]}
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor === color && (
                <Icon name="check" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>预览</Text>
        <View style={styles.previewContent}>
          <Icon name={selectedIcon} size={32} color={selectedColor} style={styles.previewIcon} />
          <View style={styles.previewText}>
            <Text style={styles.previewName}>{name || '知识库名称'}</Text>
            <Text style={styles.previewDescription} numberOfLines={2}>
              {description || '知识库描述'}
            </Text>
          </View>
        </View>
      </View>

      <Button
        title={isEditMode ? '保存' : '创建'}
        onPress={handleSave}
        loading={status === 'loading'}
        style={styles.saveButton}
      />
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: SPACING.medium,
  },
  hintText: {
    marginBottom: SPACING.small,
    color: theme.colors.warning || '#ff9800',
    fontSize: FONT_SIZES.small,
  },
  card: {
    padding: SPACING.medium,
    marginBottom: SPACING.medium,
    borderRadius: BORDER_RADIUS.large,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.small,
    marginTop: SPACING.medium,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.medium,
    padding: SPACING.medium,
    fontSize: FONT_SIZES.medium,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.small,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.medium,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.small,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.small,
    marginBottom: SPACING.small,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: theme.colors.text,
  },
  previewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.medium,
    marginBottom: SPACING.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewLabel: {
    fontSize: FONT_SIZES.medium,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.medium,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    marginRight: SPACING.medium,
  },
  previewText: {
    flex: 1,
  },
  previewName: {
    fontSize: FONT_SIZES.large,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: SPACING.extraSmall,
  },
  previewDescription: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  saveButton: {
    marginBottom: SPACING.large,
  },
});

export default KnowledgeBaseEditScreen;

