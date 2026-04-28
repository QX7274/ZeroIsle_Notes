# 文档转换服务

这是一个基于Django和Celery的异步文档转换服务，支持将多种办公文档格式转换为PDF，并提供丰富的功能扩展。

## 功能特性

- ✅ **多格式转PDF**: 支持 `.doc`, `.docx`, `.ppt`, `.pptx` 等格式，并对 `.md`, `.txt`, `.html` 提供优化路径。
- ✅ **异步任务处理**: 基于Celery，上传后立即返回任务ID，不阻塞请求。
- ✅ **两种转换模式**: `lite` (轻量，文本优先) 和 `loffice` (高保真)。
- ✅ **对象存储集成**: 支持S3/MinIO，自动生成预签名URL，实现安全下载。
- ✅ **PDF缩略图生成**: 自动生成PDF首页缩略图，并提供预签名URL。
- ✅ **病毒扫描 (可选)**: 集成ClamAV对上传文件进行扫描。
- ✅ **安全与限流**: 支持下载令牌、IP/用户请求限流。
- ✅ **统一错误响应**: 标准化的 `error_code` 错误结构，方便前端处理。
- ✅ **环境自检**: 提供 `scripts/check_env.py` 脚本一键检查环境依赖。
- ✅ **周期性清理**: 自动清理过期的缓存键，防止缓存膨胀。

## 技术栈

- **核心框架**: Django, Django REST Framework, Celery
- **外部依赖**:
  - **LibreOffice / soffice**: 主要的文档转换引擎。
  - **Pandoc (可选)**: 用于 `lite` 模式下的文本格式转换。
- **Python库**: `pdf2image`, `PyPDF2`, `boto3` (S3/MinIO支持)

## 系统要求

- Python 3.10+
- Redis (用于Celery Broker和缓存)
- **LibreOffice**: 必须安装，并确保 `soffice` 或 `libreoffice` 命令在系统PATH中可用。
- **Pandoc (推荐)**: 推荐安装，以优化 `lite` 模式的性能。
- **ClamAV (可选)**: 如需开启病毒扫描，需部署ClamAV服务。

## 安装和启动

### 方法1: 使用启动脚本（推荐）

**Windows:**
```cmd
cd backend
start_document_converter.bat
```

**Linux/macOS:**
```bash
cd backend
chmod +x start_document_converter.sh
./start_document_converter.sh
```

### 方法2: 手动启动

1. **安装依赖**
```bash
cd backend
pip install -r requirements.txt
```

2. **启动Django服务器**
```bash
python manage.py runserver 0.0.0.0:8000
```

## API端点

### 转换文档
```
POST /api/v1/document-converter/convert/
```

**请求参数:**
- `file`: 要转换的文档文件 (multipart/form-data)

**响应:**
```json
{
  "success": true,
  "attachment_id": "<uuid>",
  "task_id": "<celery_task_id>",
  "status_url": "/api/v1/document-converter/status/<celery_task_id>/",
  "message": "文件上传成功，转换任务已开始"
}
```

### 查询任务状态
```
GET /api/v1/document-converter/status/<task_id>/
```

### 生成下载令牌
```
POST /api/v1/document-converter/generate-download-token/
Body(JSON): { "filename": "<converted_file_name>.pdf" }
```

### 受保护下载
```
GET /api/v1/document-converter/download/<filename>/?token=<token>
```

### 健康检查
```
GET /api/v1/document-converter/health/

### 错误响应统一格式

所有失败响应均采用以下结构：

```json
{
  "success": false,
  "error_code": "<UPPER_SNAKE_CASE>",
  "error": "<人类可读的错误信息>"
}
```

常见错误码：
- UNAUTHORIZED（未登录）
- NO_FILE（未上传文件）
- MISSING_NOTE_ID / MISSING_PARAMS（缺少参数）
- NOTE_NOT_FOUND（笔记不存在或无权访问）
- INVALID_JSON（请求体 JSON 无效）
- INVALID_FILE / INVALID_FILENAME（不支持的文件类型 / 非法文件名）
- PAYLOAD_TOO_LARGE（上传内容超限）
- INVALID_TOKEN（下载令牌无效或过期）
- FILE_NOT_FOUND（文件不存在）
- FORBIDDEN（无权访问）
- MALWARE_DETECTED（病毒检测命中）
- RATE_LIMITED（请求过于频繁）
- INTERNAL_ERROR（服务器内部错误）

```

## 示例（curl）

上传并开始转换（异步）
```
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -F "file=@/path/to/file.docx" \
  -F "note_id=<note_id>" \
  http://localhost:8000/api/v1/document-converter/convert/
```

轮询状态
```
curl -H "Authorization: Bearer <JWT>" \
  http://localhost:8000/api/v1/document-converter/status/<task_id>/
```

生成下载令牌
```
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"filename":"<file>.pdf"}' \
  http://localhost:8000/api/v1/document-converter/generate-download-token/
```

下载（带令牌）
```
curl -H "Authorization: Bearer <JWT>" \
  -L "http://localhost:8000/api/v1/document-converter/download/<file>.pdf?token=<token>"
```



## 对象存储启用与回退

本模块支持两种下载模式：
- presigned（对象存储启用时，直接返回预签名URL）
- local（未启用对象存储时，返回短时令牌 + 受保护下载路径）

