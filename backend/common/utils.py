"""
通用工具函数
"""

import os
import uuid
import hashlib
from datetime import datetime
import logging

logger = logging.getLogger('backend')

def generate_unique_filename(instance, filename):
    """
    生成唯一的文件名
    用于上传文件时避免文件名冲突
    
    Args:
        instance: 模型实例
        filename: 原始文件名
    
    Returns:
        str: 唯一的文件路径
    """
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4().hex}.{ext}"
    
    # 根据模型类型确定存储路径
    model_name = instance.__class__.__name__.lower()
    user_id = getattr(instance, 'user_id', None) or getattr(instance, 'user', None)
    
    if user_id:
        return os.path.join(model_name, str(user_id), filename)
    return os.path.join(model_name, filename)

def get_client_ip(request):
    """
    获取客户端IP地址
    
    Args:
        request: HTTP请求对象
    
    Returns:
        str: 客户端IP地址
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def hash_file(file_path, algorithm='sha256', chunk_size=8192):
    """
    计算文件哈希值
    
    Args:
        file_path: 文件路径
        algorithm: 哈希算法，默认sha256
        chunk_size: 读取块大小
    
    Returns:
        str: 文件哈希值
    """
    try:
        hasher = getattr(hashlib, algorithm)()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception as e:
        logger.error(f"计算文件哈希值失败: {e}")
        return None

def format_datetime(dt, format_str='%Y-%m-%d %H:%M:%S'):
    """
    格式化日期时间
    
    Args:
        dt: 日期时间对象
        format_str: 格式化字符串
    
    Returns:
        str: 格式化后的日期时间字符串
    """
    if isinstance(dt, datetime):
        return dt.strftime(format_str)
    return dt
