"""
网络检查工具
"""

import socket
import logging
import time
import threading

logger = logging.getLogger('backend')

# 全局变量，存储网络状态
_network_available = True
_last_check_time = 0
_check_interval = 60  # 检查间隔，单位：秒
_lock = threading.Lock()

def is_network_available(force_check=False):
    """
    检查网络是否可用
    
    Args:
        force_check: 是否强制检查，忽略缓存
        
    Returns:
        bool: 网络是否可用
    """
    global _network_available, _last_check_time
    
    # 如果不是强制检查，且上次检查时间在检查间隔内，直接返回缓存结果
    current_time = time.time()
    if not force_check and (current_time - _last_check_time) < _check_interval:
        return _network_available
    
    # 加锁，防止多线程同时检查
    with _lock:
        # 再次检查，避免在等待锁的过程中已经有其他线程完成了检查
        if not force_check and (current_time - _last_check_time) < _check_interval:
            return _network_available
        
        # 执行实际的网络检查
        try:
            # 尝试连接到OpenAI API
            socket.create_connection(("api.openai.com", 443), timeout=5)
            _network_available = True
        except OSError:
            # 如果连接失败，尝试连接到Google DNS
            try:
                socket.create_connection(("8.8.8.8", 53), timeout=5)
                _network_available = True
            except OSError:
                _network_available = False
        
        # 更新最后检查时间
        _last_check_time = time.time()
        
        logger.debug(f"网络检查结果: {'可用' if _network_available else '不可用'}")
        return _network_available

def start_background_check(interval=60):
    """
    启动后台网络检查线程
    
    Args:
        interval: 检查间隔，单位：秒
    """
    global _check_interval
    _check_interval = interval
    
    def _check_loop():
        while True:
            is_network_available(force_check=True)
            time.sleep(_check_interval)
    
    # 启动后台线程
    thread = threading.Thread(target=_check_loop, daemon=True)
    thread.start()
    logger.info("网络检查后台线程已启动")
