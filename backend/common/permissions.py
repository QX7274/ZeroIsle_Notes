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
        if hasattr(obj, 'user'):
            return obj.user == request.user

        # 检查对象是否有owner属性
        if hasattr(obj, 'owner'):
            return obj.owner == request.user

        # 检查对象是否有creator属性
        if hasattr(obj, 'creator'):
            return obj.creator == request.user

        # 检查对象是否有author属性
        if hasattr(obj, 'author'):
            return obj.author == request.user

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
        if hasattr(obj, 'user'):
            return obj.user == request.user

        # 检查对象是否有owner属性
        if hasattr(obj, 'owner'):
            return obj.owner == request.user

        # 检查对象是否有creator属性
        if hasattr(obj, 'creator'):
            return obj.creator == request.user

        # 检查对象是否有author属性
        if hasattr(obj, 'author'):
            return obj.author == request.user

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
