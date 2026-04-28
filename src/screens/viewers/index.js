/**
 * 查看器模块导出文件
 * 集中导出所有查看器相关屏幕
 * 注意：旧的JS实现已移除，现在使用原生实现
 */

import PDFViewerNative from './PDFViewerNative';
import DocViewer from './DocViewer';
import MarkdownViewer from './MarkdownViewer';
import PPTViewer from './PPTViewer';

export {
  PDFViewerNative,
  PDFViewerNative as PDFViewer, // 保持向后兼容
  DocViewer,
  MarkdownViewer,
  PPTViewer,
};

export default {
  PDFViewer: PDFViewerNative,
  DocViewer,
  MarkdownViewer,
  PPTViewer,
};
