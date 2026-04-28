"""
用户认证测试
测试用户注册和登录功能
"""

import json
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from django.utils import timezone
from users.mongodb_models import User as MongoUser, VerificationCode

User = get_user_model()

class UserAuthTest(TestCase):
    """用户认证测试类"""
    
    def setUp(self):
        """测试前准备"""
        MongoUser.objects.all().delete()
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')


        
        # 创建测试用户
        self.test_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPassword123!'
        )
        
        # 测试数据
        self.valid_user_data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'TestPassword123!',
            'confirm_password': 'TestPassword123!'
        }
        
        self.valid_login_data = {
            'username': 'testuser',
            'password': 'TestPassword123!'
        }
        

        self.email_login_data = {
            'email': 'test@example.com',
            'password': 'TestPassword123!'
        }
        
        self.phone_user_data = {
            'username': 'phoneuser',
            'phone': '13800138000',
            'password': 'TestPassword123!',
            'confirm_password': 'TestPassword123!'
        }
    
    def test_user_register_with_username(self):
        """测试用户名注册"""
        response = self.client.post(
            self.register_url,
            data=json.dumps(self.valid_user_data),
            content_type='application/json'
        )
        
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Register failed: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue('access' in response.data)
        self.assertTrue('refresh' in response.data)
        self.assertTrue('user' in response.data)
        self.assertEqual(response.data['user']['username'], self.valid_user_data['username'])
        self.assertEqual(response.data['user']['email'], self.valid_user_data['email'])
    
    def test_user_login_with_username(self):
        """测试用户名登录"""
        response = self.client.post(
            self.login_url,
            data=json.dumps(self.valid_login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue('access' in response.data)
        self.assertTrue('refresh' in response.data)
        self.assertTrue('user' in response.data)
        self.assertEqual(response.data['user']['username'], self.test_user.username)
    
    def test_user_login_with_email(self):
        """测试邮箱登录"""
        response = self.client.post(
            self.login_url,
            data=json.dumps(self.email_login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue('access' in response.data)
        self.assertTrue('refresh' in response.data)
        self.assertTrue('user' in response.data)
        self.assertEqual(response.data['user']['email'], self.test_user.email)
    
    def test_user_register_with_phone(self):
        """测试手机号注册"""
        response = self.client.post(
            self.register_url,
            data=json.dumps(self.phone_user_data),
            content_type='application/json'
        )
        
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Register failed: {response.data}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue('access' in response.data)
        self.assertTrue('refresh' in response.data)
        self.assertTrue('user' in response.data)
        self.assertEqual(response.data['user']['username'], self.phone_user_data['username'])
        self.assertEqual(response.data['user']['phone'], self.phone_user_data['phone'])
    
    def test_user_login_with_phone(self):
        """测试手机号登录"""
        # 先创建一个带手机号的用户
        phone_user = User.objects.create_user(
            username='phoneuser',
            phone='13800138000',
            password='TestPassword123!'
        )
        
        login_data = {
            'phone': '13800138000',
            'password': 'TestPassword123!'
        }
        
        response = self.client.post(
            self.login_url,
            data=json.dumps(login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue('access' in response.data)
        self.assertTrue('refresh' in response.data)
        self.assertTrue('user' in response.data)
        self.assertEqual(response.data['user']['phone'], phone_user.phone)
    
    def test_user_binding_methods(self):
        """测试用户绑定多种登录方式"""
        # 创建一个只有用户名的用户
        binding_user = User.objects.create_user(
            username='bindinguser',
            password='TestPassword123!'
        )
        
        # 登录
        login_data = {
            'username': 'bindinguser',
            'password': 'TestPassword123!'
        }
        
        response = self.client.post(
            self.login_url,
            data=json.dumps(login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data['access']
        
        # 绑定邮箱
        bind_email_url = reverse('bind-email')
        bind_email_data = {
            'email': 'binding@example.com',
            'password': 'TestPassword123!'  # 验证身份
        }
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.post(
            bind_email_url,
            data=json.dumps(bind_email_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 使用邮箱登录
        email_login_data = {
            'email': 'binding@example.com',
            'password': 'TestPassword123!'
        }
        
        self.client.credentials()  # 清除认证头
        response = self.client.post(
            self.login_url,
            data=json.dumps(email_login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'bindinguser')
        
        # 绑定手机号
        token = response.data['access']
        bind_phone_url = reverse('bind-phone')
        # Create verification code in DB
        VerificationCode(
            phone='13900139000',
            code='1234',
            purpose='bind',
            expires_at=timezone.now() + timezone.timedelta(minutes=10)
        ).save()

        bind_phone_data = {
            'phone': '13900139000',
            'code': '1234',  # 模拟验证码
            'password': 'TestPassword123!'  # 验证身份
        }
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.post(
            bind_phone_url,
            data=json.dumps(bind_phone_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 使用手机号登录
        phone_login_data = {
            'phone': '13900139000',
            'password': 'TestPassword123!'
        }
        
        self.client.credentials()  # 清除认证头
        response = self.client.post(
            self.login_url,
            data=json.dumps(phone_login_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'bindinguser')

    def tearDown(self):
        """测试后清理"""
        MongoUser.objects.all().delete()
