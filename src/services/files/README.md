# 文件服务

本目录包含零屿笔记应用的文件相关服务，用于管理文件的读写、复制、移动、删除等操作，以及文件在Realm数据库中的存储和管理。

## 文件结构

- **realmFileService.js**: Realm文件服务，提供文件在Realm数据库中的CRUD操作
- **fileService.js**: 原生文件服务，提供文件系统操作功能，包括与Firebase存储的集成
- **index.js**: 文件服务索引，导出所有文件相关服务

## 主要功能

### Realm文件服务 (realmFileService.js)

Realm文件服务提供以下主要功能：

- **文件创建**: 在Realm数据库中创建文件记录
- **文件更新**: 更新Realm数据库中的文件记录
- **文件删除**: 软删除或永久删除Realm数据库中的文件记录
- **文件恢复**: 恢复已删除的文件记录
- **文件查询**: 查询文件记录，支持按ID、笔记ID、文件类型等查询
- **文件搜索**: 搜索文件记录，支持关键词搜索
- **文件路径管理**: 管理文件存储路径

### 原生文件服务 (fileService.js)

原生文件服务提供以下主要功能：

- **文件读写**: 读取和写入文件内容
- **目录操作**: 创建、读取、删除目录
- **文件复制移动**: 复制和移动文件
- **文件删除**: 删除文件
- **文件元数据**: 获取文件信息（大小、修改时间等）
- **文件存在检查**: 检查文件是否存在
- **文件类型检测**: 检测文件类型和MIME类型
- **文件路径管理**: 管理应用内的文件路径
- **文件下载上传**: 下载文件和上传到Firebase存储
- **文件分享**: 分享文件到其他应用
- **进度监控**: 监控文件上传下载进度

## 文件目录结构

文件服务管理以下主要目录：

- **文档目录 (DocumentDirectory)**: 存储应用文档和用户数据
- **缓存目录 (CacheDirectory)**: 存储临时文件和缓存
- **外部目录 (ExternalDirectory)**: 在Android上访问外部存储
- **下载目录 (DownloadDirectory)**: 在Android上访问下载目录

## 文件操作

### Realm文件操作

Realm文件服务提供以下文件操作：

- **创建文件**: 在Realm数据库中创建文件记录
- **更新文件**: 更新Realm数据库中的文件记录
- **删除文件**: 软删除或永久删除Realm数据库中的文件记录
- **恢复文件**: 恢复已删除的文件记录
- **获取文件**: 获取文件记录，支持按ID、笔记ID、文件类型等获取
- **搜索文件**: 搜索文件记录，支持关键词搜索

### 原生文件操作

原生文件服务提供以下文件操作：

- **读取文件**: 读取文件内容，支持文本和二进制模式
- **写入文件**: 写入文件内容，支持文本和二进制模式
- **删除文件**: 删除文件
- **复制文件**: 将文件从一个位置复制到另一个位置
- **移动文件**: 将文件从一个位置移动到另一个位置
- **创建目录**: 创建新目录
- **读取目录**: 读取目录内容，获取文件和子目录列表
- **获取文件信息**: 获取文件大小、修改时间等信息
- **检查文件存在**: 检查文件或目录是否存在
- **下载文件**: 从URL下载文件
- **上传文件**: 将文件上传到服务器
- **分享文件**: 分享文件到其他应用

## 与其他服务的交互

文件服务与以下服务有交互：

- **分析服务 (analyticsService)**: 用于跟踪文件操作和错误
- **数据库服务 (realmService)**: 用于管理文件在Realm数据库中的存储
- **事件服务 (EventEmitter)**: 用于发送文件操作事件

## 使用方法

### 使用Realm文件服务

```javascript
import { realmFileService } from '../../services/files';

// 创建文件
async function createFile(fileData) {
  try {
    const file = await realmFileService.createFile({
      file_name: 'example.txt',
      file_path: '/path/to/file.txt',
      file_type: 'text',
      file_size: 1024,
      mime_type: 'text/plain',
    });
    console.log('文件创建成功:', file);
    return file;
  } catch (error) {
    console.error('创建文件失败:', error);
    return null;
  }
}

// 获取文件
async function getFile(fileId) {
  try {
    const file = await realmFileService.getFileById(fileId);
    console.log('文件详情:', file);
    return file;
  } catch (error) {
    console.error('获取文件失败:', error);
    return null;
  }
}
```

### 使用原生文件服务

```javascript
import { fileService } from '../../services/files';

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

// 上传文件到Firebase
async function uploadToFirebase(localPath, remotePath) {
  try {
    const downloadUrl = await fileService.uploadFileToFirebase(localPath, remotePath, (progress) => {
      console.log('上传进度:', Math.round(progress * 100), '%');
    });
    console.log('文件上传成功，下载URL:', downloadUrl);
    return downloadUrl;
  } catch (error) {
    console.error('文件上传失败:', error);
    return null;
  }
}

// 从URL下载文件
async function downloadFile(url, destinationPath) {
  try {
    await fileService.downloadFileFromURL(url, destinationPath, (progress) => {
      console.log('下载进度:', Math.round(progress * 100), '%');
    });
    console.log('文件下载成功');
    return true;
  } catch (error) {
    console.error('文件下载失败:', error);
    return false;
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
- Realm文件服务和原生文件服务应协同工作，确保文件记录和实际文件的一致性