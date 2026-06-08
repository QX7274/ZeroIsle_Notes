"""
社区权限服务
"""

from functools import lru_cache
from ..mongodb_models import Post
from groups.mongodb_models import GroupMember

class CommunityPermissionService:
    """
    封装社区模块的权限检查逻辑，提供统一的、可复用的权限检查方法。
    """

    @staticmethod
    @lru_cache(maxsize=128)
    def _is_user_in_group(user_id, group_id):
        """检查用户是否为群组成员（带缓存）"""
        if not user_id or not group_id:
            return False
        return GroupMember.objects.filter(user=user_id, group=group_id, is_active=True).count() > 0

    @classmethod
    def can_view_post(cls, user, post: Post) -> bool:
        """
        检查用户是否有权限查看指定的帖子。
        这是确定帖子可见性的唯一真实来源。

        Args:
            user: 用户对象 (可以是None，代表匿名用户)
            post: 帖子对象

        Returns:
            bool: True如果用户可以查看，否则False。
        """
        # 规则1：已发布的公开帖子，任何人都可以查看
        if post.is_public and post.status == 'published':
            return True

        # 规则2：如果帖子不公开，匿名用户不能查看
        if not user:
            return False

        # 规则3：用户永远可以查看自己的帖子
        if post.user.id == user.id:
            return True

        # 规则4：如果帖子属于一个群组，检查用户是否为该群组成员
        if post.group:
            return cls._is_user_in_group(user.id, post.group.id)

        # 规则5：如果帖子不公开且不属于任何群组（即个人私密帖子），则只有作者能看
        # (此情况已在规则3中覆盖)
        return False
