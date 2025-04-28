"""
重置管理员密码的脚本
"""

import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

# 管理员信息
ADMIN_USERNAME = 'admin'
NEW_PASSWORD = 'admin123'

def reset_admin_password():
    """重置管理员密码"""
    try:
        with transaction.atomic():
            # 检查用户是否存在
            try:
                admin = User.objects.get(username=ADMIN_USERNAME)
            except User.DoesNotExist:
                print(f"管理员 '{ADMIN_USERNAME}' 不存在")
                return
                
            # 重置密码
            admin.set_password(NEW_PASSWORD)
            admin.save()
            
            print(f"管理员 '{ADMIN_USERNAME}' 密码重置成功")
            print(f"用户名: {ADMIN_USERNAME}")
            print(f"新密码: {NEW_PASSWORD}")
    except Exception as e:
        print(f"重置密码失败: {str(e)}")

if __name__ == "__main__":
    reset_admin_password()
