"""
API安全工具
提供API密钥管理、速率限制和安全审计
"""

import logging
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, Tuple
from django.utils import timezone
from django.conf import settings
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import ListField, UUIDField
import uuid

logger = logging.getLogger(__name__)


class APIKey(Document):
    """API密钥文档"""
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user_id = StringField(required=True, verbose_name='用户ID')
    name = StringField(max_length=100, required=True, verbose_name='密钥名称')
    key_hash = StringField(required=True, verbose_name='密钥哈希')
    key_prefix = StringField(max_length=10, verbose_name='密钥前缀')
    
    # 权限范围
    scopes = ListField(StringField(), default=list, verbose_name='权限范围')
    
    # 限制
    rate_limit = IntField(default=1000, verbose_name='每小时请求限制')
    allowed_ips = ListField(StringField(), default=list, verbose_name='允许的IP')
    
    # 状态
    is_active = BooleanField(default=True, verbose_name='是否激活')
    last_used_at = DateTimeField(verbose_name='最后使用时间')
    request_count = IntField(default=0, verbose_name='请求计数')
    
    # 时间
    expires_at = DateTimeField(verbose_name='过期时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'api_keys',
        'indexes': [
            {'fields': ['user_id']},
            {'fields': ['key_hash'], 'unique': True},
            {'fields': ['is_active']},
        ]
    }


class APIScope:
    """API权限范围"""
    READ_NOTES = 'read:notes'
    WRITE_NOTES = 'write:notes'
    READ_TAGS = 'read:tags'
    WRITE_TAGS = 'write:tags'
    READ_KG = 'read:kg'
    WRITE_KG = 'write:kg'
    AI_CHAT = 'ai:chat'
    ADMIN = 'admin'
    
    ALL = [READ_NOTES, WRITE_NOTES, READ_TAGS, WRITE_TAGS, READ_KG, WRITE_KG, AI_CHAT]


class APIKeyManager:
    """
    API密钥管理器
    
    使用方法:
        manager = APIKeyManager()
        
        # 创建密钥
        key, key_obj = manager.create_key(user_id, 'My API Key', scopes=['read:notes'])
        
        # 验证密钥
        is_valid, key_obj = manager.validate_key(api_key)
        
        # 检查权限
        has_permission = manager.check_scope(key_obj, 'read:notes')
    """
    
    KEY_PREFIX = 'zin_'  # ZeroIsle Notes
    KEY_LENGTH = 32
    
    def create_key(
        self,
        user_id: str,
        name: str,
        scopes: list = None,
        rate_limit: int = 1000,
        expires_days: int = None,
        allowed_ips: list = None
    ) -> Tuple[str, APIKey]:
        """
        创建API密钥
        
        Args:
            user_id: 用户ID
            name: 密钥名称
            scopes: 权限范围
            rate_limit: 每小时请求限制
            expires_days: 过期天数
            allowed_ips: 允许的IP列表
            
        Returns:
            (raw_key, key_object): 原始密钥和密钥对象
        """
        # 生成随机密钥
        raw_key = self.KEY_PREFIX + secrets.token_urlsafe(self.KEY_LENGTH)
        
        # 计算哈希
        key_hash = self._hash_key(raw_key)
        
        # 过期时间
        expires_at = None
        if expires_days:
            expires_at = timezone.now() + timedelta(days=expires_days)
        
        # 创建密钥对象
        api_key = APIKey(
            user_id=str(user_id),
            name=name,
            key_hash=key_hash,
            key_prefix=raw_key[:10],
            scopes=scopes or APIScope.ALL,
            rate_limit=rate_limit,
            allowed_ips=allowed_ips or [],
            expires_at=expires_at,
        )
        api_key.save()
        
        logger.info(f"创建API密钥: {name} for user {user_id}")
        
        # 返回原始密钥（只在创建时返回一次）
        return raw_key, api_key
    
    def validate_key(self, raw_key: str) -> Tuple[bool, Optional[APIKey]]:
        """
        验证API密钥
        
        Args:
            raw_key: 原始密钥
            
        Returns:
            (is_valid, key_object): 是否有效和密钥对象
        """
        if not raw_key or not raw_key.startswith(self.KEY_PREFIX):
            return False, None
        
        key_hash = self._hash_key(raw_key)
        
        try:
            api_key = APIKey.objects(key_hash=key_hash).first()
            
            if not api_key:
                return False, None
            
            # 检查是否激活
            if not api_key.is_active:
                return False, api_key
            
            # 检查是否过期
            if api_key.expires_at and api_key.expires_at < timezone.now():
                return False, api_key
            
            # 更新使用记录
            api_key.last_used_at = timezone.now()
            api_key.request_count += 1
            api_key.save()
            
            return True, api_key
            
        except Exception as e:
            logger.error(f"验证API密钥失败: {e}")
            return False, None
    
    def check_scope(self, api_key: APIKey, required_scope: str) -> bool:
        """检查权限范围"""
        if APIScope.ADMIN in api_key.scopes:
            return True
        return required_scope in api_key.scopes
    
    def check_ip(self, api_key: APIKey, ip_address: str) -> bool:
        """检查IP限制"""
        if not api_key.allowed_ips:
            return True
        return ip_address in api_key.allowed_ips
    
    def revoke_key(self, key_id: str) -> bool:
        """撤销密钥"""
        try:
            api_key = APIKey.objects(id=key_id).first()
            if api_key:
                api_key.is_active = False
                api_key.save()
                logger.info(f"撤销API密钥: {key_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"撤销API密钥失败: {e}")
            return False
    
    def get_user_keys(self, user_id: str) -> list:
        """获取用户的所有密钥"""
        return list(APIKey.objects(user_id=str(user_id)))
    
    def _hash_key(self, raw_key: str) -> str:
        """哈希密钥"""
        return hashlib.sha256(raw_key.encode()).hexdigest()


class SecurityAuditLog(Document):
    """安全审计日志"""
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user_id = StringField(verbose_name='用户ID')
    event_type = StringField(required=True, verbose_name='事件类型')
    ip_address = StringField(verbose_name='IP地址')
    user_agent = StringField(verbose_name='用户代理')
    details = StringField(verbose_name='详情')
    severity = StringField(choices=('low', 'medium', 'high', 'critical'), default='low')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'security_audit_logs',
        'indexes': [
            {'fields': ['user_id']},
            {'fields': ['event_type']},
            {'fields': ['severity']},
            {'fields': ['created_at']},
            {'fields': ['created_at'], 'expireAfterSeconds': 365 * 24 * 3600}  # 1年后过期
        ],
        'ordering': ['-created_at']
    }


