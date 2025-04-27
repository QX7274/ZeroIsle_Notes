"""
笔记模块权限类
"""

from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    自定义权限，只允许对象的所有者编辑它
    """
    
    def has_object_permission(self, request, view, obj):
        # 读取权限允许任何请求
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # 写入权限只允许对象的所有者
        return obj.user == request.user


class IsNoteOwner(permissions.BasePermission):
    """
    自定义权限，只允许笔记的所有者操作
    """
    
    def has_permission(self, request, view):
        # 创建时检查note_id参数
        if request.method == 'POST' and 'note' in request.data:
            from notes.models import Note
            try:
                note = Note.objects.get(id=request.data['note'])
                return note.user == request.user
            except Note.DoesNotExist:
                return False
        return True
    
    def has_object_permission(self, request, view, obj):
        # 检查对象关联的笔记是否属于当前用户
        return obj.note.user == request.user


class IsSharedWithUser(permissions.BasePermission):
    """
    自定义权限，允许笔记的所有者或被分享的用户访问
    """
    
    def has_object_permission(self, request, view, obj):
        # 笔记所有者有所有权限
        if obj.user == request.user:
            return True
        
        # 公开笔记所有人都可以查看
        if obj.is_public and request.method in permissions.SAFE_METHODS:
            return True
        
        # 检查是否通过分享获得了权限
        if hasattr(obj, 'shares'):
            # 通过用户分享
            if obj.shares.filter(shared_with=request.user, is_active=True).exists():
                return True
            
            # 通过链接分享且有密码验证
            if 'share_code' in request.query_params and 'password' in request.query_params:
                share = obj.shares.filter(
                    share_code=request.query_params['share_code'],
                    is_active=True
                ).first()
                if share and share.password == request.query_params['password']:
                    return True
        
        # 检查是否通过协作获得了权限
        if hasattr(obj, 'collaborations'):
            collab = obj.collaborations.filter(user=request.user, is_active=True).first()
            if collab:
                # 根据协作权限级别判断
                if request.method in permissions.SAFE_METHODS and collab.can_view():
                    return True
                elif request.method == 'POST' and collab.can_comment():
                    return True
                elif request.method in ['PUT', 'PATCH'] and collab.can_edit():
                    return True
                elif request.method == 'DELETE' and collab.can_admin():
                    return True
        
        return False
