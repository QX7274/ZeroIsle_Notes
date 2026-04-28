import { NativeModules } from 'react-native';

const { NativePDFModule } = NativeModules;

/**
 * 从PDF文件中提取纯文本内容
 * @param {string} uri - PDF文件的URI
 * @returns {Promise<Array<{page: number, text: string}>>} - 一个包含每页文本的对象数组
 */
const extractText = async (uri) => {
  try {
    if (!uri) {throw new Error('URI is required.');}
    const filePath = uri.replace('file://', '');

    if (NativePDFModule && typeof NativePDFModule.extractText === 'function') {
      const pagesText = await NativePDFModule.extractText(filePath);
      return pagesText;
    } else {
      throw new Error('NativePDFModule.extractText is not available.');
    }
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    throw error;
  }
};

export default {
  extractText,
};

