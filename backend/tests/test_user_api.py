"""
测试用户API
"""

import requests
import json
import unittest

class TestUserAPI(unittest.TestCase):
    """测试用户API"""
    
    def setUp(self):
        """测试前准备"""
        self.base_url = 'http://localhost:8000/api'
        self.test_user = {
            'username': 'testuser',
            'email': 'testuser@example.com',
            'password': 'testpassword123',
            'password2': 'testpassword123'
        }
        self.access_token = None
    
    def test_01_register(self):
        """测试用户注册"""
        url = f"{self.base_url}/auth/users/register/"
        
        # 发送POST请求
        response = requests.post(url, json=self.test_user)
        
        # 打印响应
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        # 验证响应
        self.assertEqual(response.status_code, 201)
        self.assertIn('user', response.json())
        self.assertIn('access', response.json())
        self.assertIn('refresh', response.json())
        
        # 保存访问令牌
        self.access_token = response.json()['access']
    
    def test_02_login(self):
        """测试用户登录"""
        url = f"{self.base_url}/auth/users/login/"
        
        # 登录数据
        login_data = {
            'email': self.test_user['email'],
            'password': self.test_user['password']
        }
        
        # 发送POST请求
        response = requests.post(url, json=login_data)
        
        # 打印响应
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        # 验证响应
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
        self.assertIn('refresh', response.json())
        
        # 保存访问令牌
        self.access_token = response.json()['access']
    
    def test_03_get_profile(self):
        """测试获取用户资料"""
        # 如果没有访问令牌，先登录
        if not self.access_token:
            self.test_02_login()
        
        url = f"{self.base_url}/auth/users/profile/"
        
        # 发送GET请求
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.get(url, headers=headers)
        
        # 打印响应
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        # 验证响应
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['username'], self.test_user['username'])
        self.assertEqual(response.json()['email'], self.test_user['email'])
    
    def test_04_update_profile(self):
        """测试更新用户资料"""
        # 如果没有访问令牌，先登录
        if not self.access_token:
            self.test_02_login()
        
        url = f"{self.base_url}/auth/users/profile/"
        
        # 更新数据
        update_data = {
            'bio': '这是一个测试用户的个人简介'
        }
        
        # 发送PATCH请求
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.patch(url, json=update_data, headers=headers)
        
        # 打印响应
        print(f"状态码: {response.status_code}")
        print(f"响应内容: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        # 验证响应
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['bio'], update_data['bio'])
    
    def test_05_delete_user(self):
        """测试删除用户"""
        # 如果没有访问令牌，先登录
        if not self.access_token:
            self.test_02_login()
        
        url = f"{self.base_url}/auth/users/delete/"
        
        # 发送DELETE请求
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.delete(url, headers=headers)
        
        # 打印响应
        print(f"状态码: {response.status_code}")
        
        # 验证响应
        self.assertEqual(response.status_code, 204)

if __name__ == '__main__':
    unittest.main()