class SecurityEventType:
    """安全事件类型"""
    LOGIN_SUCCESS = 'login_success'
    LOGIN_FAILED = 'login_failed'
    LOGIN_BLOCKED = 'login_blocked'
    PASSWORD_CHANGED = 'password_changed'
    PASSWORD_RESET = 'password_reset'
    API_KEY_CREATED = 'api_key_created'
    API_KEY_REVOKED = 'api_key_revoked'
    UNAUTHORIZED_ACCESS = 'unauthorized_access'
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
    SUSPICIOUS_ACTIVITY = 'suspicious_activity'


class SecurityAuditService:
    """
    安全审计服务
    
    使用方法:
        service = SecurityAuditService()
        
        # 记录事件
        service.log_event(
            user_id='123',
            event_type=SecurityEventType.LOGIN_SUCCESS,
            ip_address='192.168.1.1',
            details='从新设备登录'
        )
        
        # 获取用户事件
        events = service.get_user_events(user_id, days=30)
    """
    
    def log_event(
        self,
        event_type: str,
        user_id: str = None,
        ip_address: str = None,
        user_agent: str = None,
        details: str = None,
        severity: str = 'low'
    ):
        """记录安全事件"""
        try:
            log = SecurityAuditLog(
                user_id=str(user_id) if user_id else None,
                event_type=event_type,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
                severity=severity,
            )
            log.save()
            
            # 高危事件告警
            if severity in ('high', 'critical'):
                logger.warning(f"安全告警 [{severity}]: {event_type} - {details}")
                
        except Exception as e:
            logger.error(f"记录安全事件失败: {e}")
    
    def get_user_events(self, user_id: str, days: int = 30, limit: int = 100) -> list:
        """获取用户安全事件"""
        start_date = timezone.now() - timedelta(days=days)
        
        events = SecurityAuditLog.objects(
            user_id=str(user_id),
            created_at__gte=start_date
        ).order_by('-created_at').limit(limit)
        
        return [
            {
                'id': str(e.id),
                'event_type': e.event_type,
                'ip_address': e.ip_address,
                'details': e.details,
                'severity': e.severity,
                'created_at': e.created_at.isoformat(),
            }
            for e in events
        ]
    
    def get_suspicious_activities(self, hours: int = 24) -> list:
        """获取可疑活动"""
        start_date = timezone.now() - timedelta(hours=hours)
        
        events = SecurityAuditLog.objects(
            severity__in=['high', 'critical'],
            created_at__gte=start_date
        ).order_by('-created_at')
        
        return list(events)


# 全局实例
_api_key_manager = None
_security_audit = None


def get_api_key_manager() -> APIKeyManager:
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = APIKeyManager()
    return _api_key_manager


def get_security_audit() -> SecurityAuditService:
    global _security_audit
    if _security_audit is None:
        _security_audit = SecurityAuditService()
    return _security_audit
