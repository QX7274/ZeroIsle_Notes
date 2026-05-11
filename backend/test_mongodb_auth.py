"""
测试MongoDB用户认证
"""

import os
import sys
import django
import json
import requests

# 设置Django环境
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.development')
django.setup()

# 设置MongoDB连接环境变量
os.environ.setdefault('MONGO_DB', 'ZeroIsle_Notes')
if not os.environ.get('MONGO_URI'):
    raise RuntimeError('请显式配置 MONGO_URI 后再运行此脚本。')

# 导入MongoDB模型
from users.mongodb_models import User, VerificationCode

def clear_test_users():
    """清除测试用户"""
    print("清除测试用户...")
    User.objects(username__startswith='test_').delete()
    print("测试用户已清除")

def test_registration():
    """测试用户注册"""
    print("\n=== 测试用户注册 ===")

    # 清除测试用户
    User.objects(username='test_user').delete()

    # 注册数据
    register_data = {
        'username': 'test_user',
        'email': 'test@example.com',
        'password': 'Test@123',
        'confirm_password': 'Test@123'
    }

    # 发送注册请求
    response = requests.post(
        'http://localhost:8000/api/v1/auth/register/',
        json=register_data
    )

    # 打印响应
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    # 验证用户是否创建成功
    user = User.objects(username='test_user').first()
    if user:
        print(f"用户创建成功: {user.username}, {user.email}")
    else:
        print("用户创建失败")

    return response.json() if response.status_code == 201 else None

def test_login(credentials=None):
    """测试用户登录"""
    print("\n=== 测试用户登录 ===")

    if not credentials:
        # 登录数据
        login_data = {
            'username': 'test_user',
            'password': 'Test@123'
        }
    else:
        login_data = credentials

    # 发送登录请求
    response = requests.post(
        'http://localhost:8000/api/v1/auth/login/',
        json=login_data
    )

    # 打印响应
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    return response.json() if response.status_code == 200 else None

def test_verification_code():
    """测试验证码发送"""
    print("\n=== 测试验证码发送 ===")

    # 验证码数据
    code_data = {
        'phone': '13800138000',
        'purpose': 'login'
    }

    # 发送验证码请求
    response = requests.post(
        'http://localhost:8000/api/v1/auth/verification-code/',
        json=code_data
    )

    # 打印响应
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    return response.json() if response.status_code == 200 else None

def test_phone_registration():
    """测试手机号注册"""
    print("\n=== 测试手机号注册 ===")

    # 清除测试用户
    User.objects(phone='13800138000').delete()

    # 先获取验证码
    code_data = {
        'phone': '13800138000',
        'purpose': 'register'
    }

    code_response = requests.post(
        'http://localhost:8000/api/v1/auth/verification-code/',
        json=code_data
    )

    if code_response.status_code != 200:
        print("获取验证码失败")
        return None

    # 从响应中获取验证码（仅在开发环境中可用）
    verification_code = code_response.json().get('code')

    # 注册数据
    register_data = {
        'phone': '13800138000',
        'code': verification_code,
        'password': 'Test@123',
        'confirm_password': 'Test@123'
    }

    # 发送注册请求
    response = requests.post(
        'http://localhost:8000/api/v1/auth/register/phone/',
        json=register_data
    )

    # 打印响应
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

    # 验证用户是否创建成功
    user = User.objects(phone='13800138000').first()
    if user:
        print(f"用户创建成功: {user.username}, {user.phone}")
    else:
        print("用户创建失败")

    return response.json() if response.status_code == 201 else None

def run_tests():
    """运行所有测试"""
    # 清除测试用户
    clear_test_users()

    # 测试用户注册
    registration_result = test_registration()

    # 测试用户登录
    if registration_result:
        login_result = test_login()

    # 测试验证码发送
    verification_result = test_verification_code()

    # 测试手机号注册
    if verification_result:
        phone_registration_result = test_phone_registration()

        # 测试手机号登录
        if phone_registration_result:
            phone_login_result = test_login({
                'phone': '13800138000',
                'password': 'Test@123'
            })

if __name__ == "__main__":
    run_tests()
