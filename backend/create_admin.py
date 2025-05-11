"""
创建Django管理员用户
"""
import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def create_superuser():
    """创建超级用户"""
    try:
        # 检查是否已存在超级用户
        if User.objects.filter(is_superuser=True).exists():
            print("已存在超级用户，跳过创建")
            return
        
        # 创建超级用户
        user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )
        print(f"成功创建超级用户: {user.username}")
        print(f"用户名: admin")
        print(f"密码: admin123")
    except Exception as e:
        print(f"创建超级用户失败: {str(e)}")

if __name__ == "__main__":
    create_superuser()
