"""
AI 响应 Schema 定义（约定）
用于统一后端各功能的 data 字段结构，前端仅解析 {code, message, data} 的 data 部分
"""
from typing import Dict, Any, List

# 文本处理通用
TEXT_PROCESSING_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "result": "示例结果文本",
    "metadata": {"task": "summarize"}  # 可选
}

# 代码格式化/识别
CODE_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "formatted_code": "print('hello')\n",
    "language": "python"
}

# 数学公式
MATH_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "latex": "E=mc^2"
}

# 关键词
KEYWORDS_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "keywords": ["AI", "Notes", "Sync"]
}

# 语音转写
TRANSCRIPTION_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "text": "转写文本",
    "language": "zh"
}

# 图像分析（文本类结果）
IMAGE_ANALYSIS_SCHEMA_EXAMPLE: Dict[str, Any] = {
    "result": "图像内容描述或OCR文本",
    "task": "describe"
}

__all__ = [
    "TEXT_PROCESSING_SCHEMA_EXAMPLE",
    "CODE_SCHEMA_EXAMPLE",
    "MATH_SCHEMA_EXAMPLE",
    "KEYWORDS_SCHEMA_EXAMPLE",
    "TRANSCRIPTION_SCHEMA_EXAMPLE",
    "IMAGE_ANALYSIS_SCHEMA_EXAMPLE",
]

