# 文档转换服务

这个模块提供了Word和PPT文档转换为PDF的功能，使用Windows COM接口进行真实的文档转换。

## 功能特性

- **Word转PDF**: 支持.doc和.docx格式
- **PPT转PDF**: 支持.ppt和.pptx格式
- **真实转换**: 使用Microsoft Office COM接口，保证转换质量
- **进度跟踪**: 提供转换进度回调
- **错误处理**: 完善的错误处理和日志记录
- **临时文件管理**: 自动清理临时文件

## 系统要求

### Windows系统
- Windows 10/11
- Microsoft Office (Word和PowerPoint)
- Python 3.8+
- comtypes库
- pywin32库

### 依赖安装

```bash
pip install comtypes==1.2.0
pip install pywin32==306
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
  "pdf_url": "/api/document-converter/download/converted_abc123.pdf",
  "pdf_path": "converted_docs/converted_abc123.pdf",
  "original_filename": "document.docx"
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
