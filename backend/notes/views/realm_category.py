"""
MongoDB Realm分类视图
使用MongoDB Realm服务替代SQLite服务
"""

from rest_framework import viewsets, permissions, response, status
from rest_framework.decorators import action
from django.utils import timezone
from notes.mongodb_models import Category, Note
from notes.serializers import CategorySerializer
from common.permissions import IsOwnerOrReadOnly
from mongodb_service import mongodb_service
import uuid
import logging

logger = logging.getLogger(__name__)

class RealmCategoryViewSet(viewsets.ViewSet):
    """
    MongoDB Realm分类视图集
    提供分类的CRUD操作
    """
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]

    def list(self, request):
        """获取当前用户的分类列表"""
        categories = Category.objects.filter(user=request.user, is_deleted=False)
        serializer = CategorySerializer(categories, many=True)
        return response.Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个分类详情"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CategorySerializer(category)
            return response.Response(serializer.data)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建分类"""
        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            # 处理父分类
            parent = None
            parent_id = serializer.validated_data.get('parent')
            if parent_id:
                try:
                    parent = Category.objects.get(id=parent_id, user=request.user, is_deleted=False)
                except Category.DoesNotExist:
                    return response.Response(
                        {"detail": "父分类不存在或已删除"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 创建分类
            category_data = {
                'id': uuid.uuid4(),
                'user': request.user,
                'name': serializer.validated_data['name'],
                'description': serializer.validated_data.get('description', ''),
                'color': serializer.validated_data.get('color'),
                'parent': parent,
                'created_at': timezone.now(),
                'updated_at': timezone.now(),
                'realm_sync_status': 'pending'
            }

            category = Category(**category_data)
            category.save()

            # 返回序列化后的分类
            serializer = CategorySerializer(category)
            return response.Response(serializer.data, status=status.HTTP_201_CREATED)

        return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新分类"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CategorySerializer(data=request.data)

            if serializer.is_valid():
                # 处理父分类
                parent = category.parent
                parent_id = serializer.validated_data.get('parent')
                if parent_id:
                    try:
                        parent = Category.objects.get(id=parent_id, user=request.user, is_deleted=False)

                        # 检查是否会形成循环引用
                        if str(parent.id) == str(category.id):
                            return response.Response(
                                {"detail": "不能将分类设为自己的父分类"},
                                status=status.HTTP_400_BAD_REQUEST
                            )

                        # 检查是否会形成多级循环引用
                        current_parent = parent
                        while current_parent:
                            if str(current_parent.id) == str(category.id):
                                return response.Response(
                                    {"detail": "不能形成循环引用"},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                            current_parent = current_parent.parent

                    except Category.DoesNotExist:
                        return response.Response(
                            {"detail": "父分类不存在或已删除"},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                # 更新分类
                category.name = serializer.validated_data['name']
                category.description = serializer.validated_data.get('description', category.description)
                category.color = serializer.validated_data.get('color', category.color)
                category.parent = parent
                category.updated_at = timezone.now()
                category.realm_sync_status = 'pending'
                category.save()

                # 返回序列化后的分类
                serializer = CategorySerializer(category)
                return response.Response(serializer.data)

            return response.Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除分类"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)

            # 检查是否有子分类
            if Category.objects.filter(parent=category, is_deleted=False).count() > 0:
                return response.Response(
                    {"detail": "该分类下有子分类，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 检查是否有笔记
            if Note.objects.filter(category=category, is_deleted=False).count() > 0:
                return response.Response(
                    {"detail": "该分类下有笔记，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 软删除分类
            category.is_deleted = True
            category.deleted_at = timezone.now()
            category.realm_sync_status = 'pending'
            category.save()

            return response.Response(status=status.HTTP_204_NO_CONTENT)
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def notes(self, request, pk=None):
        """获取分类下的笔记"""
        try:
            category = Category.objects.get(id=pk, user=request.user, is_deleted=False)
            notes = Note.objects.filter(category=category, user=request.user, is_deleted=False)

            # 分页
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 10))
            start = (page - 1) * page_size
            end = start + page_size

            # 排序
            ordering = request.query_params.get('ordering', '-updated_at')
            notes = notes.order_by(ordering)

            # 序列化
            from notes.serializers import NoteListSerializer
            serializer = NoteListSerializer(notes[start:end], many=True, context={'request': request})

            return response.Response({
                'count': notes.count(),
                'results': serializer.data
            })
        except Category.DoesNotExist:
            return response.Response(
                {"detail": "分类不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """获取分类树"""
        categories = Category.objects.filter(user=request.user, is_deleted=False)

        # 构建分类树
        category_dict = {}
        for category in categories:
            category_dict[str(category.id)] = {
                'id': str(category.id),
                'name': category.name,
                'description': category.description,
                'color': category.color,
                'parent': str(category.parent.id) if category.parent else None,
                'children': []
            }

        # 构建树结构
        tree = []
        for category_id, category_data in category_dict.items():
            if category_data['parent'] is None:
                tree.append(category_data)
            else:
                parent_id = category_data['parent']
                if parent_id in category_dict:
                    category_dict[parent_id]['children'].append(category_data)

        return response.Response(tree)
