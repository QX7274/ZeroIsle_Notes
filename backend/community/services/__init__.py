"""
社区模块服务初始化文件
导入所有服务以便在其他地方直接从community.services导入
"""

from .post_service import PostService
from .comment_service import CommentService
from .like_service import LikeService
from .follow_service import FollowService
from .notification_service import NotificationService
