"""
百度语音识别服务
"""

import logging
import json
import requests
import time
import base64
from django.conf import settings

logger = logging.getLogger('backend')

class BaiduASRService:
    """
    百度语音识别服务类
    处理与百度语音识别API的交互
    """
    
    def __init__(self):
        """初始化"""
        self.api_key = settings.BAIDU_API_KEY
        self.secret_key = settings.BAIDU_SECRET_KEY
        self.api_base = "https://vop.baidu.com/server_api"
        self.access_token = None
        self.token_expire_time = 0
    
    def _get_access_token(self):
        """
        获取访问令牌
        
        Returns:
            str: 访问令牌
        """
        # 如果令牌未过期，直接返回
        if self.access_token and time.time() < self.token_expire_time:
            return self.access_token
        
        try:
            url = "https://aip.baidubce.com/oauth/2.0/token"
            params = {
                "grant_type": "client_credentials",
                "client_id": self.api_key,
                "client_secret": self.secret_key
            }
            
            response = requests.post(url, params=params)
            
            if response.status_code != 200:
                logger.error(f"获取百度访问令牌失败: {response.status_code} {response.text}")
                raise ValueError(f"获取百度访问令牌失败: {response.status_code}")
            
            result = response.json()
            self.access_token = result.get("access_token")
            # 令牌有效期通常为30天，这里设置为29天
            self.token_expire_time = time.time() + 29 * 24 * 60 * 60
            
            return self.access_token
        except Exception as e:
            logger.error(f"获取百度访问令牌失败: {e}")
            raise
    
    def transcribe(self, audio_file_path, language=None):
        """
        转录音频
        
        Args:
            audio_file_path: 音频文件路径
            language: 语言代码
            
        Returns:
            dict: 转录结果
        """
        start_time = time.time()
        
        if not self.api_key or not self.secret_key:
            logger.error("百度API密钥未配置")
            return {
                'status': 'failed',
                'error': "百度API密钥未配置",
                'duration': time.time() - start_time
            }
        
        try:
            # 获取访问令牌
            access_token = self._get_access_token()
            
            # 读取音频文件
            with open(audio_file_path, "rb") as audio_file:
                audio_content = audio_file.read()
            
            # Base64编码
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            # 构建请求数据
            data = {
                "format": "pcm",
                "rate": 16000,
                "channel": 1,
                "cuid": "zeroislenotes",
                "token": access_token,
                "speech": audio_base64,
                "len": len(audio_content)
            }
            
            # 设置语言
            if language:
                data["dev_pid"] = self._map_language(language)
            
            # 发送请求
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                self.api_base,
                headers=headers,
                data=json.dumps(data)
            )
            
            # 检查响应
            if response.status_code != 200:
                logger.error(f"百度API请求失败: {response.status_code} {response.text}")
                return {
                    'status': 'failed',
                    'error': f"百度API请求失败: {response.status_code}",
                    'duration': time.time() - start_time
                }
            
            result = response.json()
            
            # 检查错误
            if result.get("err_no") != 0:
                logger.error(f"百度API请求失败: {result.get('err_no')} {result.get('err_msg')}")
                return {
                    'status': 'failed',
                    'error': f"百度API请求失败: {result.get('err_msg')}",
                    'duration': time.time() - start_time
                }
            
            # 处理结果
            text = result.get("result", [""])[0]
            segments = []
            
            # 计算处理时长
            duration = time.time() - start_time
            
            return {
                'status': 'completed',
                'text': text,
                'segments': segments,
                'language': language,
                'duration': duration
            }
        except Exception as e:
            logger.error(f"百度转录失败: {e}")
            return {
                'status': 'failed',
                'error': str(e),
                'duration': time.time() - start_time
            }
    
    def _map_language(self, language):
        """
        映射语言代码
        
        Args:
            language: 语言代码
            
        Returns:
            int: 百度语言ID
        """
        language_map = {
            'zh': 1537,       # 普通话
            'zh-CN': 1537,    # 普通话
            'zh-TW': 1537,    # 普通话（简繁自动转换）
            'en': 1737,       # 英语
            'en-US': 1737,    # 英语
            'ja': 1837,       # 日语
            'ko': 1637,       # 韩语
            'ru': 1837,       # 俄语
            'fr': 1837,       # 法语
            'de': 1837,       # 德语
            'es': 1837,       # 西班牙语
            'pt': 1837,       # 葡萄牙语
            'it': 1837        # 意大利语
        }
        
        return language_map.get(language, 1537)
