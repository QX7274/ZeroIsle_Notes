/**
 * 增强版富文本编辑器组件
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import networkService from '../../services/network/networkService';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { uploadImage } from '../../redux/slices/notesSlice';
import MarkdownPreview from './MarkdownPreview';

/**
 * 增强版富文本编辑器组件
 * @param {string} value - 编辑器内容
 * @param {function} onChange - 内容变化回调
 * @param {object} style - 自定义样式
 * @param {string} noteId - 笔记ID，用于图片上传关联
 * @param {boolean} readOnly - 是否只读模式
 * @param {function} onImageUpload - 图片上传成功回调
 * @param {function} showToast - 显示Toast提示的回调函数
 */
const EnhancedRichTextEditor = ({
  value = '',
  onChange,
  style,
  noteId = null,
  readOnly = false,
  onImageUpload,
  showToast,
}) => {
  // 解析内容为富文本格式
  const [content, setContent] = useState(value);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const inputRef = useRef(null);

  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();
  const { isLoading: isImageUploading, error: imageUploadError, result: imageUploadResult } = useSelector(state => state.notes.imageUpload);

  // 处理内容变化
  const handleContentChange = (text) => {
    setContent(text);
    if (onChange) {
      onChange(text);
    }
  };

  // 处理选择范围变化
  const handleSelectionChange = (event) => {
    setSelection(event.nativeEvent.selection);
  };

  // 应用格式化
  const applyFormat = (format) => {
    const { start, end } = selection;
    if (start === end) {
      // 没有选中文本，只是设置状态
      switch (format) {
        case 'bold':
          setIsBold(!isBold);
          break;
        case 'italic':
          setIsItalic(!isItalic);
          break;
        case 'underline':
          setIsUnderline(!isUnderline);
          break;
      }
      return;
    }

    // 有选中文本，应用格式
    const selectedText = content.substring(start, end);
    let formattedText = selectedText;

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      case 'h1':
        formattedText = `# ${selectedText}`;
        break;
      case 'h2':
        formattedText = `## ${selectedText}`;
        break;
      case 'h3':
        formattedText = `### ${selectedText}`;
        break;
      case 'quote':
        formattedText = `> ${selectedText}`;
        break;
      case 'list':
        formattedText = selectedText
          .split('\n')
          .map(line => `- ${line}`)
          .join('\n');
        break;
      case 'code':
        formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
        break;
      case 'checkbox':
        formattedText = selectedText
          .split('\n')
          .map(line => `- [ ] ${line}`)
          .join('\n');
        break;
    }

    const newContent =
      content.substring(0, start) + formattedText + content.substring(end);
    handleContentChange(newContent);

    // 重新设置选择范围
    setTimeout(() => {
      const newSelection = {
        start: start,
        end: start + formattedText.length,
      };
      setSelection(newSelection);
      if (inputRef.current) {
        inputRef.current.setNativeProps({
          selection: newSelection,
        });
      }
    }, 100);
  };

  // 处理图片选项显示
  const handleImageOptions = () => {
    setShowImageOptions(!showImageOptions);
  };

  // 从图库选择图片
  const selectImageFromGallery = async () => {
    setShowImageOptions(false);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel) {return;}

      if (result.errorCode) {
        Alert.alert('错误', '选择图片失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        uploadImageToServer(asset);
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败: ' + error.message);
    }
  };

  // 使用相机拍照
  const takePhoto = async () => {
    setShowImageOptions(false);
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel) {return;}

      if (result.errorCode) {
        Alert.alert('错误', '拍照失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        uploadImageToServer(asset);
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败: ' + error.message);
    }
  };

  // 上传图片到服务器
  const uploadImageToServer = async (asset) => {
    try {
      // 检查网络连接
      const isOnline = await networkService.checkConnection();

      // 如果没有网络连接，则保存本地图片路径
      if (!isOnline) {
        insertImage(asset.uri);
        showToast && showToast('离线模式：图片将在联网后上传');
        return;
      }

      // 准备图片数据
      const imageData = new FormData();
      imageData.append('image', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'image.jpg',
      });

      if (noteId) {
        imageData.append('note_id', noteId);
      }

      // 检查图片大小
      if (asset.fileSize > 10 * 1024 * 1024) { // 10MB
        Alert.alert(
          '图片过大',
          '图片大小超过10MB，是否继续上传？',
          [
            {
              text: '取消',
              style: 'cancel',
            },
            {
              text: '继续',
              onPress: () => continueUpload(),
            },
          ]
        );
      } else {
        continueUpload();
      }

      // 实际执行上传操作
      async function continueUpload() {
        // 显示上传中状态
        setImagePreview(asset);

        try {
          // 调用Redux action上传图片
          const result = await dispatch(uploadImage({ imageData, noteId })).unwrap();

          // 上传成功后直接插入图片
          if (result && result.url) {
            insertImage(result.url);
            // 显示成功提示
            showToast && showToast('图片上传成功');
            // 清除预览状态
            setTimeout(() => setImagePreview(null), 500);
          } else {
            throw new Error('上传成功但未返回图片URL');
          }
        } catch (uploadError) {
          handleUploadError(uploadError);
        }
      }
    } catch (error) {
      handleUploadError(error);
    }
  };

  // 处理上传错误
  const handleUploadError = (error) => {
    console.error('图片上传失败:', error);
    Alert.alert('错误', '图片上传失败: ' + (error.message || '未知错误'));
    setImagePreview(null);
  };

  // 插入图片
  const insertImage = (imageUrl) => {
    try {
      // 判断是否为本地图片路径（离线模式下）
      const isLocalImage = imageUrl.startsWith('file:') || imageUrl.startsWith('content:');

      // 根据图片类型生成不同的Markdown
      let imageMarkdown;
      if (isLocalImage) {
        // 本地图片添加标记，以便将来可以识别并上传
        imageMarkdown = `![本地图片-待上传](${imageUrl})`;
        // 在离线模式下插入本地图片时显示提示
        showToast && showToast('已插入本地图片，联网后将自动上传');
      } else {
        imageMarkdown = `![图片](${imageUrl})`;
      }

      // 在当前光标位置插入图片
      const { start } = selection;
      const newContent =
        content.substring(0, start) + imageMarkdown + content.substring(start);
      handleContentChange(newContent);

      // 清除预览
      setImagePreview(null);

      // 调用回调
      if (onImageUpload) {
        onImageUpload(imageUrl, isLocalImage);
      }
    } catch (error) {
      console.error('插入图片失败:', error);
      Alert.alert('错误', '插入图片失败: ' + error.message);
    }
  };

  // 插入表格
  const insertTable = () => {
    try {
      // 生成表格头部
      let tableHeader = '|';
      for (let i = 0; i < tableColumns; i++) {
        tableHeader += ` 列${i + 1} |`;
      }

      // 生成表格分隔行
      let tableDivider = '|';
      for (let i = 0; i < tableColumns; i++) {
        tableDivider += ' --- |';
      }

      // 生成表格内容行
      let tableContent = '';
      for (let i = 0; i < tableRows; i++) {
        tableContent += '\n|';
        for (let j = 0; j < tableColumns; j++) {
          tableContent += '  |';
        }
      }

      // 组合表格Markdown
      const tableMarkdown = `\n${tableHeader}\n${tableDivider}${tableContent}\n`;

      // 在当前光标位置插入表格
      const { start } = selection;
      const newContent =
        content.substring(0, start) + tableMarkdown + content.substring(start);
      handleContentChange(newContent);

      // 关闭表格模态框
      setShowTableModal(false);
    } catch (error) {
      console.error('插入表格失败:', error);
      Alert.alert('错误', '插入表格失败: ' + error.message);
    }
  };

  // 插入链接
  const insertLink = () => {
    try {
      // 验证URL
      if (!linkUrl.trim()) {
        Alert.alert('错误', '请输入链接URL');
        return;
      }

      // 生成链接Markdown
      const linkMarkdown = `[${linkText || linkUrl}](${linkUrl})`;

      // 在当前光标位置插入链接
      const { start } = selection;
      const newContent =
        content.substring(0, start) + linkMarkdown + content.substring(start);
      handleContentChange(newContent);

      // 关闭链接模态框
      setShowLinkModal(false);
      setLinkUrl('');
      setLinkText('');
    } catch (error) {
      console.error('插入链接失败:', error);
      Alert.alert('错误', '插入链接失败: ' + error.message);
    }
  };

  // 监听图片上传结果
  useEffect(() => {
    if (imageUploadResult && imagePreview && !isImageUploading) {
      // 确保只有在上传完成且有预览图片时才插入图片
      // 由于我们在uploadImageToServer中已经处理了成功情况，这里主要作为备用机制
      if (!imageUploadError) {
        // 检查是否已经插入过图片，避免重复插入
        if (imageUploadResult.url && !content.includes(imageUploadResult.url)) {
          insertImage(imageUploadResult.url);
        }
      }
    }
  }, [imageUploadResult, imagePreview, isImageUploading, imageUploadError, content]);

  // 渲染表格模态框
  const renderTableModal = () => (
    <Modal
      visible={showTableModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowTableModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>插入表格</Text>

          <View style={styles.tableInputContainer}>
            <View style={styles.tableInputRow}>
              <Text style={[styles.tableInputLabel, { color: colors.text }]}>行数:</Text>
              <TextInput
                style={[styles.tableInput, { color: colors.text, borderColor: colors.border }]}
                value={tableRows.toString()}
                onChangeText={(text) => setTableRows(parseInt(text) || 1)}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.tableInputRow}>
              <Text style={[styles.tableInputLabel, { color: colors.text }]}>列数:</Text>
              <TextInput
                style={[styles.tableInput, { color: colors.text, borderColor: colors.border }]}
                value={tableColumns.toString()}
                onChangeText={(text) => setTableColumns(parseInt(text) || 1)}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: colors.border }]}
              onPress={() => setShowTableModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={insertTable}
            >
              <Text style={[styles.modalButtonText, { color: colors.card }]}>插入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // 渲染链接模态框
  const renderLinkModal = () => (
    <Modal
      visible={showLinkModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLinkModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>插入链接</Text>

          <View style={styles.linkInputContainer}>
            <Text style={[styles.linkInputLabel, { color: colors.text }]}>链接URL:</Text>
            <TextInput
              style={[styles.linkInput, { color: colors.text, borderColor: colors.border }]}
              value={linkUrl}
              onChangeText={setLinkUrl}
              placeholder="https://example.com"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />

            <Text style={[styles.linkInputLabel, { color: colors.text }]}>链接文本:</Text>
            <TextInput
              style={[styles.linkInput, { color: colors.text, borderColor: colors.border }]}
              value={linkText}
              onChangeText={setLinkText}
              placeholder="显示文本（可选）"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: colors.border }]}
              onPress={() => setShowLinkModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={insertLink}
            >
              <Text style={[styles.modalButtonText, { color: colors.card }]}>插入</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, style]}
    >
      {!readOnly && (
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.toolbarButton, isBold && styles.activeButton]}
              onPress={() => applyFormat('bold')}
            >
              <Icon name="format-bold" size={20} color={isBold ? colors.primary : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarButton, isItalic && styles.activeButton]}
              onPress={() => applyFormat('italic')}
            >
              <Icon name="format-italic" size={20} color={isItalic ? colors.primary : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolbarButton, isUnderline && styles.activeButton]}
              onPress={() => applyFormat('underline')}
            >
              <Icon name="format-underlined" size={20} color={isUnderline ? colors.primary : colors.text} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('h1')}
            >
              <Text style={styles.headingText}>H1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('h2')}
            >
              <Text style={styles.headingText}>H2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('h3')}
            >
              <Text style={styles.headingText}>H3</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('list')}
            >
              <Icon name="format-list-bulleted" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('checkbox')}
            >
              <Icon name="check-box" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('quote')}
            >
              <Icon name="format-quote" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => applyFormat('code')}
            >
              <Icon name="code" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setShowTableModal(true)}
            >
              <Icon name="grid-on" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setShowLinkModal(true)}
            >
              <Icon name="link" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={handleImageOptions}
            >
              <Icon name="image" size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.toolbarButton, showPreview && styles.activeButton]}
              onPress={() => setShowPreview(!showPreview)}
            >
              <Icon name="visibility" size={20} color={showPreview ? colors.primary : colors.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {showImageOptions && (
        <View style={styles.imageOptionsContainer}>
          <TouchableOpacity
            style={styles.imageOption}
            onPress={selectImageFromGallery}
          >
            <Icon name="photo-library" size={24} color={colors.text} />
            <Text style={[styles.imageOptionText, { color: colors.text }]}>从相册选择</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageOption}
            onPress={takePhoto}
          >
            <Icon name="camera-alt" size={24} color={colors.text} />
            <Text style={[styles.imageOptionText, { color: colors.text }]}>拍照</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 图片上传状态 */}
      {imagePreview && (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: imagePreview.uri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
          {isImageUploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.uploadingText, { color: colors.text }]}>正在上传图片...</Text>
            </View>
          ) : null}
        </View>
      )}

      {showPreview ? (
        <MarkdownPreview content={content} />
      ) : (
        <TextInput
          ref={inputRef}
          style={[
            styles.editor,
            { color: colors.text },
          ]}
          value={content}
          onChangeText={handleContentChange}
          onSelectionChange={handleSelectionChange}
          multiline
          textAlignVertical="top"
          placeholder="开始输入笔记内容..."
          placeholderTextColor={colors.textSecondary}
          editable={!readOnly}
        />
      )}

      {renderTableModal()}
      {renderLinkModal()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  toolbarButton: {
    padding: 8,
    marginHorizontal: 4,
    borderRadius: 4,
  },
  activeButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  headingText: {
    fontWeight: 'bold',
    color: '#333',
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  imageOptionsContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 16,
  },
  imageOptionText: {
    marginLeft: 8,
    fontSize: 14,
  },
  imagePreviewContainer: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 4,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
    borderRadius: 4,
    width: '100%',
    justifyContent: 'center',
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: 8,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  tableInputContainer: {
    marginBottom: 16,
  },
  tableInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableInputLabel: {
    width: 50,
    fontSize: 16,
  },
  tableInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  linkInputContainer: {
    marginBottom: 16,
  },
  linkInputLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  linkInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    height: 40,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EnhancedRichTextEditor;
