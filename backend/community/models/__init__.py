"""
社区模块模型初始化文件
导入所有模型以便在其他地方直接从community.models导入
"""

from .post import Post
from .comment import Comment
from .category import Category
from .tag import Tag
from .like import Like
from .follow import Follow
from .notification import Notification
