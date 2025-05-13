"""
MongoDB Realm/Atlas App Services服务
提供与MongoDB Realm/Atlas App Services的交互功能
"""

import os
import logging
import requests
import json
import time
from datetime import datetime

logger = logging.getLogger(__name__)

class RealmService:
    """MongoDB Realm/Atlas App Services服务类"""

    def __init__(self):
        """初始化MongoDB Realm/Atlas App Services服务"""
        self.app_id = os.environ.get('REALM_APP_ID', '')
        self.api_key = os.environ.get('REALM_API_KEY', '')
        self.base_url = f"https://realm.mongodb.com/api/admin/v3.0/groups"
        self.access_token = None
        self.token_expires_at = 0
        self.max_retries = 3
        self.retry_delay = 1

        # 不使用Realm功能，仅使用MongoDB Atlas作为数据库
        # 不显示警告信息
        if self.app_id and self.api_key:
            logger.info(f"MongoDB Realm/Atlas App Services服务初始化: App ID {self.app_id}")
        else:
            logger.info("仅使用MongoDB Atlas作为数据库，不使用Realm/Atlas App Services功能")

    async def authenticate(self):
        """获取访问令牌"""
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token

        url = "https://realm.mongodb.com/api/admin/v3.0/auth/providers/mongodb-cloud/login"
        headers = {
            "Content-Type": "application/json"
        }
        data = {
            "username": os.environ.get('REALM_USERNAME', ''),
            "apiKey": self.api_key
        }

        for attempt in range(self.max_retries):
            try:
                response = requests.post(url, headers=headers, json=data)
                response.raise_for_status()

                result = response.json()
                self.access_token = result.get('access_token')
                # 令牌有效期通常为24小时，这里设置为23小时
                self.token_expires_at = time.time() + 23 * 60 * 60

                # 记录认证时间
                self.last_auth_time = datetime.now()

                # 记录认证信息
                auth_info = {
                    "token": self.access_token,
                    "expires_at": self.token_expires_at,
                    "auth_time": self.last_auth_time.isoformat()
                }
                logger.info(f"MongoDB Realm/Atlas App Services认证成功: {json.dumps(auth_info, default=str)}")

                return self.access_token
            except Exception as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"MongoDB Realm/Atlas App Services认证失败: {str(e)}")
                    raise
                time.sleep(self.retry_delay)
                logger.warning(f"重试MongoDB Realm/Atlas App Services认证 (尝试 {attempt + 1}/{self.max_retries})")

    async def get_app_info(self):
        """获取应用信息"""
        if not self.app_id:
            logger.error("未配置MongoDB Realm/Atlas App Services App ID")
            return None

        token = await self.authenticate()
        if not token:
            return None

        url = f"{self.base_url}/byName/{os.environ.get('REALM_GROUP_NAME', '')}/apps/{self.app_id}"
        headers = {
            "Authorization": f"Bearer {token}"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"获取MongoDB Realm/Atlas App Services应用信息失败: {str(e)}")
            return None

    async def create_user(self, email, password):
        """创建用户"""
        if not self.app_id:
            logger.error("未配置MongoDB Realm/Atlas App Services App ID")
            return None

        token = await self.authenticate()
        if not token:
            return None

        url = f"{self.base_url}/byName/{os.environ.get('REALM_GROUP_NAME', '')}/apps/{self.app_id}/users"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        data = {
            "email": email,
            "password": password
        }

        try:
            response = requests.post(url, headers=headers, json=data)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"创建MongoDB Realm/Atlas App Services用户失败: {str(e)}")
            return None

    async def get_user(self, user_id):
        """获取用户信息"""
        if not self.app_id:
            logger.error("未配置MongoDB Realm/Atlas App Services App ID")
            return None

        token = await self.authenticate()
        if not token:
            return None

        url = f"{self.base_url}/byName/{os.environ.get('REALM_GROUP_NAME', '')}/apps/{self.app_id}/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {token}"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"获取MongoDB Realm/Atlas App Services用户信息失败: {str(e)}")
            return None

    async def delete_user(self, user_id):
        """删除用户"""
        if not self.app_id:
            logger.error("未配置MongoDB Realm/Atlas App Services App ID")
            return False

        token = await self.authenticate()
        if not token:
            return False

        url = f"{self.base_url}/byName/{os.environ.get('REALM_GROUP_NAME', '')}/apps/{self.app_id}/users/{user_id}"
        headers = {
            "Authorization": f"Bearer {token}"
        }

        try:
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"删除MongoDB Realm/Atlas App Services用户失败: {str(e)}")
            return False

    async def enable_sync(self):
        """启用同步功能"""
        if not self.app_id:
            logger.error("未配置MongoDB Realm/Atlas App Services App ID")
            return False

        token = await self.authenticate()
        if not token:
            return False

        url = f"{self.base_url}/byName/{os.environ.get('REALM_GROUP_NAME', '')}/apps/{self.app_id}/sync/config"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        data = {
            "state": "enabled",
            "development_mode_enabled": True
        }

        try:
            response = requests.put(url, headers=headers, json=data)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"启用MongoDB Realm/Atlas App Services同步功能失败: {str(e)}")
            return False

# 单例模式实例化
realm_service = RealmService()
