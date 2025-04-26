"""
Django设置文件
这个文件是为了向后兼容而保留的
实际设置文件位于settings目录中
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 构建路径
BASE_DIR = Path(__file__).resolve().parent.parent

# 根据环境变量加载不同的设置文件
environment = os.environ.get('DJANGO_ENV', 'development')

if environment == 'production':
    from .settings.production import *
elif environment == 'testing':
    from .settings.testing import *
else:
    from .settings.development import *

# 这个文件中的其他设置已经被移动到settings目录中的相应文件中
# 请在settings/base.py, settings/development.py, settings/production.py, settings/testing.py中查看