### 开启对象存储（S3/MinIO）
在 `backend/.env` 中配置：
```
OBJECT_STORAGE_PROVIDER=s3   # 或 minio；不配置/none 表示关闭对象存储
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_ENDPOINT_URL=https://s3.example.com   # MinIO/私有S3需要
AWS_S3_REGION_NAME=your-region
AWS_ACCESS_KEY_ID=your-ak
AWS_SECRET_ACCESS_KEY=your-sk
```

任务完成后：
- status 接口的 `data` 将包含：
  - `download_mode`: `presigned` | `local`
  - `filename`: 转换后文件名（如 `<attachment_id>.pdf`）
  - `pdf_url`: 若为 `presigned` 则为预签名直链；否则为本地下载URL
- generate-download-token 接口：
  - 对象存储开启时：直接返回 `presigned_url`（同时保留 `token` 以兼容）
  - 未开启：返回 `token` 与本地下载URL

### 示例：生成令牌（对象存储启用）
```
curl -X POST \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"filename":"<file>.pdf"}' \
  http://localhost:8000/api/v1/document-converter/generate-download-token/
```
响应：
```json
{
  "success": true,
  "mode": "presigned",
  "expires_in": 600,
  "download_url": "https://s3.example.com/...presigned...",
  "presigned_url": "https://s3.example.com/...presigned...",
  "token": "<compat-only>"
}
```

### 示例：查询任务状态

**成功状态 (对象存储启用):**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": 100,
    "user_id": "...",
    "attachment_id": "...",
    "filename": "<attachment_id>.pdf",
    "storage_key": "converted/<attachment_id>.pdf",
    "download_mode": "presigned",
    "pdf_url": "https://s3.example.com/...presigned...",
    "thumbnail_url": "https://s3.example.com/...thumbnails/<attachment_id>.jpg..."
  }
}
```

**成功状态 (本地存储):**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": 100,
    "download_mode": "local",
    "pdf_url": "/api/v1/document-converter/download/<attachment_id>.pdf",
    "thumbnail_url": "/media/thumbnails/<attachment_id>.jpg"
  }
}
```

**失败状态:**
```json
{
  "success": true,
  "data": {
    "status": "failed",
    "progress": 100,
    "error": "Soft time limit exceeded",
    "error_code": "TIMEOUT",
    "error_message": "Soft time limit exceeded"
  }
}
```

### 下载转换后的PDF
```
GET /api/v1/document-converter/download/<filename>/
```

### 清理临时文件
```
POST /api/v1/document-converter/cleanup/
```

## 使用示例

### Python后端
```python
from document_converter.services import document_converter

# 转换Word文档
success, pdf_path, error = document_converter.convert_word_to_pdf(
    'path/to/document.docx'
)

if success:
    print(f"转换成功: {pdf_path}")
else:
    print(f"转换失败: {error}")

# 转换PPT文档
success, pdf_path, error = document_converter.convert_ppt_to_pdf(
    'path/to/presentation.pptx'
)
```

### React Native前端
```javascript
import documentConverter from '../services/document/documentConverter';

// 转换Word文档
const pdfPath = await documentConverter.convertWordToPDF(
  docPath,
  (progress, message) => {
    console.log(`转换进度: ${progress}% - ${message}`);
  }
);

// 转换PPT文档
const pdfPath = await documentConverter.convertPPTToPDF(
  pptPath,
  (progress, message) => {
    console.log(`转换进度: ${progress}% - ${message}`);
  }
);
```

## 配置说明

### Django设置
确保在`INSTALLED_APPS`中添加了`document_converter`应用：

```python
INSTALLED_APPS = [
    # ... 其他应用
    'document_converter',
]
```

### URL配置
在主URL配置中包含文档转换的URL：

```python
urlpatterns = [
    # ... 其他URL
    path('api/v1/document-converter/', include('document_converter.urls')),
]
```

## 注意事项

1. **Windows专用**: 此转换服务仅在Windows系统上工作，因为它依赖Microsoft Office COM接口
2. **Office要求**: 系统必须安装Microsoft Office (Word和PowerPoint)
3. **权限**: 确保Python进程有权限访问Office应用程序
4. **性能**: 转换大文件可能需要较长时间
5. **并发**: COM接口不支持高并发，建议使用任务队列处理大量转换请求

## 故障排除

### 常见错误

1. **COM接口初始化失败**
   - 确保安装了Microsoft Office
   - 检查Office是否正确注册
   - 尝试以管理员权限运行

2. **文件访问权限错误**
   - 检查文件路径是否正确
   - 确保Python进程有读取文件的权限
   - 检查临时目录的写入权限

3. **转换超时**
   - 检查文档是否损坏
   - 尝试手动打开文档
   - 增加超时时间

### 日志调试
启用详细日志记录：

```python
import logging
logging.getLogger('document_converter').setLevel(logging.DEBUG)
```

## 替代方案

如果无法使用Windows COM接口，可以考虑以下替代方案：

1. **LibreOffice**: 使用LibreOffice的命令行工具
2. **云服务**: 使用Google Docs API或Microsoft Graph API
3. **Docker**: 在Docker容器中运行LibreOffice
4. **第三方服务**: 使用专门的文档转换服务
