/**
 * 创建社区帖子页面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import { Button, GradientButton } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import { createPost } from '../../redux/slices/communitySlice';
import { fetchCategories, fetchTags } from '../../store/slices/notesSlice';

const CreatePostScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const categories = useSelector(state => state.notes.categories);
  const tags = useSelector(state => state.notes.tags);
  const isLoading = useSelector(state => state.community.isLoading);

  // 表单状态
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

  // 加载分类和标签
  useEffect(() => {
    loadCategoriesAndTags();
  }, [dispatch]);

  // 加载分类和标签数据
  const loadCategoriesAndTags = async () => {
    try {
      // 尝试从API加载分类和标签
      const categoriesResult = await dispatch(fetchCategories()).unwrap();
      const tagsResult = await dispatch(fetchTags()).unwrap();

      // 更新本地状态
      setAvailableCategories(categoriesResult || []);
      setAvailableTags(tagsResult || []);
    } catch (error) {
      console.error('加载分类和标签失败:', error);

      // 设置默认分类和标签
      const defaultCategories = [
        { id: '1', name: '笔记模板' },
        { id: '2', name: '学习资料' },
        { id: '3', name: '使用技巧' },
        { id: '4', name: '知识图谱' },
      ];

      const defaultTags = [
        { id: '1', name: '效率提升' },
        { id: '2', name: '笔记技巧' },
        { id: '3', name: '知识管理' },
        { id: '4', name: '学习方法' },
        { id: '5', name: '案例分享' },
      ];

      setAvailableCategories(defaultCategories);
      setAvailableTags(defaultTags);
    }
  };

  // 本地分类和标签状态
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // 选择封面图片
  const handleSelectCoverImage = async () => {
    try {
      Haptics.lightFeedback();

      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('错误', '选择图片失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setCoverImage({
          uri: selectedImage.uri,
          type: selectedImage.type,
          name: selectedImage.fileName || 'cover.jpg',
        });
      }
    } catch (err) {
      Alert.alert('错误', err.message || '选择图片失败');
    }
  };

  // 选择附件
  const handleSelectAttachments = async () => {
    try {
      Haptics.lightFeedback();

      // 显示文件类型选择
      Alert.alert(
        '选择文件类型',
        '请选择要上传的文件类型',
        [
          {
            text: '文档 (PDF/DOC/DOCX)',
            onPress: () => pickDocument(['pdf', 'doc', 'docx']),
          },
          {
            text: '图片 (JPG/PNG)',
            onPress: () => pickDocument(['jpg', 'jpeg', 'png']),
          },
          {
            text: '压缩文件 (ZIP/RAR)',
            onPress: () => pickDocument(['zip', 'rar']),
          },
          {
            text: '其他文件',
            onPress: () => pickDocument([]),
          },
          {
            text: '取消',
            style: 'cancel',
          },
        ]
      );
    } catch (err) {
      Alert.alert('错误', err.message || '选择文件失败');
    }
  };

  // 选择文档
  const pickDocument = async (fileTypes) => {
    try {
      const results = await DocumentPicker.pick({
        type: fileTypes.length > 0
          ? fileTypes.map(type => DocumentPicker.types[type] || `application/${type}`)
          : [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
      });

      // 检查文件大小限制 (10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles = results.filter(file => file.size <= MAX_FILE_SIZE);

      if (validFiles.length < results.length) {
        Alert.alert('警告', '部分文件超过10MB大小限制，已被过滤');
      }

      // 添加到附件列表
      const newAttachments = validFiles.map(file => ({
        uri: file.uri,
        type: file.type,
        name: file.name,
        size: file.size,
      }));

      setAttachments([...attachments, ...newAttachments]);
    } catch (err) {
      if (err.code === 'DOCUMENT_PICKER_CANCELED') {
        // 用户取消选择
        return;
      }
      Alert.alert('错误', err.message || '选择文件失败');
    }
  };

  // 移除附件
  const handleRemoveAttachment = (index) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  // 处理发布帖子
  const handlePublishPost = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入帖子标题');
      return;
    }

    if (!content.trim()) {
      Alert.alert('提示', '请输入帖子内容');
      return;
    }

    try {
      Haptics.mediumFeedback();

      // 检查是否有文件需要上传
      const hasFiles = coverImage || attachments.length > 0;

      // 构建帖子数据
      let postData;

      if (hasFiles) {
        // 使用FormData处理文件上传
        postData = new FormData();

        // 添加基本字段
        postData.append('title', title.trim());
        postData.append('content', content.trim());
        postData.append('excerpt', content.trim().substring(0, 100) + (content.length > 100 ? '...' : ''));

        if (selectedCategory) {
          postData.append('category_id', selectedCategory);
        }

        // 添加标签
        if (selectedTags.length > 0) {
          selectedTags.forEach(tag => {
            postData.append('tags', tag);
          });
        }

        // 添加其他字段
        postData.append('is_public', isPublic ? 'true' : 'false');
        postData.append('allow_comments', allowComments ? 'true' : 'false');

        // 添加封面图片
        if (coverImage) {
          postData.append('cover_image', coverImage);
        }

        // 添加附件
        if (attachments.length > 0) {
          // 创建附件数组
          const attachmentsArray = [];

          // 添加每个附件
          attachments.forEach((attachment, index) => {
            // 添加附件文件
            postData.append(`file_${index}`, attachment);

            // 添加附件元数据到数组
            attachmentsArray.push({
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
              index: index
            });
          });

          // 添加附件元数据JSON
          postData.append('attachments_meta', JSON.stringify(attachmentsArray));

          // 添加附件数量
          postData.append('attachment_count', attachments.length.toString());
        }
      } else {
        // 无文件上传，使用普通JSON
        postData = {
          title: title.trim(),
          content: content.trim(),
          excerpt: content.trim().substring(0, 100) + (content.length > 100 ? '...' : ''),
          category_id: selectedCategory,
          tags: selectedTags,
          is_public: isPublic,
          allow_comments: allowComments,
        };
      }

      // 发布帖子
      const resultAction = await dispatch(createPost(postData));

      if (createPost.fulfilled.match(resultAction)) {
        // 发布成功
        Alert.alert('成功', '帖子发布成功');
        navigation.goBack();
      } else {
        // 发布失败
        Alert.alert('错误', resultAction.error?.message || '发布帖子失败');
      }
    } catch (err) {
      console.error('发布帖子错误:', err);
      Alert.alert('错误', err.message || '发布帖子失败');
    }
  };

  // 处理选择分类
  const handleSelectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowCategoryPicker(false);
  };

  // 处理选择标签
  const handleToggleTag = (tagId) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  // 渲染分类选择器
  const renderCategoryPicker = () => {
    if (!showCategoryPicker) return null;

    return (
      <View style={[
        styles.pickerContainer,
        { backgroundColor: colors.card }
      ]}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.pickerTitle}
        >
          选择分类
        </Text>

        <ScrollView style={styles.pickerScrollView}>
          {availableCategories.length > 0 ? (
            availableCategories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItem,
                  selectedCategory === category.id && styles.categoryItemSelected,
                  selectedCategory === category.id && { backgroundColor: colors.primary }
                ]}
                onPress={() => handleSelectCategory(category.id)}
              >
                <Text
                  variant="body"
                  size="medium"
                  color={selectedCategory === category.id ? 'card' : undefined}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text
                variant="body"
                size="medium"
                color="hint"
                center
              >
                暂无分类
              </Text>
            </View>
          )}
        </ScrollView>

        <Button
          title="关闭"
          onPress={() => setShowCategoryPicker(false)}
          type="outline"
          style={styles.pickerCloseButton}
        />
      </View>
    );
  };

  // 渲染标签选择器
  const renderTagPicker = () => {
    if (!showTagPicker) return null;

    return (
      <View style={[
        styles.pickerContainer,
        { backgroundColor: colors.card }
      ]}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.pickerTitle}
        >
          选择标签
        </Text>

        <ScrollView style={styles.pickerScrollView}>
          <View style={styles.tagsContainer}>
            {availableTags.length > 0 ? (
              availableTags.map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagItem,
                    selectedTags.includes(tag.id) && styles.tagItemSelected,
                    selectedTags.includes(tag.id) && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => handleToggleTag(tag.id)}
                >
                  <Text
                    variant="body"
                    size="small"
                    color={selectedTags.includes(tag.id) ? 'card' : undefined}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text
                  variant="body"
                  size="medium"
                  color="hint"
                  center
                >
                  暂无标签
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <Button
          title="关闭"
          onPress={() => setShowTagPicker(false)}
          type="outline"
          style={styles.pickerCloseButton}
        />
      </View>
    );
  };

  // 获取当前选中的分类名称
  const getSelectedCategoryName = () => {
    if (!selectedCategory) return '无分类';
    const category = availableCategories.find(c => c.id === selectedCategory);
    return category ? category.name : '无分类';
  };

  // 获取当前选中的标签名称
  const getSelectedTagsText = () => {
    if (selectedTags.length === 0) return '无标签';
    const selectedTagNames = selectedTags.map(tagId => {
      const tag = availableTags.find(t => t.id === tagId);
      return tag ? tag.name : '';
    }).filter(Boolean);
    return selectedTagNames.join(', ');
  };

  // 获取文件大小的可读格式
  const getReadableFileSize = (size) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取文件图标
  const getFileIcon = (fileName) => {
    if (!fileName) return 'insert-drive-file';

    const extension = fileName.split('.').pop().toLowerCase();

    switch (extension) {
      case 'pdf':
        return 'picture-as-pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'xls':
      case 'xlsx':
        return 'table-chart';
      case 'ppt':
      case 'pptx':
        return 'slideshow';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'videocam';
      case 'mp3':
      case 'wav':
        return 'audiotrack';
      case 'zip':
      case 'rar':
        return 'archive';
      default:
        return 'insert-drive-file';
    }
  };

  // 渲染附件列表
  const renderAttachmentsList = () => {
    if (attachments.length === 0) return null;

    return (
      <View style={styles.attachmentsContainer}>
        <Text
          variant="body"
          size="medium"
          bold
          style={styles.attachmentsTitle}
        >
          附件 ({attachments.length})
        </Text>

        {attachments.map((file, index) => (
          <View
            key={`${file.name}-${index}`}
            style={[styles.attachmentItem, { borderColor: colors.border }]}
          >
            <Icon
              name={getFileIcon(file.name)}
              size={24}
              color={colors.primary}
              style={styles.attachmentIcon}
            />
            <View style={styles.attachmentInfo}>
              <Text
                variant="body"
                size="medium"
                numberOfLines={1}
                style={styles.attachmentName}
              >
                {file.name}
              </Text>
              <Text
                variant="body"
                size="small"
                color="hint"
              >
                {getReadableFileSize(file.size)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleRemoveAttachment(index)}
              style={styles.attachmentRemove}
            >
              <Icon name="close" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h6"
          style={styles.headerTitle}
        >
          创建帖子
        </Text>
        <TouchableOpacity
          style={[styles.publishButton, { backgroundColor: colors.primary }]}
          onPress={handlePublishPost}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text
              variant="body"
              size="medium"
              color="card"
            >
              发布
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={[
            styles.titleInput,
            { color: colors.text, borderBottomColor: colors.border }
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="请输入标题..."
          placeholderTextColor={colors.textHint}
          maxLength={100}
        />

        <TouchableOpacity
          style={[styles.coverImageContainer, { borderColor: colors.border }]}
          onPress={handleSelectCoverImage}
        >
          {coverImage ? (
            <Image
              source={{ uri: coverImage.uri }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverImagePlaceholder}>
              <Icon name="image" size={48} color={colors.textHint} />
              <Text
                variant="body"
                size="medium"
                color="hint"
                style={styles.coverImageText}
              >
                点击添加封面图片
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TextInput
          style={[
            styles.contentInput,
            { color: colors.text, backgroundColor: colors.background }
          ]}
          value={content}
          onChangeText={setContent}
          placeholder="请输入帖子内容..."
          placeholderTextColor={colors.textHint}
          multiline
          textAlignVertical="top"
        />

        {/* 附件上传按钮 */}
        <TouchableOpacity
          style={[styles.attachButton, { borderColor: colors.border }]}
          onPress={handleSelectAttachments}
        >
          <Icon name="attach-file" size={24} color={colors.primary} />
          <Text
            variant="body"
            size="medium"
            style={styles.attachButtonText}
          >
            添加附件
          </Text>
        </TouchableOpacity>

        {/* 附件列表 */}
        {renderAttachmentsList()}

        <View style={styles.metadataContainer}>
          <TouchableOpacity
            style={[
              styles.metadataButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Icon name="folder" size={20} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={styles.metadataText}
              numberOfLines={1}
            >
              {getSelectedCategoryName()}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.metadataButton,
              { borderColor: colors.border }
            ]}
            onPress={() => setShowTagPicker(true)}
          >
            <Icon name="local-offer" size={20} color={colors.primary} />
            <Text
              variant="body"
              size="medium"
              style={styles.metadataText}
              numberOfLines={1}
            >
              {getSelectedTagsText()}
            </Text>
            <Icon name="arrow-drop-down" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.optionsContainer}>
          <View style={styles.optionItem}>
            <Text
              variant="body"
              size="medium"
            >
              公开帖子
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: isPublic ? colors.primary : colors.border }
              ]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View
                style={[
                  styles.toggleIndicator,
                  { backgroundColor: colors.card, left: isPublic ? 20 : 2 }
                ]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionItem}>
            <Text
              variant="body"
              size="medium"
            >
              允许评论
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: allowComments ? colors.primary : colors.border }
              ]}
              onPress={() => setAllowComments(!allowComments)}
            >
              <View
                style={[
                  styles.toggleIndicator,
                  { backgroundColor: colors.card, left: allowComments ? 20 : 2 }
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {renderCategoryPicker()}
      {renderTagPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  publishButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  coverImageContainer: {
    height: 200,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImageText: {
    marginTop: 8,
  },
  contentInput: {
    minHeight: 200,
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  metadataContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  metadataButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  metadataText: {
    flex: 1,
    marginHorizontal: 8,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toggleButton: {
    width: 40,
    height: 22,
    borderRadius: 11,
    position: 'relative',
  },
  toggleIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
    top: 2,
  },
  pickerContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    bottom: 80,
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pickerTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerScrollView: {
    flex: 1,
    marginBottom: 16,
  },
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryItemSelected: {
    fontWeight: 'bold',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tagItemSelected: {
    fontWeight: 'bold',
  },
  pickerCloseButton: {
    alignSelf: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 16,
  },
  attachButtonText: {
    marginLeft: 8,
  },
  attachmentsContainer: {
    marginBottom: 16,
  },
  attachmentsTitle: {
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentIcon: {
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    marginBottom: 4,
  },
  attachmentRemove: {
    padding: 4,
  },
});

export default CreatePostScreen;
