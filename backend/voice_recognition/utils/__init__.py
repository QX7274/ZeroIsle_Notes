"""
工具模块初始化文件
"""

from .netcheck import is_network_available, start_background_check

__all__ = [
    'is_network_available',
    'start_background_check',
]
