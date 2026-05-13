import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Text } from './Typography';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import DocumentPicker from 'react-native-document-picker';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import { API_URL, API_VERSION } from '../../config';
import ProcessingProgressModal from './ProcessingProgressModal';

/**
 * 创建内容弹窗组件
 *
 * @param {boolean} visible - 是否显示弹窗
 * @param {function} onClose - 关闭弹窗的回调函数
 * @param {function} onCreateNote - 创建笔记的回调函数
 * @param {function} onImportMarkdown - 导入Markdown的回调函数
 * @param {function} onImportPDF - 导入PDF的回调函数
 * @param {function} onImportWord - 导入Word的回调函数
 * @param {function} onCreateCanvas - 创建无限画布的回调函数
 * @param {function} onImportPPT - 导入PPT的回调函数
 * @param {object} navigation - 导航对象
 * @param {function} onFileSelected - 文件选择回调函数
 */
const CreateContentModal = ({
  visible,
  onClose,
  onCreateNote,
  onCreateCardNote,
  onCreateFromTemplate,
  onImportMarkdown,
  onImportPDF,
  onImportWord,
  onCreateCanvas,
  onImportPPT,
  navigation,
  onFileSelected
}) => {
  const { colors } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingStage, setProcessingStage] = useState('');
  const pollingIntervalId = useRef(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (pollingIntervalId.current) {
        clearInterval(pollingIntervalId.current);
      }
    };
  }, []);

  const resetProcessingState = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingMessage('');
    setProcessingStage('');
  };

  const stopPolling = () => {
    if (pollingIntervalId.current) {
      clearInterval(pollingIntervalId.current);
      pollingIntervalId.current = null;
    }
  };

  const pollTaskStatus = (id) => {
    pollingIntervalId.current = setInterval(async () => {
      try {
        const statusEndpoint = `${API_URL}/api/${API_VERSION}${API_ENDPOINTS.DOCUMENT_CONVERTER.STATUS(id)}`;
        const response = await fetch(statusEndpoint);

        if (!response.ok) {
          throw new Error(`状态查询失败(${response.status})`);
        }

        const payload = await response.json();
        const task = payload?.data || payload;

        setProcessingProgress(task?.progress || 0);
        setProcessingMessage(task?.message || '');
        setProcessingStage(task?.stage || 'processing');

        if (task?.status === 'completed' || task?.status === 'failed' || task?.status === 'timeout') {
          stopPolling();
          resetProcessingState();
          if (task?.status === 'completed' && onFileSelected) {
            Alert.alert('成功', '文件处理完成');
            onFileSelected(task.result);
          } else {
            Alert.alert('失败', `文件处理失败: ${task?.error || '未知错误'}`);
          }
          onClose();
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
        stopPolling();
        resetProcessingState();
        Alert.alert('错误', '无法获取处理状态');
        onClose();
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleFileUpload = async (file) => {
    onClose(); // Close the creation modal immediately

    const fileUri = file?.fileCopyUri || file?.uri;
    const fileName = file?.name || `upload_${Date.now()}`;
    const fileType = file?.type || 'application/octet-stream';

    if (!fileUri || typeof fileUri !== 'string') {
      Alert.alert('错误', '文件路径无效，请重新选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: fileType,
    });

    try {
      setIsProcessing(true);
      setProcessingMessage('正在上传文件...');
      setProcessingProgress(0);
      setProcessingStage('uploading');

      // 注意：不要手动设置 multipart/form-data，让 fetch 自动带 boundary
      const uploadEndpoint = `${API_URL}/api/${API_VERSION}${API_ENDPOINTS.DOCUMENT_CONVERTER.CONVERT}`;
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = '未知错误';
        }
        throw new Error(`上传失败(${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (result.success && result.task_id) {
        pollTaskStatus(result.task_id);
      } else {
        throw new Error(result.error || '上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      Alert.alert('错误', `文件上传失败: ${error.message}`);
      resetProcessingState();
    }
  };

  // 导入PDF（优先走外部回调：本地直接导入，不走后端上传）
  const handleImportPDF = async () => {
    if (onImportPDF) {
      onClose();
      onImportPDF();
      return;
    }

    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory',
      });

      const fileUri = result?.fileCopyUri || result?.uri;
      if (!fileUri) {
        throw new Error('无效的PDF文件路径');
      }

      if (onFileSelected) {
        onFileSelected({
          uri: fileUri,
          title: result?.name || 'PDF文档',
          type: 'pdf',
          fileType: 'pdf',
        });
      }
      onClose();
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('导入PDF错误:', err);
        Alert.alert('错误', '导入PDF文件失败。');
      }
    }
  };

  // 导入Word（需要后端转换，优先走上层回调并在离线时提示）
  const handleImportWord = async () => {
    if (onImportWord) {
      try {
        const netState = await NetInfo.fetch();
        const isOnline = !!(netState?.isConnected && netState?.isInternetReachable !== false);
        if (!isOnline) {
          Alert.alert(
            '需要网络连接',
            'Word 导入需要联网上传到服务器进行转换。\n\n请连接网络后重试。',
            [{ text: '我知道了' }]
          );
          return;
        }
      } catch (e) {
        // 网络状态读取失败时放行，由上层处理具体错误
      }

      onClose();
      onImportWord();
      return;
    }

    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.docx, DocumentPicker.types.doc],
        copyTo: 'cachesDirectory',
      });
      await handleFileUpload(result);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('导入Word错误:', err);
        Alert.alert('错误', '导入Word文件失败。');
      }
    }
  };

  // 导入Markdown (txt/md/markdown)
  const handleImportMarkdown = async () => {
    if (onImportMarkdown) { 
      onImportMarkdown(); 
      onClose(); 
      return; 
    }
    try {
      // 使用库内置常量：优先 plainText；若系统不展示 .md，则fallback 到 allFiles 再在客户端做扩展名校验
      let results = await DocumentPicker.pick({
        type: Platform.select({
          ios: ['net.daringfireball.markdown', DocumentPicker.types.plainText],
          android: ['text/markdown', 'text/plain']
        }),
        allowMultiSelection: false,
        mode: 'open',
        copyTo: 'cachesDirectory',
      });

      // 如果用户选择了非预期扩展，或找不到 md，则允许用 allFiles 重新选择
      const okExt = (name='') => /\.(md|markdown|txt)$/i.test(name);
      if (!results || results.length === 0 || !okExt(results[0]?.name || results[0]?.fileCopyUri || '')) {
        try {
          results = await DocumentPicker.pick({ 
            type: [DocumentPicker.types.allFiles], 
            allowMultiSelection: false, 
            mode: 'open', 
            copyTo: 'cachesDirectory' 
          });
        } catch (e) {
          // 用户取消 fallback，忽略
        }
      }

      if (results && results.length > 0) {
        const picked = results[0];
        if (!okExt(picked.name || picked.fileCopyUri || '')) {
          Alert.alert('不支持的文件', '请选择 .md / .markdown / .txt 文件');
        } else {
          console.log('选择的Markdown文件:', picked);
          // 补充：调用文件上传逻辑（原代码遗漏）
          await handleFileUpload(picked);
        }
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Markdown错误:', err);
        Alert.alert('错误', '导入Markdown文件失败。');
      }
      onClose();
    }
  };

  // 导入PPT
  const handleImportPPT = async () => {
    if (onImportPPT) { 
      onImportPPT(); 
      onClose(); 
      return; 
    }
    try {
      // 使用平台可识别的类型字符串：Android 用 MIME；iOS 用 UTI
      const pptTypes = Platform.select({
        android: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ios: ['com.microsoft.powerpoint.ppt', 'org.openxmlformats.presentationml.presentation']
      });
      let results = await DocumentPicker.pick({ 
        type: pptTypes, 
        allowMultiSelection: false, 
        mode: 'open', 
        copyTo: 'cachesDirectory' 
      });

      const okExt = (name='') => /\.(ppt|pptx)$/i.test(name);
      if (results && results.length > 0) {
        const picked = results[0];
        if (!okExt(picked.name || picked.fileCopyUri || '')) {
          console.warn('系统未按扩展过滤，但已选择：', picked?.name);
        }
        console.log('选择的PPT文件:', picked);

        // 处理选择的PPT文件
        const fileUri = picked.fileCopyUri || picked.uri;
        const fileName = picked.name || 'PPT文档';

        // 导航到PPT查看器
        if (navigation) {
          navigation.navigate('FileViewer', {
            uri: fileUri,
            title: fileName,
            type: 'powerpoint'
          });
        } else if (onFileSelected) {
          onFileSelected({
            uri: fileUri,
            title: fileName,
            type: 'powerpoint',
            fileType: 'ppt'
          });
        }

        onClose();
        return;
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PPT错误:', err);
        Alert.alert('错误', '导入PPT文件失败，请重试');
      }
      onClose();
    }
  };

  return (
    <>
      <ProcessingProgressModal
        visible={isProcessing}
        progress={processingProgress}
        message={processingMessage}
        stage={processingStage}
        cancelable={false} // Optionally allow cancellation
      />
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
          testID="overlay.createContent"
        >
          <View
            style={[styles.modalContainer, { backgroundColor: colors.card }]}
            testID="modal.createContent"
          >
            <Text
              variant="heading"
              level="h6"
              style={styles.modalTitle}
            >
              创建内容
            </Text>

            {/* 新建笔记 */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                if (onCreateNote) onCreateNote();
              }}
              testID="action.createContent.note"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcon name="note-add" size={24} color="#1976D2" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                新建笔记
              </Text>
            </TouchableOpacity>

            {/* 从模板新建 */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                if (onCreateFromTemplate) onCreateFromTemplate();
              }}
              testID="action.createContent.template"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#F3E5F5' }]}>
                <MaterialIcon name="file-copy" size={24} color="#8E24AA" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                从模板新建
              </Text>
            </TouchableOpacity>

            {/* 卡片笔记 */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                if (onCreateCardNote) onCreateCardNote();
              }}
              testID="action.createContent.cardNote"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FFF3E0' }]}>
                <MaterialIcon name="credit-card" size={24} color="#F57C00" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                卡片笔记
              </Text>
            </TouchableOpacity>

            {/* 导入Markdown */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleImportMarkdown}
              testID="action.createContent.importMarkdown"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialIcon name="notes" size={24} color="#388E3C" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                导入Markdown(txt)
              </Text>
            </TouchableOpacity>

            {/* 导入PDF */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleImportPDF}
              testID="action.createContent.importPdf"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FFEBEE' }]}>
                <MaterialIcon name="picture-as-pdf" size={24} color="#D32F2F" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                导入PDF
              </Text>
            </TouchableOpacity>
            
            {/* 导入PPT */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleImportPPT}
              testID="action.createContent.importPpt"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#FFF8E1' }]}>
                <MaterialIcon name="slideshow" size={24} color="#F57C00" />
              </View>
              <Text variant="body" size="medium" style={styles.optionText}>导入PPT</Text>
            </TouchableOpacity>
            
            {/* 导入Word */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleImportWord}
              testID="action.createContent.importWord"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcon name="article" size={24} color="#1976D2" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                导入Word
              </Text>
            </TouchableOpacity>

            {/* 无限画布 */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                onClose();
                if (onCreateCanvas) onCreateCanvas();
              }}
              testID="action.createContent.canvas"
            >
              <View style={[styles.optionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialIcon name="dashboard" size={24} color="#388E3C" />
              </View>
              <Text
                variant="body"
                size="medium"
                style={styles.optionText}
              >
                无限画布
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 20,
    fontWeight: '700',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  }
});

export default CreateContentModal;
