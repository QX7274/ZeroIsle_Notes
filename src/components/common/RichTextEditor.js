/**
 * 富文本编辑器组件
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
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { spacing, borderRadius } from '../../utils/constants/dimensions';
import { uploadImage } from '../../redux/slices/notesSlice';
import { UPLOAD_LIMITS } from '../../utils/constants/config';

/**
 * 富文本编辑器组件
 * @param {string} value - 编辑器内容
 * @param {function} onChange - 内容变化回调
 * @param {object} style - 自定义样式
 * @param {string} noteId - 笔记ID，用于图片上传关联
 * @param {boolean} readOnly - 是否只读模式
 * @param {function} onImageUpload - 图片上传成功回调
 * @param {function} showToast - 显示Toast提示的回调函数
 */
const RichTextEditor = ({
  value = '',
  onChange,
  style,
  noteId = null,
  readOnly = false,
  onImageUpload,
  showToast
 }) => {
  // 解析内容为富文本格式
  const [content, setContent] = useState(value);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const inputRef = useRef(null);

  const { colors } = useTheme();
  // 获取动态样式
  const styles = getStyles(colors);
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

  // 从相册选择图片
  const selectImageFromGallery = async () => {
    setShowImageOptions(false);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: true,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('错误', '选择图片失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // 检查文件大小
        if (asset.fileSize > UPLOAD_LIMITS.IMAGE_MAX_SIZE) {
          Alert.alert('错误', `图片大小不能超过${UPLOAD_LIMITS.IMAGE_MAX_SIZE / (1024 * 1024)}MB`);
          return;
        }

        // 检查文件类型
        if (!UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.includes(asset.type)) {
          Alert.alert('错误', '不支持的图片格式');
          return;
        }

        setImagePreview(asset);
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
        includeBase64: true,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel) return;

      if (result.errorCode) {
        Alert.alert('错误', '拍照失败: ' + result.errorMessage);
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImagePreview(asset);
        uploadImageToServer(asset);
      }
    } catch (error) {
      Alert.alert('错误', '拍照失败: ' + error.message);
    }
  };

  // 上传图片到服务器
  const uploadImageToServer = async (asset) => {
    try {
      // 准备图片数据
      const imageData = {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `image_${Date.now()}.jpg`,
      };

      // 检查网络状态
      if (Platform.OS !== 'web') {
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          Alert.alert(
            '离线状态',
            '当前处于离线状态，无法上传图片到服务器。是否要将图片插入到笔记中？上线后可以再次同步。',
            [
              {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
              {text: '插入本地图片', onPress: () => {
                // 直接插入本地图片路径，标记为离线图片
                insertImage(asset.uri);
                // 清除预览状态
                setTimeout(() => setImagePreview(null), 300);
              }}
            ]
          );
          return;
        }

        // 检查网络质量
        if (netInfo.type === 'cellular' && (netInfo.details?.cellularGeneration === '2g' || netInfo.details?.cellularGeneration === '3g')) {
          // 在网络质量较差的情况下提示用户
          Alert.alert(
            '网络提示',
            '当前网络质量较差，上传可能较慢或失败。是否继续？',
            [
              {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
              {text: '继续上传', onPress: () => {
                // 继续上传流程
                proceedWithUpload();
              }},
              {text: '插入本地图片', onPress: () => {
                // 直接插入本地图片路径，标记为离线图片
                insertImage(asset.uri);
                // 清除预览状态
                setTimeout(() => setImagePreview(null), 300);
              }}
            ]
          );
          return;
        }
      }

      // 继续上传流程
      proceedWithUpload();

      async function proceedWithUpload() {
        try {
          // 检查图片大小，如果超过限制，尝试压缩或提示用户
          if (asset.fileSize > UPLOAD_LIMITS.IMAGE_MAX_SIZE * 0.8) {
            console.log('图片较大，尝试压缩...');
            // TODO: 集成图片压缩功能
            // 推荐使用以下库之一进行图片压缩：
            // 1. react-native-image-resizer: 可以调整图片尺寸和质量
            // 2. react-native-compressor: 提供更高级的压缩选项
            // 3. react-native-image-manipulator: 支持多种图片处理操作
            //
            // 示例代码 (使用react-native-image-resizer):
            // import ImageResizer from 'react-native-image-resizer';
            // const resizedImage = await ImageResizer.createResizedImage(
            //   asset.uri,
            //   1200,  // 最大宽度
            //   1200,  // 最大高度
            //   'JPEG', // 格式
            //   80,    // 质量 (0-100)
            //   0,     // 旋转
            //   null,  // 输出路径 (null表示临时目录)
            // );
            // 然后使用resizedImage.uri替代asset.uri进行上传

            // 如果图片非常大，提示用户
            if (asset.fileSize > UPLOAD_LIMITS.IMAGE_MAX_SIZE * 0.95) {
              Alert.alert(
                '图片过大',
                `图片大小(${(asset.fileSize / (1024 * 1024)).toFixed(2)}MB)接近上传限制(${UPLOAD_LIMITS.IMAGE_MAX_SIZE / (1024 * 1024)}MB)，可能导致上传失败。`,
                [
                  {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
                  {text: '继续上传', onPress: () => continueUpload()},
                  {text: '插入本地图片', onPress: () => insertImage(asset.uri)}
                ]
              );
              return;
            }
          }

          // 继续上传流程
          continueUpload();
        } catch (error) {
          handleUploadError(error);
        }
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
    console.error('上传图片失败:', error);

    // 检查是否是网络错误
    const isNetworkError = error.message && (
      error.message.includes('network') ||
      error.message.includes('Network') ||
      error.message.includes('timeout') ||
      error.message.includes('连接') ||
      error.message.includes('connection')
    );

    // 检查是否是服务器错误
    const isServerError = error.status && (error.status >= 500 && error.status < 600);

    // 检查是否是权限错误
    const isAuthError = error.status && (error.status === 401 || error.status === 403);

    let errorMessage = '上传图片失败: ' + (error.message || '请稍后重试');
    let options = [];

    if (isNetworkError) {
      errorMessage = '网络连接问题，无法上传图片。';
      options = [
        {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
        {text: '重试', onPress: () => {
          if (imagePreview) {
            uploadImageToServer(imagePreview);
          }
        }},
        {text: '插入本地图片', onPress: () => {
          if (imagePreview) {
            // 直接插入本地图片路径，标记为离线图片
            insertImage(imagePreview.uri);
          }
        }}
      ];
    } else if (isServerError) {
      errorMessage = '服务器暂时无法处理请求，请稍后再试。';
      options = [
        {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
        {text: '重试', onPress: () => {
          if (imagePreview) {
            uploadImageToServer(imagePreview);
          }
        }},
        {text: '插入本地图片', onPress: () => {
          if (imagePreview) {
            insertImage(imagePreview.uri);
          }
        }}
      ];
    } else if (isAuthError) {
      errorMessage = '您没有权限上传图片，请重新登录后再试。';
      options = [
        {text: '确定', onPress: () => setImagePreview(null)},
        {text: '插入本地图片', onPress: () => {
          if (imagePreview) {
            insertImage(imagePreview.uri);
          }
        }}
      ];
    } else {
      options = [
        {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
        {text: '重试', onPress: () => {
          if (imagePreview) {
            uploadImageToServer(imagePreview);
          }
        }},
        {text: '插入本地图片', onPress: () => {
          if (imagePreview) {
            // 直接插入本地图片路径，标记为离线图片
            insertImage(imagePreview.uri);
          }
        }}
      ];
    }

    Alert.alert('上传失败', errorMessage, options);
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

  // 监听图片上传错误
  useEffect(() => {
    if (imageUploadError) {
      Alert.alert(
        '上传失败',
        '上传图片失败: ' + (imageUploadError.message || imageUploadError),
        [
          {text: '取消', style: 'cancel', onPress: () => setImagePreview(null)},
          {text: '重试', onPress: () => {
            if (imagePreview) {
              uploadImageToServer(imagePreview);
            }
          }}
        ]
      );
    }
  }, [imageUploadError]);

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
              onPress={() => applyFormat('quote')}
            >
              <Icon name="format-quote" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={handleImageOptions}
            >
              <Icon name="image" size={20} color={colors.text} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 图片选项菜单 */}
      {showImageOptions && (
        <View style={styles.imageOptionsContainer}>
          <TouchableOpacity
            style={styles.imageOption}
            onPress={selectImageFromGallery}
          >
            <Icon name="photo-library" size={24} color={colors.text} />
            <Text style={styles.imageOptionText}>从相册选择</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageOption}
            onPress={takePhoto}
          >
            <Icon name="camera-alt" size={24} color={colors.text} />
            <Text style={styles.imageOptionText}>拍照</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageOptionClose}
            onPress={() => setShowImageOptions(false)}
          >
            <Icon name="close" size={24} color={colors.text} />
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
              <Text style={styles.uploadingText}>正在上传图片...</Text>
            </View>
          ) : null}
        </View>
      )}

      <TextInput
        ref={inputRef}
        style={styles.editor}
        value={content}
        onChangeText={handleContentChange}
        onSelectionChange={handleSelectionChange}
        multiline
        textAlignVertical="top"
        placeholder="开始输入笔记内容..."
        placeholderTextColor={colors.textSecondary || '#8E8E93'}
        editable={!readOnly}
      />
    </KeyboardAvoidingView>
  );
};

// 创建一个函数来获取样式，这样我们可以在组件内部使用它
const getStyles = (colors) => {
  // 确保colors对象有所有需要的属性
  const extendedColors = {
    ...colors,
    white: colors.background || '#FFFFFF',
    primaryAlpha20: colors.primary ? `${colors.primary}33` : '#007AFF33',
    backgroundLight: colors.background ? `${colors.background}DD` : '#F5F5F5',
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: extendedColors.background,
    },
    toolbar: {
      flexDirection: 'row',
      backgroundColor: extendedColors.white,
      borderBottomWidth: 1,
      borderBottomColor: extendedColors.border,
      paddingVertical: spacing.small,
    },
    toolbarButton: {
      padding: spacing.small,
      marginHorizontal: spacing.tiny,
      borderRadius: borderRadius.small,
    },
    activeButton: {
      backgroundColor: extendedColors.primaryAlpha20,
    },
    divider: {
      width: 1,
      height: '80%',
      backgroundColor: extendedColors.border,
      marginHorizontal: spacing.small,
      alignSelf: 'center',
    },
    headingText: {
      fontWeight: 'bold',
      color: extendedColors.text,
    },
    editor: {
      flex: 1,
      padding: spacing.medium,
      fontSize: 16,
      color: extendedColors.text,
      textAlignVertical: 'top',
    },
    // 图片选项菜单样式
    imageOptionsContainer: {
      flexDirection: 'row',
      backgroundColor: extendedColors.white,
      borderBottomWidth: 1,
      borderBottomColor: extendedColors.border,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.medium,
      justifyContent: 'space-around',
    },
    imageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.small,
      borderRadius: borderRadius.small,
    },
    imageOptionText: {
      marginLeft: spacing.small,
      color: extendedColors.text,
      fontSize: 14,
    },
    imageOptionClose: {
      padding: spacing.small,
      borderRadius: borderRadius.small,
      position: 'absolute',
      right: spacing.small,
      top: spacing.small,
    },
    // 图片预览样式
    imagePreviewContainer: {
      backgroundColor: extendedColors.backgroundLight,
      padding: spacing.small,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: extendedColors.border,
    },
    imagePreview: {
      width: 200,
      height: 150,
      borderRadius: borderRadius.small,
    },
    uploadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.small,
      backgroundColor: 'rgba(0,0,0,0.05)',
      padding: spacing.small,
      borderRadius: borderRadius.small,
      width: '100%',
      justifyContent: 'center',
    },
    uploadingText: {
      marginLeft: spacing.small,
      color: extendedColors.text,
      fontSize: 14,
    },
  });
};

export default RichTextEditor;