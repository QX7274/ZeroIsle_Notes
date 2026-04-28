"""
自定义权限类
"""

from rest_framework import permissions

class IsOwner(permissions.BasePermission):
    """
    对象所有者权限
    只允许对象的所有者访问
    """

    def has_object_permission(self, request, view, obj):
        # 检查对象是否有user属性
        if hasattr(obj, 'user') and hasattr(request, 'user') and request.user.is_authenticated:
            # 兼容 Django User 和 MongoEngine User 的比较
            return obj.user.id == request.user.id

        # 检查对象是否有owner属性
        if hasattr(obj, 'owner'):
            return obj.owner == request.user

        # 检查对象是否有creator属性
        if hasattr(obj, 'creator'):
            return obj.creator == request.user

        # 检查对象是否有author属性
        if hasattr(obj, 'author'):
            return obj.author.id == request.user.id

        # 检查 recipient 属性（用于通知）
        if hasattr(obj, 'recipient'):
            return obj.recipient.id == request.user.id

        # 针对 ReminderNotification 的特殊检查
        if hasattr(obj, 'reminder') and hasattr(obj.reminder, 'user'):
            return obj.reminder.user.id == request.user.id

        # 默认不允许访问
        return False

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    对象所有者或只读权限
    允许所有人读取，但只有所有者可以修改
    """

    def has_object_permission(self, request, view, obj):
        # 允许GET, HEAD, OPTIONS请求
        if request.method in permissions.SAFE_METHODS:
            return True

        # 检查对象是否有user属性
        if hasattr(obj, 'user') and hasattr(request, 'user') and request.user.is_authenticated:
            obj_user = getattr(obj, 'user', None)
            req_user = request.user
            req_mongo_user = getattr(request, 'mongo_user', None)

            # 优先：Mongo 用户直接比较
            if obj_user is not None and req_mongo_user is not None:
                if getattr(obj_user, 'id', None) == getattr(req_mongo_user, 'id', None):
                    return True

            # 其次：Mongo 用户记录了 django_user_id
            obj_django_user_id = getattr(obj_user, 'django_user_id', None)
            if obj_django_user_id and str(obj_django_user_id) == str(getattr(req_user, 'id', '')):
                return True

            # 回退：同类型对象直接比较 id
            return getattr(obj_user, 'id', None) == getattr(req_user, 'id', None)

        # 检查对象是否有owner属性
        if hasattr(obj, 'owner'):
            return obj.owner == request.user

        # 检查对象是否有creator属性
        if hasattr(obj, 'creator'):
            return obj.creator == request.user

        # 检查对象是否有author属性
        if hasattr(obj, 'author'):
            return obj.author.id == request.user.id

        # 检查 recipient 属性（用于通知）
        if hasattr(obj, 'recipient'):
            return obj.recipient.id == request.user.id

        # 针对 ReminderNotification 的特殊检查
        if hasattr(obj, 'reminder') and hasattr(obj.reminder, 'user'):
            return obj.reminder.user.id == request.user.id

        # 默认不允许访问
        return False

class IsAdminOrReadOnly(permissions.BasePermission):
    """
    管理员或只读权限
    允许所有人读取，但只有管理员可以修改
    """

    def has_permission(self, request, view):
        # 允许GET, HEAD, OPTIONS请求
        if request.method in permissions.SAFE_METHODS:
            return True

        # 只允许管理员进行修改
        return request.user and request.user.is_staff


class ReadOnly(permissions.BasePermission):
    """
    只读权限
    只允许GET, HEAD, OPTIONS请求
    """

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
