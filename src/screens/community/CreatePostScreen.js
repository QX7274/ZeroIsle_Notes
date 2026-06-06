/**
 * 创建社区帖子页面
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import * as Haptics from '../../utils/haptics';
import { createPost } from '../../redux/slices/communitySlice';
import { fetchCategories } from '../../redux/slices/notesSlice';
import { fetchTags, selectAllTags } from '../../redux/slices/tagsSlice';
import useHideMainTabBar from './useHideMainTabBar';

const EMPTY_ARRAY = [];

const CreatePostScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();

  useHideMainTabBar();

  const categories = useSelector((state) => state.notes.categories) ?? EMPTY_ARRAY;
  const availableTags = useSelector(selectAllTags) ?? EMPTY_ARRAY;
  const communityLoading = useSelector((state) => state.community.isLoading);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [isPublic, setIsPublic] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const publishBusy = communityLoading || isSubmitting;
  const pageState = publishBusy ? 'busy' : 'ready';

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchTags());
  }, [dispatch]);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory) {
      return '未选择分类';
    }
    const matched = categories.find((c) => String(c.id) === String(selectedCategory));
    return matched?.name || '未选择分类';
  }, [categories, selectedCategory]);

  const selectedTagsText = useMemo(() => {
    if (selectedTags.length === 0) {
      return '未选择标签';
    }
    const names = selectedTags
      .map((tagId) => availableTags.find((t) => String(t.id) === String(tagId))?.name)
      .filter(Boolean);
    return names.join('、') || '未选择标签';
  }, [availableTags, selectedTags]);

  const getReadableFileSize = (size = 0) => {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName) => {
    if (!fileName) {
      return 'insert-drive-file';
    }
    const extension = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return 'image';
    }
    if (['pdf'].includes(extension)) {
      return 'picture-as-pdf';
    }
    if (['doc', 'docx'].includes(extension)) {
      return 'description';
    }
    if (['xls', 'xlsx'].includes(extension)) {
      return 'table-chart';
    }
    if (['ppt', 'pptx'].includes(extension)) {
      return 'slideshow';
    }
    if (['zip', 'rar', '7z'].includes(extension)) {
      return 'archive';
    }
    return 'insert-drive-file';
  };

  const handleSelectCoverImage = async () => {
    try {
      Haptics.lightFeedback();
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.82,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel) {
        return;
      }
      if (result.errorCode) {
        Alert.alert('选择失败', result.errorMessage || '图片选择失败');
        return;
      }
      const selected = result.assets?.[0];
      if (!selected?.uri) {
        return;
      }

      setCoverImage({
        uri: selected.uri,
        type: selected.type || 'image/jpeg',
        name: selected.fileName || `cover_${Date.now()}.jpg`,
      });
    } catch (error) {
      Alert.alert('选择失败', error?.message || '图片选择失败');
    }
  };

  const handleSelectAttachments = async () => {
    try {
      Haptics.lightFeedback();
      const picked = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
      });
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const valid = picked.filter((file) => (file.size || 0) <= MAX_FILE_SIZE);
      if (valid.length < picked.length) {
        Alert.alert('部分文件未添加', '超过 10MB 的文件已被自动过滤。');
      }
      const normalized = valid.map((file) => ({
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name || `file_${Date.now()}`,
        size: file.size || 0,
      }));
      setAttachments((prev) => [...prev, ...normalized]);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        return;
      }
      Alert.alert('选择失败', error?.message || '附件选择失败');
    }
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleTag = (tagId) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const handlePublishPost = async () => {
    if (publishBusy) {
      return;
    }
    if (!title.trim()) {
      Alert.alert('发布失败', '请输入帖子标题');
      return;
    }
    if (!content.trim()) {
      Alert.alert('发布失败', '请输入帖子内容');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.mediumFeedback();

      const payload = {
        title: title.trim(),
        content: content.trim(),
        excerpt: content.trim().slice(0, 100) + (content.trim().length > 100 ? '...' : ''),
        category_id: selectedCategory || undefined,
        tags: selectedTags,
        is_public: isPublic,
        allow_comments: allowComments,
      };

      if (coverImage) {
        payload.cover_image = coverImage;
      }
      if (attachments.length > 0) {
        payload.attachments = attachments;
      }

      const result = await dispatch(createPost(payload));
      if (createPost.fulfilled.match(result)) {
        Alert.alert('发布成功', '帖子已成功发布');
        navigation.goBack();
      } else {
        Alert.alert('发布失败', result.error?.message || '创建帖子失败，请重试');
      }
    } catch (error) {
      Alert.alert('发布失败', error?.message || '创建帖子失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View testID={`state.community.createPost.state.${pageState}`} />
      <View testID={`state.community.createPost.publishBusy.visibility.${publishBusy ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.createPost.categoryPicker.visibility.${showCategoryPicker ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.createPost.tagPicker.visibility.${showTagPicker ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.createPost.attachments.visibility.${attachments.length > 0 ? 'visible' : 'hidden'}`} />

      <View style={styles.header}>
        <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.backFromCreatePost" style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>创建帖子</Text>
        <TouchableOpacity
          style={[styles.publishButton, { backgroundColor: colors.primary }, publishBusy && styles.disabledButton]}
          onPress={handlePublishPost}
          disabled={publishBusy}
          testID="action.community.publishPost"
        >
          {publishBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.publishText}>发布</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TextInput
          style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
          value={title}
          onChangeText={setTitle}
          placeholder="请输入帖子标题"
          placeholderTextColor={colors.textHint}
          maxLength={100}
          testID="input.community.createPost.title"
        />

        <TouchableOpacity style={[styles.coverImageContainer, { borderColor: colors.border }]} onPress={handleSelectCoverImage} disabled={publishBusy} testID="action.community.selectCoverImage">
          {coverImage ? (
            <Image source={{ uri: coverImage.uri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverImagePlaceholder}>
              <Icon name="image" size={44} color={colors.textHint} />
              <Text style={[styles.coverImageText, { color: colors.textHint }]}>点击添加封面图片</Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={[styles.contentInput, { color: colors.text }]}
          value={content}
          onChangeText={setContent}
          placeholder="请输入帖子内容"
          placeholderTextColor={colors.textHint}
          multiline
          textAlignVertical="top"
          testID="input.community.createPost.content"
        />

        <TouchableOpacity style={[styles.attachButton, { borderColor: colors.border }]} onPress={handleSelectAttachments} disabled={publishBusy} testID="action.community.selectAttachments">
          <Icon name="attach-file" size={22} color={colors.primary} />
          <Text style={[styles.attachButtonText, { color: colors.text }]}>添加附件</Text>
        </TouchableOpacity>

        {attachments.length > 0 ? (
          <View style={styles.attachmentsContainer}>
            <Text style={[styles.attachmentsTitle, { color: colors.text }]}>附件（{attachments.length}）</Text>
            {attachments.map((file, index) => (
              <View key={`${file.name}-${index}`} style={[styles.attachmentItem, { borderColor: colors.border }]}>
                <Icon name={getFileIcon(file.name)} size={22} color={colors.primary} style={styles.attachmentIcon} />
                <View style={styles.attachmentInfo}>
                  <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={[styles.attachmentSize, { color: colors.textHint }]}>{getReadableFileSize(file.size)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveAttachment(index)} style={styles.attachmentRemove} testID={`action.community.removeAttachment.${index}`}>
                  <Icon name="close" size={19} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.metadataContainer}>
          <TouchableOpacity
            style={[styles.metadataButton, { borderColor: colors.border }]}
            onPress={() => setShowCategoryPicker(true)}
            disabled={publishBusy}
            testID="action.community.openCategoryPicker"
          >
            <Icon name="folder" size={19} color={colors.primary} />
            <Text style={[styles.metadataText, { color: colors.text }]} numberOfLines={1}>
              {selectedCategoryName}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metadataButton, { borderColor: colors.border }]}
            onPress={() => setShowTagPicker(true)}
            disabled={publishBusy}
            testID="action.community.openTagPicker"
          >
            <Icon name="local-offer" size={19} color={colors.primary} />
            <Text style={[styles.metadataText, { color: colors.text }]} numberOfLines={1}>
              {selectedTagsText}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.optionItem}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>公开帖子</Text>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: isPublic ? colors.primary : colors.border }]}
              onPress={() => setIsPublic((prev) => !prev)}
              disabled={publishBusy}
              testID="action.community.togglePublic"
            >
              <View style={[styles.toggleIndicator, { backgroundColor: colors.card, left: isPublic ? 20 : 2 }]} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionItem}>
            <Text style={[styles.optionLabel, { color: colors.text }]}>允许评论</Text>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: allowComments ? colors.primary : colors.border }]}
              onPress={() => setAllowComments((prev) => !prev)}
              disabled={publishBusy}
              testID="action.community.toggleComments"
            >
              <View style={[styles.toggleIndicator, { backgroundColor: colors.card, left: allowComments ? 20 : 2 }]} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showCategoryPicker ? (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]} testID="panel.community.categoryPicker">
          <Text style={[styles.pickerTitle, { color: colors.text }]}>选择分类</Text>
          <ScrollView style={styles.pickerScrollView}>
            {categories.length > 0 ? (
              categories.map((category) => (
                <TouchableOpacity
                  key={String(category.id)}
                  style={[
                    styles.categoryItem,
                    selectedCategory === category.id ? { backgroundColor: colors.primary } : null,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setShowCategoryPicker(false);
                  }}
                  testID={`action.community.selectCategory.${category.id}`}
                >
                  <Text style={{ color: selectedCategory === category.id ? '#fff' : colors.text }}>{category.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyPicker}>
                <Text style={{ color: colors.textHint }}>暂无分类</Text>
              </View>
            )}
          </ScrollView>
          <Button title="关闭" onPress={() => setShowCategoryPicker(false)} type="outline" />
        </View>
      ) : null}

      {showTagPicker ? (
        <View style={[styles.pickerContainer, { backgroundColor: colors.card }]} testID="panel.community.tagPicker">
          <Text style={[styles.pickerTitle, { color: colors.text }]}>选择标签</Text>
          <ScrollView style={styles.pickerScrollView}>
            <View style={styles.tagsWrap}>
              {availableTags.length > 0 ? (
                availableTags.map((tag) => (
                  <TouchableOpacity
                    key={String(tag.id)}
                    style={[styles.tagItem, selectedTags.includes(tag.id) ? { backgroundColor: colors.primary } : null]}
                    onPress={() => handleToggleTag(tag.id)}
                    testID={`action.community.toggleTag.${tag.id}`}
                  >
                    <Text style={{ color: selectedTags.includes(tag.id) ? '#fff' : colors.text }}>{tag.name}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyPicker}>
                  <Text style={{ color: colors.textHint }}>暂无标签</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <Button title="完成" onPress={() => setShowTagPicker(false)} type="outline" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,150,243,0.18)',
    backgroundColor: 'rgba(255,255,255,0.90)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  backButton: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  publishButton: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  publishText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabledButton: { opacity: 0.62 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 28 },
  titleInput: {
    fontSize: 19,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  coverImageContainer: {
    height: 196,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  coverImage: { width: '100%', height: '100%' },
  coverImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverImageText: { marginTop: 8, fontSize: 13 },
  contentInput: {
    minHeight: 200,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.14)',
    borderRadius: 12,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: 'rgba(255,255,255,0.80)',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  attachButtonText: { marginLeft: 8, fontSize: 14, fontWeight: '600' },
  attachmentsContainer: { marginBottom: 16 },
  attachmentsTitle: { marginBottom: 8, fontSize: 14, fontWeight: '700' },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  attachmentIcon: { marginRight: 10 },
  attachmentInfo: { flex: 1 },
  attachmentName: { fontSize: 14, fontWeight: '600' },
  attachmentSize: { marginTop: 2, fontSize: 12 },
  attachmentRemove: { padding: 4 },
  metadataContainer: { flexDirection: 'row', marginBottom: 16 },
  metadataButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  metadataText: { flex: 1, marginHorizontal: 8, fontSize: 13 },
  optionsContainer: { marginBottom: 18 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  toggleButton: { width: 40, height: 22, borderRadius: 11, position: 'relative' },
  toggleIndicator: { width: 18, height: 18, borderRadius: 9, position: 'absolute', top: 2 },
  pickerContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    bottom: 80,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.24)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  pickerTitle: { marginBottom: 12, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  pickerScrollView: { flex: 1, marginBottom: 12 },
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.14)',
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tagItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.18)',
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  emptyPicker: { padding: 20, alignItems: 'center', justifyContent: 'center' },
});

export default CreatePostScreen;
