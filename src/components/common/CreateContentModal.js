import React from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions
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
 * @param {function} onCreateLinedNote - 创建横式笔记的回调函数
 * @param {function} onImportPDF - 导入PDF的回调函数
 * @param {function} onImportWord - 导入Word的回调函数
 * @param {function} onCreateCanvas - 创建无限画布的回调函数
 */
const CreateContentModal = ({
  visible,
  onClose,
  onCreateNote,
  onCreateLinedNote,
  onImportPDF,
  onImportWord,
  onCreateCanvas
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
        });

        if (results && results.length > 0) {
          console.log('选择的Word文件:', results[0]);
          // 这里可以添加默认的Word导入逻辑
        }
      } catch (err) {
        if (err.code !== 'DOCUMENT_PICKER_CANCELED') {
          console.error('导入Word错误:', err);
        }
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

          {/* 横式笔记 */}
          <TouchableOpacity
            style={styles.optionItem}
            onPress={() => {
              onClose();
              if (onCreateLinedNote) onCreateLinedNote();
            }}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#E8F5E9' }]}>
              <MaterialIcon name="subject" size={24} color="#388E3C" />
            </View>
            <Text
              variant="body"
              size="medium"
              style={styles.optionText}
            >
              横式笔记
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
