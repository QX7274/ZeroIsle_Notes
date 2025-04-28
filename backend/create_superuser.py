"""
创建超级用户的脚本
"""

import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

# 超级用户信息
SUPERUSER_USERNAME = 'admin'
SUPERUSER_EMAIL = 'admin@example.com'
SUPERUSER_PASSWORD = 'admin123'

def create_superuser():
    """创建超级用户"""
    try:
        with transaction.atomic():
            # 检查用户是否已存在
            if User.objects.filter(username=SUPERUSER_USERNAME).exists():
                print(f"超级用户 '{SUPERUSER_USERNAME}' 已存在")
                return
                
            # 创建超级用户
            user = User.objects.create_superuser(
                username=SUPERUSER_USERNAME,
                email=SUPERUSER_EMAIL,
                password=SUPERUSER_PASSWORD
            )
            print(f"超级用户 '{user.username}' 创建成功")
            print(f"用户名: {SUPERUSER_USERNAME}")
            print(f"邮箱: {SUPERUSER_EMAIL}")
            print(f"密码: {SUPERUSER_PASSWORD}")
    except Exception as e:
        print(f"创建超级用户失败: {str(e)}")

if __name__ == "__main__":
    create_superuser()
