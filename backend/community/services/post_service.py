"""
帖子服务
"""

import logging
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q
from community.mongodb_models import Post, Category, Tag, Follow
from search.services import IndexerService

logger = logging.getLogger('backend')

class PostService:
    """
    帖子服务类
    处理帖子相关的业务逻辑
    """

    def __init__(self):
        """初始化"""
        self.indexer_service = IndexerService()

    def create_post(self, user, data):
        """
        创建帖子

        Args:
            user: 用户对象
            data: 帖子数据

        Returns:
            Post: 创建的帖子
        """
        try:
            # 获取分类
            category = None
            if 'category_id' in data and data['category_id']:
                try:
                    category = Category.objects.get(id=data['category_id'])
                except Category.DoesNotExist:
                    pass

            # 创建帖子
            post = Post(
                id=uuid.uuid4(),
                user=user,
                title=data['title'],
                content=data['content'],
                excerpt=data.get('excerpt', ''),
                status=data.get('status', 'published'),
                category=category,
                cover_image=data.get('cover_image', ''),
                allow_comments=data.get('allow_comments', True),
                is_public=data.get('is_public', True),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 添加标签
            if 'tags' in data and data['tags']:
                tags = []
                for tag_name in data['tags']:
                    try:
                        tag = Tag.objects.get(name=tag_name)
                    except Tag.DoesNotExist:
                        tag = Tag(
                            id=uuid.uuid4(),
                            name=tag_name,
                            slug=tag_name.lower().replace(' ', '-'),
                            created_at=timezone.now(),
                            updated_at=timezone.now()
                        )
                        tag.save()
                    tags.append(tag_name)
                post.tags = tags

            # 如果是已发布状态，设置发布时间
            if post.status == 'published':
                post.published_at = timezone.now()

            # 保存帖子
            post.save()

            # 如果是已发布状态，索引帖子
            if post.status == 'published':
                self._index_post(post)

            # 通知关注者
            self._notify_followers(post)

            return post
        except Exception as e:
            logger.error(f"创建帖子失败: {e}")
            raise

    def update_post(self, post, data):
        """
        更新帖子

        Args:
            post: 帖子对象
            data: 帖子数据

        Returns:
            Post: 更新的帖子
        """
        try:
            # 获取旧状态
            old_status = post.status

            # 更新分类
            if 'category_id' in data:
                if data['category_id']:
                    try:
                        post.category = Category.objects.get(id=data['category_id'])
                    except Category.DoesNotExist:
                        post.category = None
                else:
                    post.category = None

            # 更新帖子字段
            for field in ['title', 'content', 'excerpt', 'status', 'cover_image', 'allow_comments', 'is_public']:
                if field in data:
                    setattr(post, field, data[field])

            # 更新标签
            if 'tags' in data:
                tags = []
                for tag_name in data['tags']:
                    try:
                        tag = Tag.objects.get(name=tag_name)
                    except Tag.DoesNotExist:
                        tag = Tag(
                            id=uuid.uuid4(),
                            name=tag_name,
                            slug=tag_name.lower().replace(' ', '-'),
                            created_at=timezone.now(),
                            updated_at=timezone.now()
                        )
                        tag.save()
                    tags.append(tag_name)
                post.tags = tags

            # 如果状态从非发布变为发布，设置发布时间
            if old_status != 'published' and post.status == 'published':
                post.published_at = timezone.now()

            # 更新时间
            post.updated_at = timezone.now()

            # 保存帖子
            post.save()

            # 如果状态从非发布变为发布，索引帖子
            if old_status != 'published' and post.status == 'published':
                self._index_post(post)
            # 如果状态从发布变为非发布，移除索引
            elif old_status == 'published' and post.status != 'published':
                self._remove_post_index(post)
            # 如果状态保持发布，更新索引
            elif old_status == 'published' and post.status == 'published':
                self._index_post(post)

            return post
        except Exception as e:
            logger.error(f"更新帖子失败: {e}")
            raise

    def delete_post(self, post):
        """
        删除帖子

        Args:
            post: 帖子对象

        Returns:
            bool: 是否成功
        """
        try:
            # 移除索引
            self._remove_post_index(post)

            # 软删除帖子
            post.delete()

            return True
        except Exception as e:
            logger.error(f"删除帖子失败: {e}")
            raise

    def get_post_by_id(self, post_id, user=None, increment_view=False):
        """
        根据ID获取帖子

        Args:
            post_id: 帖子ID
            user: 用户对象
            increment_view: 是否增加浏览次数

        Returns:
            Post: 帖子对象
        """
        try:
            # 构建查询条件
            if user and user.is_authenticated:
                # 用户可以查看自己的所有帖子和他人的公开已发布帖子
                post = Post.objects.filter(
                    id=post_id,
                    is_deleted=False
                ).filter(
                    Q(user=user) |
                    (Q(is_public=True) & Q(status='published'))
                ).first()
            else:
                # 未登录用户只能查看公开已发布帖子
                post = Post.objects.filter(
                    id=post_id,
                    is_deleted=False,
                    is_public=True,
                    status='published'
                ).first()

            if not post:
                raise Post.DoesNotExist(f"帖子不存在或无权访问: {post_id}")

            # 增加浏览次数
            if increment_view:
                post.increment_view_count()

            return post
        except Post.DoesNotExist:
            logger.error(f"帖子不存在: {post_id}")
            raise
        except Exception as e:
            logger.error(f"获取帖子失败: {e}")
            raise

    def get_posts(self, filters=None, user=None, page=1, page_size=20):
        """
        获取帖子列表

        Args:
            filters: 过滤条件
            user: 用户对象
            page: 页码
            page_size: 每页大小

        Returns:
            tuple: (帖子列表, 总数)
        """
        try:
            # 构建查询条件
            queryset = Post.objects.filter(is_deleted=False)

            if user and user.is_authenticated:
                if filters and filters.get('user_id') == user.id:
                    # 查看自己的帖子，可以看到所有状态
                    queryset = queryset.filter(user=user)
                else:
                    # 查看他人的帖子，只能看到公开已发布的
                    queryset = queryset.filter(
                        Q(user=user) |
                        (Q(is_public=True) & Q(status='published'))
                    )
            else:
                # 未登录用户只能查看公开已发布帖子
                queryset = queryset.filter(is_public=True, status='published')

            # 应用过滤条件
            if filters:
                if 'category_id' in filters:
                    queryset = queryset.filter(category_id=filters['category_id'])

                if 'tag_id' in filters:
                    queryset = queryset.filter(tags__id=filters['tag_id'])

                if 'tag_name' in filters:
                    queryset = queryset.filter(tags__name=filters['tag_name'])

                if 'user_id' in filters and filters['user_id'] != user.id:
                    queryset = queryset.filter(user_id=filters['user_id'], is_public=True, status='published')

                if 'status' in filters and user and filters.get('user_id') == user.id:
                    queryset = queryset.filter(status=filters['status'])

                if 'is_pinned' in filters:
                    queryset = queryset.filter(is_pinned=filters['is_pinned'])

                if 'is_featured' in filters:
                    queryset = queryset.filter(is_featured=filters['is_featured'])

                if 'search' in filters:
                    search_term = filters['search']
                    queryset = queryset.filter(
                        Q(title__icontains=search_term) |
                        Q(content__icontains=search_term) |
                        Q(excerpt__icontains=search_term)
                    )

            # 获取总数
            total = queryset.count()

            # 分页
            start = (page - 1) * page_size
            end = start + page_size

            # 排序并获取结果
            posts = queryset.order_by('-is_pinned', '-published_at', '-created_at')[start:end]

            return posts, total
        except Exception as e:
            logger.error(f"获取帖子列表失败: {e}")
            raise

    def _index_post(self, post):
        """
        索引帖子

        Args:
            post: 帖子对象

        Returns:
            bool: 是否成功
        """
        try:
            # 只索引已发布的帖子
            if post.status != 'published':
                return False

            # 索引帖子
            self.indexer_service.index_object(
                obj=post,
                index_type='community_post',
                user=post.user,
                is_public=post.is_public
            )

            return True
        except Exception as e:
            logger.error(f"索引帖子失败: {e}")
            return False

    def _remove_post_index(self, post):
        """
        移除帖子索引

        Args:
            post: 帖子对象

        Returns:
            bool: 是否成功
        """
        try:
            # 移除索引
            self.indexer_service.remove_index(post)

            return True
        except Exception as e:
            logger.error(f"移除帖子索引失败: {e}")
            return False

    def _notify_followers(self, post):
        """
        通知关注者

        Args:
            post: 帖子对象

        Returns:
            int: 通知数量
        """
        try:
            from .notification_service import NotificationService

            # 只通知已发布的帖子
            if post.status != 'published':
                return 0

            # 获取用户的关注者
            followers = Follow.objects.filter(
                content_type='User',
                object_id=str(post.user.id),
                is_active=True
            )

            # 创建通知
            notification_service = NotificationService()
            count = 0

            for follow in followers:
                notification_service.create_notification(
                    recipient=follow.user,
                    notification_type='system',
                    title=f"新帖子: {post.title}",
                    message=f"{post.user.username} 发布了新帖子: {post.title}",
                    sender=post.user,
                    content_type='Post',
                    object_id=str(post.id)
                )
                count += 1

            return count
        except Exception as e:
            logger.error(f"通知关注者失败: {e}")
            return 0
