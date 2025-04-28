"""
修复管理员登录问题的脚本
"""

import os
import django
import pymongo
from bson import ObjectId

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# 连接MongoDB
client = pymongo.MongoClient('mongodb://localhost:27017/')
db = client['zeroislenotes']
users_collection = db['users_user']

# 创建新的管理员用户
def create_new_admin():
    """创建新的管理员用户"""
    from django.contrib.auth.hashers import make_password

    # 检查是否已存在admin用户
    existing_admin = users_collection.find_one({'username': 'admin'})
    if existing_admin:
        print("删除现有admin用户...")
        users_collection.delete_one({'username': 'admin'})

    # 创建新的admin用户
    admin_user = {
        '_id': ObjectId(),  # MongoDB自动生成的ID
        'password': make_password('admin123'),  # 加密密码
        'last_login': None,
        'is_superuser': True,
        'username': 'admin',
        'first_name': '',
        'last_name': '',
        'email': 'admin@example.com',
        'is_staff': True,
        'is_active': True,
        'date_joined': django.utils.timezone.now(),
        'phone': None,
        'avatar': '',
        'bio': '',
        'is_verified': False,
        'last_login_ip': None,
        'created_at': django.utils.timezone.now(),
        'updated_at': django.utils.timezone.now(),
        'preferences': '{}',  # 使用字符串而不是字典
    }

    result = users_collection.insert_one(admin_user)
    if result.inserted_id:
        print(f"成功创建新的管理员用户 (ID: {result.inserted_id})")
        print("用户名: admin")
        print("密码: admin123")
    else:
        print("创建管理员用户失败")

if __name__ == "__main__":
    create_new_admin()
