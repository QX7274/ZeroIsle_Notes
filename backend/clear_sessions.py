"""
清除会话脚本
用于清除所有会话，强制用户重新登录
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.sessions.models import Session
from django.utils import timezone

def clear_sessions():
    """清除所有会话"""
    # 删除所有会话
    count = Session.objects.all().delete()[0]
    print(f"已清除 {count} 个会话")

if __name__ == '__main__':
    clear_sessions()
