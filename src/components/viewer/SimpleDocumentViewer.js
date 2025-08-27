import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, Text, TouchableOpacity } from 'react-native';
import OpenFile from 'react-native-doc-viewer';
import RNFS from 'react-native-fs';
import { useTheme } from '../../context/ThemeContext';
import LoadingIndicator from '../common/LoadingIndicator';

/**
 * 简单文档查看器组件
 * 使用react-native-document-viewer提供快速的文档预览功能
 * 支持Word、PPT、Excel等多种格式
 */
const SimpleDocumentViewer = ({ 
  uri, 
  fileName, 
  fileType, 
  onError,
  onLoadStart,
  onLoadEnd 
}) => {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localPath, setLocalPath] = useState(null);

  useEffect(() => {
    if (uri) {
      loadDocument();
    }
  }, [uri]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);
      onLoadStart && onLoadStart();

      console.log('SimpleDocumentViewer: 开始加载文档:', { uri, fileName, fileType });

      let documentPath = uri;

      // 如果是content://协议，需要复制到本地
      if (uri.startsWith('content://')) {
        console.log('SimpleDocumentViewer: 检测到content://协议，使用持久化服务');

        try {
          const filePersistenceService = require('../../services/files/filePersistenceService').default;
          const persistedFile = await filePersistenceService.persistFile(
            uri,
            fileName || `document_${Date.now()}`,
            fileType || 'document'
          );

          documentPath = persistedFile.localPath;
          setLocalPath(persistedFile.localPath);

          console.log('SimpleDocumentViewer: 文件持久化完成:', persistedFile.localPath);
        } catch (persistError) {
          console.error('SimpleDocumentViewer: 文件持久化失败，回退到缓存目录:', persistError);

          // 如果持久化失败，回退到原来的缓存目录方式
          const fileExtension = getFileExtension(fileName || fileType);
          const localFileName = `document_${Date.now()}.${fileExtension}`;
          const localFilePath = `${RNFS.CachesDirectoryPath}/${localFileName}`;

          // 复制文件到本地
          await RNFS.copyFile(uri, localFilePath);
          documentPath = localFilePath;
          setLocalPath(localFilePath);

          console.log('SimpleDocumentViewer: 文件复制到缓存目录完成:', localFilePath);
        }
      }

      // 使用react-native-doc-viewer打开文档

      await OpenFile.openDoc([{
        url: documentPath,
        fileName: fileName || `document.${getFileExtension(fileType)}`,
        cache: true,
        fileType: fileType
      }], (error, url) => {
        if (error) {
          console.error('SimpleDocumentViewer: 打开文档失败:', error);
          throw error;
        } else {
          console.log('SimpleDocumentViewer: 文档打开成功:', url);
        }
      });

      console.log('SimpleDocumentViewer: 文档打开成功');
      onLoadEnd && onLoadEnd();

    } catch (error) {
      console.error('SimpleDocumentViewer: 文档加载失败:', error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      onError && onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileExtension = (fileNameOrType) => {
    if (!fileNameOrType) return 'pdf';
    
    if (fileNameOrType.includes('.')) {
      return fileNameOrType.split('.').pop().toLowerCase();
    }
    
    // 根据文件类型返回扩展名
    const typeMap = {
      'word': 'docx',
      'doc': 'doc',
      'docx': 'docx',
      'powerpoint': 'pptx',
      'ppt': 'ppt',
      'pptx': 'pptx',
      'excel': 'xlsx',
      'xls': 'xls',
      'xlsx': 'xlsx'
    };
    
    return typeMap[fileNameOrType.toLowerCase()] || 'pdf';
  };

  const getErrorMessage = (error) => {
    const errorStr = String(error);
    
    if (errorStr.includes('No app found')) {
      return '没有找到可以打开此文档的应用程序。请安装相应的办公软件。';
    } else if (errorStr.includes('Permission')) {
      return '没有权限访问该文件。请检查文件权限设置。';
    } else if (errorStr.includes('File not found')) {
      return '文件不存在或已被删除。';
    } else if (errorStr.includes('Network')) {
      return '网络连接问题，无法加载文档。';
    }
    
    return '文档加载失败，请重试或使用其他应用打开。';
  };

  const retryLoad = () => {
    loadDocument();
  };

  const openWithExternalApp = async () => {
    try {
      if (localPath || uri) {
        const path = localPath || uri;
        await OpenFile.openDoc([{
          url: path,
          fileName: fileName || `document.${getFileExtension(fileType)}`,
          cache: true,
          fileType: fileType
        }], (error, url) => {
          if (error) {
            console.error('SimpleDocumentViewer: 外部打开失败:', error);
            Alert.alert('错误', '无法打开外部应用程序');
          } else {
            console.log('SimpleDocumentViewer: 外部打开成功:', url);
          }
        });
      }
    } catch (error) {
      console.error('SimpleDocumentViewer: 外部打开异常:', error);
      Alert.alert('错误', '无法打开外部应用程序');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator 
          message="正在加载文档..."
          subMessage="请稍候，正在准备文档查看器"
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.errorBox, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Text style={[styles.errorTitle, { color: colors.error }]}>文档加载失败</Text>
          <Text style={[styles.errorMessage, { color: colors.onSurface }]}>{error}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={retryLoad}
            >
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>重试</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.externalButton, { backgroundColor: colors.secondary }]}
              onPress={openWithExternalApp}
            >
              <Text style={[styles.buttonText, { color: colors.onSecondary }]}>用其他应用打开</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // 文档已成功打开，显示提示信息
  return (
    <View style={[styles.container, styles.successContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.successBox, { backgroundColor: colors.surface }]}>
        <Text style={[styles.successTitle, { color: colors.primary }]}>文档已打开</Text>
        <Text style={[styles.successMessage, { color: colors.onSurface }]}>
          文档已在外部应用中打开。如果没有自动打开，请点击下方按钮。
        </Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.openButton, { backgroundColor: colors.primary }]}
          onPress={openWithExternalApp}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>重新打开</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    justifyContent: 'center',
  },
  successContainer: {
    justifyContent: 'center',
  },
  errorBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 400,
    width: '100%',
  },
  successBox: {
    padding: 24,
    borderRadius: 12,
    maxWidth: 400,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButton: {
    marginRight: 6,
  },
  externalButton: {
    marginLeft: 6,
  },
  openButton: {
    alignSelf: 'center',
    minWidth: 120,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SimpleDocumentViewer;
