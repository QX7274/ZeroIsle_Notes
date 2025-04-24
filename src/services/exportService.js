import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import RNShare from 'react-native-share';
import { analyticsService } from './analytics';

class ExportService {
  async exportToPDF(content, title) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
              body { font-family: Arial; padding: 20px; }
              h1 { color: #333; }
              p { line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div>${content.replace(/\n/g, '<br>')}</div>
          </body>
        </html>
      `;

      const options = {
        html,
        fileName: `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        directory: 'Documents',
      };
      
      const { filePath } = await RNHTMLtoPDF.convert(options);
      if (!filePath) throw new Error('PDF 生成失败');

      await this.shareFile(filePath, `${title}.pdf`, 'application/pdf');
      analyticsService.trackExport('pdf', { title });
    } catch (error) {
      console.error('导出 PDF 失败:', error);
      analyticsService.trackError(error, { action: 'export_pdf' });
      throw error;
    }
  }

  async exportToWord(content, title) {
    try {
      const docxContent = `
        <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:r>
                <w:t>${title}</w:t>
              </w:r>
            </w:p>
            <w:p>
              <w:r>
                <w:t>${content.replace(/\n/g, '</w:t><w:br/><w:t>')}</w:t>
              </w:r>
            </w:p>
          </w:body>
        </w:document>
      `;

      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.docx`;
      const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      await RNFS.writeFile(filePath, docxContent, 'utf8');
      await this.shareFile(filePath, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      analyticsService.trackExport('word', { title });
    } catch (error) {
      console.error('导出 Word 失败:', error);
      analyticsService.trackError(error, { action: 'export_word' });
      throw error;
    }
  }

  async shareFile(filePath, fileName, mimeType) {
    try {
      const shareOptions = {
        url: `${Platform.OS === 'android' ? 'file://' : ''}${filePath}`,
        type: mimeType,
        title: fileName,
        failOnCancel: false,
        showAppsToView: true,
      };

      await RNShare.open(shareOptions);
    } catch (error) {
      console.error('文件分享失败:', error);
      throw error;
    }
  }
}

export const exportService = new ExportService();