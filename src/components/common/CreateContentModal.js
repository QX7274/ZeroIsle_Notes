import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native';
import { Text } from './Typography';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import DocumentPicker from 'react-native-document-picker';

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
 */
const CreateContentModal = ({
  visible,
  onClose,
  onCreateNote,
  onImportMarkdown,
  onImportPDF,
  onImportWord,
  onCreateCanvas,
  onImportPPT
}) => {
  const { colors } = useTheme();

  // 导入PDF
  const handleImportPDF = async () => {
    if (onImportPDF) {
      onImportPDF();
    } else {
      try {
        const results = await DocumentPicker.pick({
          type: [DocumentPicker.types.pdf],
          allowMultiSelection: false,
          // 确保使用正确的API获取文件访问权限
          mode: 'open',
          copyTo: 'cachesDirectory',
        });

        if (results && results.length > 0) {
          console.log('选择的PDF文件:', results[0]);
          // 这里可以添加默认的PDF导入逻辑
        }
      } catch (err) {
        if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
          console.error('导入PDF错误:', err);
        }
      }
    }
    onClose();
  };

  // 导入Word
  const handleImportWord = async () => {
    if (onImportWord) {
      onImportWord();
    } else {
      try {
        const results = await DocumentPicker.pick({
          type: [DocumentPicker.types.docx, DocumentPicker.types.doc],
          allowMultiSelection: false,
          mode: 'open',
          copyTo: 'cachesDirectory',
        });
        if (results && results.length > 0) {
          console.log('选择的Word文件:', results[0]);
        }
      } catch (err) {
        if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
          console.error('导入Word错误:', err);
        }
      }
    }
    onClose();
  };


  // 导入Markdown (txt/md/markdown)
  const handleImportMarkdown = async () => {
    if (onImportMarkdown) { onImportMarkdown(); onClose(); return; }
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
          results = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles], allowMultiSelection: false, mode: 'open', copyTo: 'cachesDirectory' });
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
        }
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Markdown错误:', err);
      }
    }
    onClose();
  };

  // 导入PPT
  const handleImportPPT = async () => {
    if (onImportPPT) { onImportPPT(); onClose(); return; }
    try {
      // 使用平台可识别的类型字符串：Android 用 MIME；iOS 用 UTI
      const pptTypes = Platform.select({
        android: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ios: ['com.microsoft.powerpoint.ppt', 'org.openxmlformats.presentationml.presentation']
      });
      let results = await DocumentPicker.pick({ type: pptTypes, allowMultiSelection: false, mode: 'open', copyTo: 'cachesDirectory' });

      const okExt = (name='') => /\.(ppt|pptx)$/i.test(name);
      if (results && results.length > 0) {
        const picked = results[0];
        if (!okExt(picked.name || picked.fileCopyUri || '')) {
          console.warn('系统未按扩展过滤，但已选择：', picked?.name);
        }
        console.log('选择的PPT文件:', picked);
      }
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PPT错误:', err);
      }
    }
    onClose();
  };

  return (
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
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
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
          >
            <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcon name="description" size={24} color="#1976D2" />
            </View>
            <Text
              variant="body"
              size="medium"
              style={styles.optionText}
            >
              新建笔记
            </Text>
          </TouchableOpacity>

          {/* 导入Markdown */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={handleImportMarkdown}
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
