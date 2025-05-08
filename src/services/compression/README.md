# 压缩服务

本目录包含零屿笔记应用的压缩相关服务，用于提供数据压缩和解压缩功能，优化存储空间和传输效率。

## 文件结构

- **compressionService.js**: 压缩服务，提供数据压缩和解压缩功能

## 主要功能

### 压缩服务 (compressionService.js)

压缩服务提供以下主要功能：

- **文本压缩**: 压缩文本数据，减少存储空间
- **二进制数据压缩**: 压缩二进制数据，如图片、音频等
- **文件压缩**: 压缩文件，支持单文件和多文件压缩
- **解压缩**: 解压缩已压缩的数据和文件
- **压缩格式转换**: 在不同压缩格式之间转换
- **压缩级别控制**: 控制压缩级别，平衡压缩率和性能

## 支持的压缩算法

压缩服务支持以下压缩算法：

- **Deflate**: 通用压缩算法，平衡压缩率和性能
- **Gzip**: 基于Deflate的压缩格式，广泛用于Web传输
- **Zlib**: 基于Deflate的压缩库，提供更多控制选项
- **LZ4**: 高速压缩算法，适合需要快速压缩/解压的场景
- **Brotli**: 现代压缩算法，提供更高的压缩率

## 压缩级别

压缩服务提供以下压缩级别选项：

- **无压缩 (0)**: 不进行压缩，仅打包数据
- **快速压缩 (1-3)**: 低压缩率，高速度
- **平衡压缩 (4-6)**: 平衡压缩率和速度
- **高压缩 (7-9)**: 高压缩率，低速度

## 使用场景

压缩服务适用于以下场景：

- **离线数据存储**: 压缩离线存储的数据，减少存储空间占用
- **网络传输**: 压缩网络传输的数据，减少带宽使用和传输时间
- **备份和导出**: 压缩备份和导出的数据，方便存储和分享
- **大文件处理**: 处理大型文件或数据集，提高处理效率

## 与其他服务的交互

压缩服务与以下服务有交互：

- **文件服务**: 用于读取和写入文件
- **存储服务**: 用于存储压缩后的数据
- **导出服务**: 用于导出压缩后的数据
- **同步服务**: 用于同步压缩后的数据

## 使用方法

```javascript
import { compressionService } from '../../services/compression';

// 压缩文本
async function compressText(text) {
  try {
    const compressed = await compressionService.compressText(text);
    console.log('原始大小:', text.length, '字节');
    console.log('压缩后大小:', compressed.length, '字节');
    console.log('压缩率:', (1 - compressed.length / text.length) * 100, '%');
    return compressed;
  } catch (error) {
    console.error('文本压缩失败:', error);
    return null;
  }
}

// 解压缩文本
async function decompressText(compressed) {
  try {
    const decompressed = await compressionService.decompressText(compressed);
    console.log('解压缩后大小:', decompressed.length, '字节');
    return decompressed;
  } catch (error) {
    console.error('文本解压缩失败:', error);
    return null;
  }
}

// 压缩文件
async function compressFile(filePath, outputPath, level = 6) {
  try {
    const result = await compressionService.compressFile(filePath, outputPath, {
      level,
      format: 'gzip'
    });
    console.log('文件压缩成功:', result);
    console.log('原始大小:', result.originalSize, '字节');
    console.log('压缩后大小:', result.compressedSize, '字节');
    console.log('压缩率:', result.compressionRatio, '%');
    return result;
  } catch (error) {
    console.error('文件压缩失败:', error);
    return null;
  }
}

// 解压缩文件
async function decompressFile(filePath, outputPath) {
  try {
    const result = await compressionService.decompressFile(filePath, outputPath);
    console.log('文件解压缩成功:', result);
    return result;
  } catch (error) {
    console.error('文件解压缩失败:', error);
    return null;
  }
}

// 压缩多个文件为一个压缩包
async function compressFiles(filePaths, outputPath, level = 6) {
  try {
    const result = await compressionService.compressFiles(filePaths, outputPath, {
      level,
      format: 'zip'
    });
    console.log('多文件压缩成功:', result);
    console.log('压缩包大小:', result.compressedSize, '字节');
    return result;
  } catch (error) {
    console.error('多文件压缩失败:', error);
    return null;
  }
}

// 解压缩压缩包
async function decompressArchive(archivePath, outputDir) {
  try {
    const result = await compressionService.decompressArchive(archivePath, outputDir);
    console.log('压缩包解压缩成功:', result);
    console.log('解压缩文件数:', result.fileCount);
    return result;
  } catch (error) {
    console.error('压缩包解压缩失败:', error);
    return null;
  }
}
```

## 注意事项

- 压缩和解压缩操作可能是CPU密集型的，应考虑在后台线程中执行
- 对于大文件，应考虑使用流式处理，避免内存溢出
- 不同压缩算法和级别有不同的性能特性，应根据具体需求选择
- 压缩数据应妥善存储和管理，避免数据丢失
- 考虑提供压缩进度反馈，特别是对于大文件操作
