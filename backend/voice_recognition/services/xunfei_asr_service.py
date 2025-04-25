"""
讯飞语音识别服务
"""

import logging
import json
import requests
import time
import base64
import hashlib
import hmac
import uuid
from urllib.parse import urlencode
from django.conf import settings

logger = logging.getLogger('backend')

class XunfeiASRService:
    """
    讯飞语音识别服务类
    处理与讯飞语音识别API的交互
    """
    
    def __init__(self):
        """初始化"""
        self.app_id = settings.XUNFEI_APP_ID
        self.api_key = settings.XUNFEI_API_KEY
        self.api_secret = settings.XUNFEI_API_SECRET
        self.api_base = "https://api.xfyun.cn/v1/service/v1/iat"
    
    def _create_signature(self, host, path, method="POST"):
        """
        创建签名
        
        Args:
            host: 主机名
            path: 路径
            method: 请求方法
            
        Returns:
            tuple: (签名, 日期, 签名原始字符串)
        """
        # 生成RFC1123格式的时间戳
        date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        
        # 拼接签名原始字符串
        signature_origin = f"host: {host}\ndate: {date}\n{method} {path} HTTP/1.1"
        
        # 使用hmac-sha256进行加密
        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        
        # Base64编码
        signature = base64.b64encode(signature_sha).decode('utf-8')
        
        return signature, date, signature_origin
    
    def _create_authorization(self, signature, date):
        """
        创建授权头
        
        Args:
            signature: 签名
            date: 日期
            
        Returns:
            str: 授权头
        """
        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        return base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')
    
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
        
        if not self.app_id or not self.api_key or not self.api_secret:
            logger.error("讯飞API密钥未配置")
            return {
                'status': 'failed',
                'error': "讯飞API密钥未配置",
                'duration': time.time() - start_time
            }
        
        try:
            # 解析URL
            url_parts = requests.utils.urlparse(self.api_base)
            host = url_parts.netloc
            path = url_parts.path
            
            # 创建签名
            signature, date, _ = self._create_signature(host, path)
            authorization = self._create_authorization(signature, date)
            
            # 构建请求头
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
                "Date": date,
                "Host": host,
                "Authorization": authorization
            }
            
            # 读取音频文件
            with open(audio_file_path, "rb") as audio_file:
                audio_content = audio_file.read()
            
            # Base64编码
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            # 构建请求数据
            data = {
                "common": {
                    "app_id": self.app_id
                },
                "business": {
                    "language": self._map_language(language),
                    "domain": "iat",
                    "accent": "mandarin",
                    "vad_eos": 10000
                },
                "data": {
                    "status": 2,
                    "format": "audio/L16;rate=16000",
                    "encoding": "raw",
                    "audio": audio_base64
                }
            }
            
            # 发送请求
            response = requests.post(
                self.api_base,
                headers=headers,
                data=urlencode({"text": json.dumps(data)})
            )
            
            # 检查响应
            if response.status_code != 200:
                logger.error(f"讯飞API请求失败: {response.status_code} {response.text}")
                return {
                    'status': 'failed',
                    'error': f"讯飞API请求失败: {response.status_code}",
                    'duration': time.time() - start_time
                }
            
            result = response.json()
            
            # 检查错误
            if result.get("code") != 0:
                logger.error(f"讯飞API请求失败: {result.get('code')} {result.get('message')}")
                return {
                    'status': 'failed',
                    'error': f"讯飞API请求失败: {result.get('message')}",
                    'duration': time.time() - start_time
                }
            
            # 处理结果
            text = ""
            segments = []
            
            for sentence in result.get("data", {}).get("result", {}).get("ws", []):
                for word in sentence.get("cw", []):
                    text += word.get("w", "")
            
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
            logger.error(f"讯飞转录失败: {e}")
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
            str: 讯飞语言代码
        """
        language_map = {
            'zh': 'zh_cn',
            'zh-CN': 'zh_cn',
            'zh-TW': 'zh_tw',
            'en': 'en_us',
            'en-US': 'en_us',
            'ja': 'ja_jp',
            'ko': 'ko_kr',
            'ru': 'ru_ru',
            'fr': 'fr_fr',
            'de': 'de_de',
            'es': 'es_es',
            'pt': 'pt_pt',
            'it': 'it_it'
        }
        
        return language_map.get(language, 'zh_cn')
