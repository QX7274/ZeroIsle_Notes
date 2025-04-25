"""
社区模块序列化器初始化文件
导入所有序列化器以便在其他地方直接从community.serializers导入
"""

from .post import (
    PostSerializer,
    PostListSerializer,
    PostDetailSerializer,
    PostCreateSerializer,
    PostUpdateSerializer
)
from .comment import (
    CommentSerializer,
    CommentListSerializer,
    CommentDetailSerializer,
    CommentCreateSerializer,
    CommentUpdateSerializer
)
from .category import CategorySerializer
from .tag import TagSerializer
from .like import LikeSerializer
from .follow import FollowSerializer
from .notification import NotificationSerializer
