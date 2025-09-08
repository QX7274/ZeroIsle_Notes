/**
 * PDF直接写入服务
 * 实现笔迹直接写入PDF文件的功能
 */

import RNFS from 'react-native-fs';
import { PDFDocument, rgb } from 'pdf-lib';
import { Buffer } from 'buffer';

class PDFDirectWriteService {
  constructor() {
    this.currentPDFPath = null;
    this.annotations = new Map(); // 存储页面注释
  }

  /**
   * 设置当前PDF文件路径
   */
  setCurrentPDF(pdfPath) {
    this.currentPDFPath = pdfPath;
    console.log('PDFDirectWriteService: 设置PDF路径:', pdfPath);
  }

  /**
   * 清空所有注释
   */
  clearAnnotations() {
    this.annotations.clear();
    console.log('PDFDirectWriteService: 已清空所有注释');
  }

  /**
   * 添加笔迹到PDF页面
   */
  async addStrokeToPage(pageNumber, stroke) {
    try {
      if (!this.currentPDFPath) {
        console.warn('PDFDirectWriteService: 未设置PDF路径');
        return false;
      }

      // 获取页面注释
      const pageKey = `page_${pageNumber}`;
      if (!this.annotations.has(pageKey)) {
        this.annotations.set(pageKey, []);
      }

      // 将笔迹转换为PDF注释格式
      const annotation = this.strokeToPDFAnnotation(stroke);
      this.annotations.get(pageKey).push(annotation);

      console.log(`PDFDirectWriteService: 添加笔迹到页面 ${pageNumber}`);
      return true;
    } catch (error) {
      console.error('PDFDirectWriteService: 添加笔迹失败:', error);
      return false;
    }
  }

  /**
   * 将笔迹转换为PDF注释格式
   */
  strokeToPDFAnnotation(stroke) {
    // 简化的PDF注释格式
    return {
      type: 'ink',
      color: stroke.color || '#000000',
      width: stroke.width || 2,
      opacity: stroke.opacity || 1,
      points: stroke.points.map(point => ({
        x: point.x,
        y: point.y
      })),
      timestamp: Date.now()
    };
  }

  /**
   * 将注释添加到PDF页面
   */
  async addAnnotationToPage(page, annotation) {
    try {
      if (annotation.type === 'ink' && annotation.points && annotation.points.length > 0) {
        // 解析颜色
        const color = this.parseColor(annotation.color);

        // 获取页面尺寸
        const { width: pageWidth, height: pageHeight } = page.getSize();

        // 绘制笔迹路径 - 使用线条连接点
        if (annotation.points.length > 1) {
          // 转换坐标系（PDF坐标系原点在左下角）
          const convertedPoints = annotation.points.map(point => ({
            x: point.x,
            y: pageHeight - point.y // 翻转Y轴
          }));

          // 绘制连续的线条
          for (let i = 0; i < convertedPoints.length - 1; i++) {
            const startPoint = convertedPoints[i];
            const endPoint = convertedPoints[i + 1];

            page.drawLine({
              start: { x: startPoint.x, y: startPoint.y },
              end: { x: endPoint.x, y: endPoint.y },
              thickness: annotation.width || 2,
              color: color,
              opacity: annotation.opacity || 1,
            });
          }
        }
      }
    } catch (error) {
      console.error('PDFDirectWriteService: 添加注释到页面失败:', error);
    }
  }

  /**
   * 解析颜色字符串为RGB对象
   */
  parseColor(colorString) {
    try {
      // 移除#号
      const hex = colorString.replace('#', '');

      // 解析RGB值
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      return rgb(r, g, b);
    } catch (error) {
      console.error('PDFDirectWriteService: 解析颜色失败:', error);
      return rgb(0, 0, 0); // 默认黑色
    }
  }



