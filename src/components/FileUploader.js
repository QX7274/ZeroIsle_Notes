/**
 * 文件上传组件
 * 支持PDF和WORD文档的选择与上传
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DocumentPicker from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { fileService } from '../../services/file';
import { loadingService } from '../../services/loading';
import { Toast } from '../common';
import networkErrorService from '../../services/networkErrorService';

const FileUploader = ({ onUploadComplete, allowedTypes = ['pdf', 'doc', 'docx'] }) => {
  const { colors } = useTheme();
  const [isUploading, setIsUploading] = useState(false);

  // 处理文件选择
  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      // 验证文件类型
      const fileExtension = result.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        Alert.alert(
          '不支持的文件类型',
          `请上传以下类型的文件: ${allowedTypes.join(', ')}`,
          [{ text: '确定' }]
        );
        return;
      }

      // 上传文件
      await uploadFile(result);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // 用户取消了选择
        return;
      }
      console.error('文件选择错误:', err);
      Alert.alert('错误', '文件选择失败，请重试');
    }
  };

  // 上传文件到服务器
  const uploadFile = async (file) => {
    try {
      setIsUploading(true);
      loadingService.show('上传中...');

      // 调用文件服务上传文件
      const uploadResult = await fileService.uploadFile({
        uri: file.uri,
        name: file.name,
        type: file.type,
        size: file.size
      });

      // 上传成功回调
      if (onUploadComplete) {
        onUploadComplete(uploadResult);
      }

      Toast.show('文件上传成功');
      return uploadResult;
    } catch (error) {
      console.error('文件上传失败:', error);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleFileUploadError(error, {
          context: '文件上传',
          customMessage: '网络连接失败，无法上传文件'
        });
      } else {
        Alert.alert('上传失败', error.message || '文件上传过程中出现错误');
      }
      throw error;
    } finally {
      setIsUploading(false);
      loadingService.hide();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.primaryLight }]}
      onPress={handleFilePick}
      disabled={isUploading}
    >
      <Icon
        name={isUploading ? 'cloud-upload-outline' : 'cloud-upload-outline'}
        size={24}
        color={colors.primary}
      />
      <Text style={[styles.text, { color: colors.text }]}>
        {isUploading ? '上传中...' : '选择文件上传'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  text: {
    marginLeft: 8,
    fontSize: 16,
  },
});

export default FileUploader;