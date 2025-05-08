# 导出服务

本目录包含零屿笔记应用的导出相关服务，用于将应用数据导出为各种格式，方便分享和备份。

## 文件结构

- **exportService.js**: 导出服务，提供数据导出功能

## 主要功能

### 导出服务 (exportService.js)

导出服务提供以下主要功能：

- **笔记导出**: 将笔记导出为各种格式（如PDF、Markdown、HTML等）
- **知识图谱导出**: 将知识图谱导出为图片或可交互格式
- **思维导图导出**: 将思维导图导出为图片或可交互格式
- **数据备份**: 创建应用数据的完整备份
- **批量导出**: 支持批量导出多个项目
- **导出设置**: 提供导出选项和自定义设置

## 支持的导出格式

导出服务支持以下导出格式：

### 文本格式

- **PDF**: 便于打印和分享的文档格式
- **Markdown**: 适合在其他Markdown编辑器中使用
- **HTML**: 可在浏览器中查看的网页格式
- **纯文本 (TXT)**: 最基本的文本格式
- **RTF**: 富文本格式，保留基本格式

### 图像格式

- **PNG**: 无损图像格式，适合截图和图表
- **JPEG**: 有损图像格式，适合照片
- **SVG**: 矢量图形格式，适合图表和图形

### 数据格式

- **JSON**: 结构化数据格式，适合数据交换
- **XML**: 可扩展标记语言，适合结构化数据
- **CSV**: 逗号分隔值，适合表格数据
- **XLSX**: Excel电子表格格式，适合表格数据

### 专用格式

- **ZEROISLENOTE**: 零屿笔记专用格式，保留所有功能和格式
- **MINDMAP**: 思维导图专用格式，可在其他思维导图软件中打开
- **KNOWLEDGEGRAPH**: 知识图谱专用格式，可在其他知识图谱软件中打开

## 导出选项

导出服务提供以下导出选项：

- **格式选择**: 选择导出格式
- **内容选择**: 选择要导出的内容（如是否包含图片、附件等）
- **样式设置**: 设置导出文档的样式（如字体、颜色、页面大小等）
- **元数据设置**: 设置导出文档的元数据（如标题、作者、创建日期等）
- **加密选项**: 设置导出文档的加密和密码保护
- **压缩选项**: 设置导出文件的压缩方式和级别

## 与其他服务的交互

导出服务与以下服务有交互：

- **文件服务**: 用于读取和写入文件
- **压缩服务**: 用于压缩导出的文件
- **存储服务**: 用于存储导出的文件
- **分享服务**: 用于分享导出的文件

## 使用方法

```javascript
import { exportService } from '../../services/export';

// 导出笔记为PDF
async function exportNoteToPDF(noteId, outputPath, options = {}) {
  try {
    const result = await exportService.exportNote(noteId, {
      format: 'pdf',
      outputPath,
      includeImages: true,
      includeAttachments: false,
      pageSize: 'A4',
      ...options
    });
    
    console.log('笔记导出为PDF成功:', result);
    return result;
  } catch (error) {
    console.error('笔记导出为PDF失败:', error);
    return null;
  }
}

// 导出笔记为Markdown
async function exportNoteToMarkdown(noteId, outputPath, options = {}) {
  try {
    const result = await exportService.exportNote(noteId, {
      format: 'markdown',
      outputPath,
      includeImages: true,
      imageExportMode: 'base64',
      ...options
    });
    
    console.log('笔记导出为Markdown成功:', result);
    return result;
  } catch (error) {
    console.error('笔记导出为Markdown失败:', error);
    return null;
  }
}

// 导出知识图谱为图片
async function exportKnowledgeGraphToImage(graphId, outputPath, options = {}) {
  try {
    const result = await exportService.exportKnowledgeGraph(graphId, {
      format: 'png',
      outputPath,
      resolution: 'high',
      includeLabels: true,
      ...options
    });
    
    console.log('知识图谱导出为图片成功:', result);
    return result;
  } catch (error) {
    console.error('知识图谱导出为图片失败:', error);
    return null;
  }
}

// 导出思维导图为图片
async function exportMindMapToImage(mindMapId, outputPath, options = {}) {
  try {
    const result = await exportService.exportMindMap(mindMapId, {
      format: 'png',
      outputPath,
      resolution: 'high',
      includeLabels: true,
      ...options
    });
    
    console.log('思维导图导出为图片成功:', result);
    return result;
  } catch (error) {
    console.error('思维导图导出为图片失败:', error);
    return null;
  }
}

// 创建数据备份
async function createBackup(outputPath, options = {}) {
  try {
    const result = await exportService.createBackup({
      outputPath,
      includeNotes: true,
      includeKnowledgeGraphs: true,
      includeMindMaps: true,
      includeSettings: true,
      encrypt: true,
      password: 'your-secure-password',
      ...options
    });
    
    console.log('数据备份创建成功:', result);
    return result;
  } catch (error) {
    console.error('数据备份创建失败:', error);
    return null;
  }
}

// 批量导出笔记
async function batchExportNotes(noteIds, outputDir, format = 'pdf', options = {}) {
  try {
    const results = await exportService.batchExportNotes(noteIds, {
      format,
      outputDir,
      ...options
    });
    
    console.log('批量导出笔记成功:', results.length, '个笔记已导出');
    return results;
  } catch (error) {
    console.error('批量导出笔记失败:', error);
    return [];
  }
}
```

## 注意事项

- 导出大文件可能需要较长时间，应提供进度反馈
- 导出过程中应处理各种错误情况，如磁盘空间不足、权限问题等
- 导出敏感数据时应考虑加密和安全问题
- 导出格式应考虑兼容性，确保在其他软件中可以正确打开
- 导出服务应支持取消操作，允许用户中断长时间的导出过程
