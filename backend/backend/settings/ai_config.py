"""
AI 引擎配置文件
"""

import os

# OpenAI 配置
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_API_BASE = os.environ.get('OPENAI_API_BASE', 'https://api.openai.com/v1')
OPENAI_API_VERSION = os.environ.get('OPENAI_API_VERSION', '2023-05-15')
OPENAI_API_TYPE = os.environ.get('OPENAI_API_TYPE', 'openai')

# 百度文心一言配置
BAIDU_API_KEY = os.environ.get('BAIDU_API_KEY', '')
BAIDU_SECRET_KEY = os.environ.get('BAIDU_SECRET_KEY', '')

# 讯飞星火配置
XUNFEI_APP_ID = os.environ.get('XUNFEI_APP_ID', '')
XUNFEI_API_KEY = os.environ.get('XUNFEI_API_KEY', '')
XUNFEI_API_SECRET = os.environ.get('XUNFEI_API_SECRET', '')

# 智谱 AI 配置
ZHIPU_API_KEY = os.environ.get('ZHIPU_API_KEY', '')

# 百度千帆配置
QIANFAN_API_KEY = os.environ.get('QIANFAN_API_KEY', '')
QIANFAN_SECRET_KEY = os.environ.get('QIANFAN_SECRET_KEY', '')

# Moonshot AI 配置
MOONSHOT_API_KEY = os.environ.get('MOONSHOT_API_KEY', '')

# 语音识别配置
WHISPER_MODEL = os.environ.get('WHISPER_MODEL', 'base')
WHISPER_LANGUAGE = os.environ.get('WHISPER_LANGUAGE', 'zh')

# 图像分析配置
IMAGE_ANALYSIS_MODEL = os.environ.get('IMAGE_ANALYSIS_MODEL', 'gpt-4-vision-preview')

# 文本处理配置
TEXT_PROCESSING_MODEL = os.environ.get('TEXT_PROCESSING_MODEL', 'gpt-3.5-turbo')
