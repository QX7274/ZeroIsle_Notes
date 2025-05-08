# 文件服务

本目录包含零屿笔记应用的文件相关服务，用于管理文件的读写、复制、移动、删除等操作。

## 文件结构

- **fileService.js**: 文件服务，提供文件操作功能

## 主要功能

### 文件服务 (fileService.js)

文件服务提供以下主要功能：

- **文件读写**: 读取和写入文件内容
- **目录操作**: 创建、读取、删除目录
- **文件复制移动**: 复制和移动文件
- **文件删除**: 删除文件
- **文件信息**: 获取文件信息（大小、修改时间等）
- **文件存在检查**: 检查文件是否存在
- **文件类型检测**: 检测文件类型和MIME类型
- **文件路径管理**: 管理应用内的文件路径

## 文件目录结构

文件服务管理以下主要目录：

- **文档目录 (DocumentDirectory)**: 存储应用文档和用户数据
- **缓存目录 (CacheDirectory)**: 存储临时文件和缓存
- **外部目录 (ExternalDirectory)**: 在Android上访问外部存储
- **下载目录 (DownloadDirectory)**: 在Android上访问下载目录

## 文件操作

### 文件读写操作

文件服务提供以下文件读写操作：

- **读取文件**: 读取文件内容，支持文本和二进制模式
- **写入文件**: 写入文件内容，支持文本和二进制模式
- **追加文件**: 向文件末尾追加内容
- **读取目录**: 读取目录内容，获取文件和子目录列表

### 文件管理操作

文件服务提供以下文件管理操作：

- **复制文件**: 将文件从一个位置复制到另一个位置
- **移动文件**: 将文件从一个位置移动到另一个位置
- **删除文件**: 删除文件
- **创建目录**: 创建新目录
- **删除目录**: 删除目录及其内容
- **获取文件信息**: 获取文件大小、修改时间等信息
- **检查文件存在**: 检查文件或目录是否存在

## 与其他服务的交互

文件服务与以下服务有交互：

- **分析服务 (analyticsService)**: 用于跟踪文件操作和错误
- **存储服务**: 用于管理文件存储
- **压缩服务**: 用于处理压缩文件
- **导出服务**: 用于导出文件

## 使用方法

```javascript
import { fileService } from '../../services/file';

// 读取文件内容
async function readFileContent(filePath) {
  try {
    const content = await fileService.readFile(filePath);
    console.log('文件内容:', content);
    return content;
  } catch (error) {
    console.error('读取文件失败:', error);
    return null;
  }
}

// 写入文件内容
async function writeFileContent(filePath, content) {
  try {
    await fileService.writeFile(filePath, content);
    console.log('文件写入成功');
    return true;
  } catch (error) {
    console.error('写入文件失败:', error);
    return false;
  }
}

// 读取目录内容
async function readDirectoryContent(dirPath) {
  try {
    const items = await fileService.readDir(dirPath);
    console.log('目录内容:', items);
    return items;
  } catch (error) {
    console.error('读取目录失败:', error);
    return [];
  }
}
```

## 注意事项

- 文件操作可能是耗时的，应考虑在后台线程中执行
- 文件路径应使用平台无关的方式构建，避免硬编码路径分隔符
- 应处理文件操作中的各种错误，如权限不足、磁盘空间不足等
- 对于大文件，应考虑使用流式处理，避免内存溢出
- 定期清理缓存目录，避免占用过多存储空间
- 注意文件命名冲突，可使用时间戳或UUID生成唯一文件名