  /**
   * 保存注释到PDF文件
   */
  async saveToPDF() {
    try {
      if (!this.currentPDFPath) {
        console.warn('PDFDirectWriteService: 未设置PDF路径');
        return false;
      }

      // 清理文件路径
      const cleanPath = this.currentPDFPath.replace('file://', '');

      // 读取原始PDF文件
      const existingPdfBytes = await RNFS.readFile(cleanPath, 'base64');
      const pdfDoc = await PDFDocument.load(existingPdfBytes, {
        ignoreEncryption: true // 忽略加密，允许加载加密的PDF
      });

      // 为每个页面添加注释
      for (const [pageKey, annotations] of this.annotations) {
        const pageNumber = parseInt(pageKey.replace('page_', '')) - 1; // PDF页面从0开始

        if (pageNumber >= 0 && pageNumber < pdfDoc.getPageCount()) {
          const page = pdfDoc.getPage(pageNumber);

          // 添加每个注释到页面
          for (const annotation of annotations) {
            await this.addAnnotationToPage(page, annotation);
          }
        }
      }

      // 保存修改后的PDF
      const pdfBytes = await pdfDoc.save();
      const base64String = Buffer.from(pdfBytes).toString('base64');

      // 创建备份
      const backupPath = cleanPath.replace('.pdf', '_backup.pdf');
      await RNFS.copyFile(cleanPath, backupPath);

      // 写入修改后的PDF
      await RNFS.writeFile(cleanPath, base64String, 'base64');

      console.log('PDFDirectWriteService: 笔迹已直接写入PDF文件');

      // 同时保存注释数据作为备份
      const annotationPath = cleanPath.replace('.pdf', '_annotations.json');
      const annotationData = {
        pdfPath: this.currentPDFPath,
        annotations: Object.fromEntries(this.annotations),
        timestamp: Date.now()
      };
      await RNFS.writeFile(annotationPath, JSON.stringify(annotationData, null, 2), 'utf8');

      return true;
    } catch (error) {
      console.error('PDFDirectWriteService: 保存失败:', error);
      return false;
    }
  }

  /**
   * 从PDF文件加载注释
   */
  async loadFromPDF() {
    try {
      if (!this.currentPDFPath) {
        console.warn('PDFDirectWriteService: 未设置PDF路径');
        return [];
      }

      const annotationPath = this.currentPDFPath.replace('.pdf', '_annotations.json');
      
      if (await RNFS.exists(annotationPath)) {
        const annotationData = await RNFS.readFile(annotationPath, 'utf8');
        const data = JSON.parse(annotationData);
        
        // 恢复注释数据
        this.annotations = new Map(Object.entries(data.annotations || {}));
        
        console.log('PDFDirectWriteService: 注释已加载');
        return this.getAllStrokes();
      }

      return [];
    } catch (error) {
      console.error('PDFDirectWriteService: 加载失败:', error);
      return [];
    }
  }

  /**
   * 获取所有笔迹
   */
  getAllStrokes() {
    const allStrokes = [];
    
    for (const [pageKey, annotations] of this.annotations) {
      for (const annotation of annotations) {
        // 将PDF注释转换回笔迹格式
        const stroke = this.pdfAnnotationToStroke(annotation);
        if (stroke) {
          allStrokes.push(stroke);
        }
      }
    }
    
    return allStrokes;
  }

  /**
   * 将PDF注释转换回笔迹格式
   */
  pdfAnnotationToStroke(annotation) {
    try {
      return {
        color: annotation.color,
        width: annotation.width,
        opacity: annotation.opacity,
        points: annotation.points,
        timestamp: annotation.timestamp,
        tool: 'pen' // 默认工具
      };
    } catch (error) {
      console.error('PDFDirectWriteService: 注释转换失败:', error);
      return null;
    }
  }

  /**
   * 清除页面注释
   */
  clearPage(pageNumber) {
    const pageKey = `page_${pageNumber}`;
    this.annotations.delete(pageKey);
    console.log(`PDFDirectWriteService: 清除页面 ${pageNumber} 的注释`);
  }

  /**
   * 清除所有注释
   */
  clearAll() {
    this.annotations.clear();
    console.log('PDFDirectWriteService: 清除所有注释');
  }

  /**
   * 获取页面注释数量
   */
  getPageAnnotationCount(pageNumber) {
    const pageKey = `page_${pageNumber}`;
    return this.annotations.has(pageKey) ? this.annotations.get(pageKey).length : 0;
  }

  /**
   * 获取总注释数量
   */
  getTotalAnnotationCount() {
    let total = 0;
    for (const annotations of this.annotations.values()) {
      total += annotations.length;
    }
    return total;
  }

  /**
   * 导出注释数据
   */
  exportAnnotations() {
    return {
      pdfPath: this.currentPDFPath,
      annotations: Object.fromEntries(this.annotations),
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  /**
   * 导入注释数据
   */
  importAnnotations(data) {
    try {
      if (data.annotations) {
        this.annotations = new Map(Object.entries(data.annotations));
        console.log('PDFDirectWriteService: 注释数据已导入');
        return true;
      }
      return false;
    } catch (error) {
      console.error('PDFDirectWriteService: 导入失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const pdfDirectWriteService = new PDFDirectWriteService();

export default pdfDirectWriteService;
export { PDFDirectWriteService };
