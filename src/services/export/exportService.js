import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import PDFLib, { PDFDocument, PDFPage } from 'react-native-pdf-lib';
import RNShare from 'react-native-share';
import { analyticsService } from '../analytics/analyticsService';

class ExportService {
  async exportToPDF(content, title) {
    try {
      // 创建PDF页面
      const page = PDFPage
        .create()
        .setMediaBox(595, 842) // A4尺寸 (595 x 842 points)
        .drawText(title, {
          x: 50,
          y: 800,
          color: '#333333',
          fontSize: 24,
          fontName: 'Times New Roman',
        });

      // 将内容分行处理
      const lines = content.split('\n');
      let yPosition = 750; // 从标题下方开始写入内容

      for (const line of lines) {
        if (line.trim() === '') {
          // 空行，增加一些间距
          yPosition -= 20;
          continue;
        }

        // 绘制文本
        page.drawText(line, {
          x: 50,
          y: yPosition,
          color: '#000000',
          fontSize: 12,
          fontName: 'Times New Roman',
        });
        yPosition -= 20; // 行间距
        yPosition -= 20; // 行间距

        // 如果到达页面底部，可以在这里添加新页面的逻辑
        if (yPosition < 50) {
          // 这里可以添加新页面的代码
          break;
        }
      }

      // 获取文档目录
      const docsDir = await PDFLib.getDocumentsDirectory();
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      const filePath = `${docsDir}/${fileName}`;

      // 创建PDF文档并写入
      const pdfPath = await PDFDocument
        .create(filePath)
        .addPages(page)
        .write();

      if (!pdfPath) throw new Error('PDF 生成失败');

      await this.shareFile(pdfPath, `${title}.pdf`, 'application/pdf');
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
