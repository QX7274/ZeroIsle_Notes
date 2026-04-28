/**
 * 富文本编辑器组件 - 支持图片上传和日记内容编辑
 */
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import personalActivityApi from '../../services/api/personalActivityApi';

const { width } = Dimensions.get('window');

const RichTextEditor = ({
  content = '',
  images = [],
  onContentChange,
  onImagesChange,
  placeholder = '写下你的想法...',
  maxImages = 9,
}) => {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const textInputRef = useRef(null);

  const handlePickLibrary = () => pickImage('library');
  const handlePickCamera = () => pickImage('camera');

  const pickImage = async (source) => {
    try {
      const remainingSlots = Math.max(1, maxImages - images.length);
      const options = {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: source === 'library' ? remainingSlots : 1,
        includeExtra: false,
      };

      let response;
      if (source === 'camera') {
        response = await launchCamera(options);
      } else {
        response = await launchImageLibrary(options);
      }

      if (response?.didCancel) {return;}
      if (response?.errorCode) {
        console.error('Image picker error:', response.errorCode, response.errorMessage);
        Alert.alert('错误', response.errorMessage || '选择图片失败');
        return;
      }

      const selectedImages = response?.assets || [];
      const imagesToUpload = selectedImages.slice(0, remainingSlots);

      for (const imageAsset of imagesToUpload) {
        await uploadImage(imageAsset);
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      Alert.alert('错误', '选择图片失败');
    }
  };

  const uploadImage = async (imageAsset) => {
    try {
      setUploading(true);

      // 创建FormData
      const formData = new FormData();
      formData.append('image', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });

      const response = await personalActivityApi.uploadImage(formData.get('image'));

      if (response.success) {
        const newImage = {
          id: Date.now().toString(),
          url: response.data.image_url,
          thumbnail_url: response.data.thumbnail_url,
          filename: response.data.filename,
          size: response.data.size,
        };

        onImagesChange([...images, newImage]);
      } else {
        Alert.alert('错误', response.message || '图片上传失败');
      }
    } catch (error) {
      console.error('上传图片失败:', error);
      Alert.alert('错误', '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (imageIndex) => {
    const imageToRemove = images[imageIndex];

    Alert.alert(
      '删除图片',
      '确定要删除这张图片吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              if (imageToRemove.filename) {
                await personalActivityApi.deleteImage(imageToRemove.filename);
              }

              const newImages = images.filter((_, index) => index !== imageIndex);
              onImagesChange(newImages);
            } catch (error) {
              console.error('删除图片失败:', error);
              Alert.alert('错误', '删除图片失败');
            }
          },
        },
      ]
    );
  };

  const renderAddTile = () => {
    if (images.length >= maxImages) {return null;}
    const tileSide = (width - 48) / 3 - 8; // 与图片网格一致
    return (
      <TouchableOpacity
        style={[styles.addTile, { width: tileSide, height: tileSide, borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={handlePickLibrary}
        onLongPress={handlePickCamera}
        activeOpacity={0.85}
      >
        <Icon name="image" size={28} color={colors.text + '70'} />
        <Text style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary }}>照片/视频</Text>
      </TouchableOpacity>
    );
  };

  const renderImageGrid = () => {
    const imageSize = (width - 48) / 3 - 8; // 3列布局，考虑间距

    if (images.length === 0 && !uploading) {
      return (
        <View style={styles.imageGrid}>
          {renderAddTile()}
        </View>
      );
    }

    return (
      <View style={styles.imageGrid}>
        {images.map((image, index) => (
          <TouchableOpacity
            key={image.id || index}
            style={[styles.imageContainer, { width: imageSize, height: imageSize }]}
            onPress={() => setSelectedImageIndex(index)}
            onLongPress={() => removeImage(index)}
          >
            <Image
              source={{ uri: image.thumbnail_url || image.url || image.uri }}
              style={styles.image}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            >
              <Icon name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        {renderAddTile()}
        {uploading && (
          <View style={[styles.imageContainer, styles.uploadingContainer, { width: imageSize, height: imageSize }]}>
            <Icon name="cloud-upload" size={32} color={colors.primary} />
            <Text style={[styles.uploadingText, { color: colors.primary }]}>上传中...</Text>
          </View>
        )}
      </View>
    );
  };




  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 文本输入区域 */}
        <TextInput
          ref={textInputRef}
          style={[styles.textInput, { color: colors.text }]}
          value={content}
          onChangeText={onContentChange}
          placeholder={placeholder}
          placeholderTextColor={colors.text + '60'}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
        />

        {/* 图片网格 */}
        {renderImageGrid()}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    marginBottom: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  uploadingText: {
    fontSize: 12,
    marginTop: 4,
  },
  toolbarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  toolButton: {
    padding: 8,
    marginRight: 16,
  },
  toolbarSpacer: {
    flex: 1,
  },
  imageCounter: {
    fontSize: 12,
  },
});

export default RichTextEditor;
