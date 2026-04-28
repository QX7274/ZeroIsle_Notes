"""
Django设置包初始化文件
根据环境变量加载不同的设置文件
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 确保通过 `manage.py` 启动时也能加载 backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / '.env')

# 默认使用开发环境设置
environment = os.environ.get('DJANGO_ENV', 'development')

if environment == 'production':
    from .production import *
elif environment == 'testing':
    from .testing import *
else:
    from .development import *
