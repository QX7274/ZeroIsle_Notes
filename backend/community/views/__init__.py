"""
社区模块视图初始化文件
导入所有视图以便在其他地方直接从community.views导入
"""

from .post import PostViewSet
from .comment import CommentViewSet
from .category import CategoryViewSet
from .tag import TagViewSet
from .like import LikeViewSet
from .follow import FollowViewSet
from .notification import NotificationViewSet
