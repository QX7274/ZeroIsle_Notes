"""用户权限

定义用户模块使用的自定义权限类
"""

from rest_framework import permissions

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    对象级权限，只允许对象的所有者或管理员编辑它
    """
    
    def has_object_permission(self, request, view, obj):
        # 管理员始终有权限
        if request.user.is_staff or request.user.is_superuser:
            return True
            
        # 检查对象是否有user属性
        if hasattr(obj, 'user'):
            return obj.user == request.user
            
        # 如果对象本身就是用户，检查是否为当前用户
        return obj == request.user