"""
笔记分享服务（优化版）
- 统一业务逻辑
- 安全的密码处理
- 访问控制和审计
- 原子操作
"""

import logging
from django.utils import timezone
from mongoengine.queryset.visitor import Q
from notes.mongodb_models import NoteShare, Note
from users.mongodb_models import User

logger = logging.getLogger(__name__)


class ShareService:
    """
    笔记分享服务类
    封装分享相关的业务逻辑
    """

    @staticmethod
    def create_share(note, user, share_type, share_to=None, password=None, 
                    expires_at=None, max_view_count=None):
        """
        创建分享
        
        Args:
            note: Note对象
            user: User对象（分享创建者）
            share_type: 分享类型 ('link', 'email', 'user')
            share_to: 分享对象（email或user_id）
            password: 可选的访问密码
            expires_at: 可选的过期时间
            max_view_count: 可选的最大访问次数
            
        Returns:
            NoteShare: 创建的分享对象
            
        Raises:
            ValueError: 参数验证失败
        """
        # 验证分享类型
        if share_type not in ['link', 'email', 'user']:
            raise ValueError(f"无效的分享类型: {share_type}")
        
        # 验证share_to
        if share_type in ['email', 'user'] and not share_to:
            raise ValueError(f"{share_type}类型的分享必须指定share_to")
        
        # 生成唯一的分享码
        share_code = ShareService._generate_unique_share_code()
        
        # 创建分享对象
        share = NoteShare(
            note=note,
            user=user,
            share_type=share_type,
            share_to=share_to or '',
            share_code=share_code,
            expires_at=expires_at,
            max_view_count=max_view_count,
            is_active=True,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        # 设置密码（如果提供）
        if password:
            share.set_password(password)
        
        # 保存
        share.save()
        
        logger.info(f"创建分享成功: {share.id}, 分享码: {share_code}, 类型: {share_type}")
        return share

    @staticmethod
    def _generate_unique_share_code(max_attempts=10):
        """
        生成唯一的分享码
        
        Args:
            max_attempts: 最大尝试次数
            
        Returns:
            str: 唯一的分享码
            
        Raises:
            RuntimeError: 无法生成唯一分享码
        """
        for _ in range(max_attempts):
            share_code = NoteShare.generate_share_code(length=16)
            # 检查是否已存在
            if not NoteShare.objects(share_code=share_code).first():
                return share_code
        
        raise RuntimeError("无法生成唯一的分享码，请稍后重试")

    @staticmethod
    def update_share(share, share_type=None, share_to=None, password=None, 
                    expires_at=None, max_view_count=None, is_active=None):
        """
        更新分享
        
        Args:
            share: NoteShare对象
            share_type: 可选的新分享类型
            share_to: 可选的新分享对象
            password: 可选的新密码（None表示不更新，''表示移除密码）
            expires_at: 可选的新过期时间
            max_view_count: 可选的新最大访问次数
            is_active: 可选的激活状态
            
        Returns:
            NoteShare: 更新后的分享对象
        """
        # 更新字段
        if share_type is not None:
            share.share_type = share_type
        
        if share_to is not None:
            share.share_to = share_to
        
        if password is not None:
            if password == '':
                # 移除密码
                share.password_hash = None
                share.is_password_protected = False
            else:
                # 设置新密码
                share.set_password(password)
        
        if expires_at is not None:
            share.expires_at = expires_at
        
        if max_view_count is not None:
            share.max_view_count = max_view_count
        
        if is_active is not None:
            share.is_active = is_active
        
        share.updated_at = timezone.now()
        share.save()
        
        logger.info(f"更新分享成功: {share.id}")
        return share

    @staticmethod
    def revoke_share(share):
        """
        撤销分享
        
        Args:
            share: NoteShare对象
            
        Returns:
            NoteShare: 撤销后的分享对象
        """
        share.is_active = False
        share.updated_at = timezone.now()
        share.save()
        
        logger.info(f"撤销分享成功: {share.id}")
        return share

    @staticmethod
    def get_share_by_code(share_code):
        """
        通过分享码获取分享
        
        Args:
            share_code: 分享码
            
        Returns:
            NoteShare or None: 分享对象（如果存在且有效）
        """
        try:
            share = NoteShare.objects.get(share_code=share_code, is_active=True)
            return share
        except NoteShare.DoesNotExist:
            return None

    @staticmethod
    def verify_share_access(share, password=None):
        """
        验证分享访问权限
        
        Args:
            share: NoteShare对象
            password: 可选的密码
            
        Returns:
            dict: 验证结果
                - accessible: bool, 是否可访问
                - reason: str, 不可访问的原因
                - requires_password: bool, 是否需要密码
        """
        # 检查是否激活
        if not share.is_active:
            return {
                'accessible': False,
                'reason': '分享已失效',
                'requires_password': False
            }
        
        # 检查是否过期
        if share.is_expired():
            return {
                'accessible': False,
                'reason': '分享已过期',
                'requires_password': False
            }
        
        # 检查访问次数限制
        if share.is_view_limit_reached():
            return {
                'accessible': False,
                'reason': '已达到最大访问次数',
                'requires_password': False
            }
        
        # 检查密码
        if share.is_password_protected:
            if password is None:
                return {
                    'accessible': False,
                    'reason': '需要密码',
                    'requires_password': True
                }
            
            if not share.verify_password(password):
                return {
                    'accessible': False,
                    'reason': '密码错误',
                    'requires_password': True
                }
        
        return {
            'accessible': True,
            'reason': '',
            'requires_password': False
        }

    @staticmethod
    def record_share_access(share, request_meta=None):
        """
        记录分享访问
        
        Args:
            share: NoteShare对象
            request_meta: 请求元数据
            
        Returns:
            bool: 是否成功
        """
        return share.increment_view_count(request_meta)

    @staticmethod
    def get_user_shares(user, note=None, active_only=True):
        """
        获取用户的分享列表
        
        Args:
            user: User对象
            note: 可选的Note对象（筛选特定笔记的分享）
            active_only: 是否只返回激活的分享
            
        Returns:
            QuerySet: 分享列表
        """
        query = {'user': user}
        
        if note:
            query['note'] = note
        
        if active_only:
            query['is_active'] = True
        
        return NoteShare.objects(**query).order_by('-created_at')

    @staticmethod
    def get_shares_to_user(user, active_only=True):
        """
        获取分享给用户的分享列表
        
        Args:
            user: User对象
            active_only: 是否只返回激活的分享
            
        Returns:
            list: 分享列表
        """
        # 使用Q对象构建一个更高效的OR查询
        query = Q(share_type='email', share_to=user.email) | Q(share_type='user', share_to=str(user.id))

        if active_only:
            query &= Q(is_active=True)
            # 过滤掉已过期的分享
            query &= (Q(expires_at__exists=False) | Q(expires_at__gt=timezone.now()))

        return NoteShare.objects(query).order_by('-created_at')

