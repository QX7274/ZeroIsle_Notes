"""
笔记模板视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteTemplate, Note, Category
from notes.serializers import NoteTemplateSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import uuid

logger = logging.getLogger(__name__)

class NoteTemplateViewSet(viewsets.ViewSet):
    """
    笔记模板视图集
    """
    serializer_class = NoteTemplateSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取模板列表"""
        user = request.user
        category_id = request.query_params.get('category')

        if category_id:
            try:
                category = Category.objects.get(id=category_id, user=user)
                templates = NoteTemplate.objects.filter(user=user, category=category, is_deleted=False)
            except Category.DoesNotExist:
                templates = NoteTemplate.objects.filter(user=user, is_deleted=False)
        else:
            templates = NoteTemplate.objects.filter(user=user, is_deleted=False)

        serializer = NoteTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个模板详情"""
        try:
            template = NoteTemplate.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if template.user == request.user or template.is_public:
                serializer = NoteTemplateSerializer(template)
                return Response(serializer.data)
            else:
                return Response(
                    {"detail": "您没有权限查看此模板"},
                    status=status.HTTP_403_FORBIDDEN
                )
        except NoteTemplate.DoesNotExist:
            return Response(
                {"detail": "模板不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建模板"""
        serializer = NoteTemplateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取分类
            category_id = request.data.get('category')
            category = None
            if category_id:
                try:
                    category = Category.objects.get(id=category_id, user=request.user)
                except Category.DoesNotExist:
                    pass

            # 获取标签
            tag_ids = request.data.get('tags', [])
            tags = []
            if tag_ids:
                from notes.mongodb_models import Tag
                tags = Tag.objects.filter(id__in=tag_ids, user=request.user)

            # 创建模板
            template = NoteTemplate(
                id=uuid.uuid4(),
                user=request.user,
                title=request.data.get('title'),
                content=request.data.get('content'),
                category=category,
                tags=tags,
                is_public=request.data.get('is_public', False),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            template.save()

            serializer = NoteTemplateSerializer(template)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新模板"""
        try:
            template = NoteTemplate.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteTemplateSerializer(template, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新基本信息
                template.title = request.data.get('title', template.title)
                template.content = request.data.get('content', template.content)
                template.is_public = request.data.get('is_public', template.is_public)

                # 更新分类
                category_id = request.data.get('category')
                if category_id:
                    try:
                        category = Category.objects.get(id=category_id, user=request.user)
                        template.category = category
                    except Category.DoesNotExist:
                        pass
                elif 'category' in request.data:
                    template.category = None

                # 更新标签
                tag_ids = request.data.get('tags')
                if tag_ids is not None:
                    from notes.mongodb_models import Tag
                    tags = Tag.objects.filter(id__in=tag_ids, user=request.user)
                    template.tags = tags

                template.updated_at = timezone.now()
                template.save()

                serializer = NoteTemplateSerializer(template)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteTemplate.DoesNotExist:
            return Response(
                {"detail": "模板不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除模板"""
        try:
            template = NoteTemplate.objects.get(id=pk, user=request.user, is_deleted=False)
            template.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteTemplate.DoesNotExist:
            return Response(
                {"detail": "模板不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """应用模板"""
        try:
            template = NoteTemplate.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if not (template.user == request.user or template.is_public):
                return Response(
                    {"detail": "您没有权限使用此模板"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 创建新笔记
            note = Note(
                id=uuid.uuid4(),
                user=request.user,
                title=f"{template.title} - 副本",
                content=template.content,
                category=template.category if template.user == request.user else None,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 复制标签
            if template.user == request.user and template.tags:
                note.tags = template.tags

            note.save()

            # 增加模板使用次数
            template.increment_view_count()

            return Response({
                'message': '模板应用成功',
                'note_id': str(note.id)
            })
        except NoteTemplate.DoesNotExist:
            return Response(
                {"detail": "模板不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"应用模板失败: {str(e)}")
            return Response(
                {'error': f'应用模板失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """获取模板分类"""
        try:
            # 获取用户的所有模板分类
            templates = NoteTemplate.objects.filter(user=request.user, is_deleted=False)
            categories = set()
            for template in templates:
                if template.category:
                    categories.add(template.category)

            # 序列化分类
            from notes.serializers import CategorySerializer
            serializer = CategorySerializer(list(categories), many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取模板分类失败: {str(e)}")
            return Response(
                {'error': f'获取模板分类失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def public_templates(self, request):
        """获取公共模板"""
        try:
            templates = NoteTemplate.objects.filter(is_public=True, is_deleted=False)
            serializer = NoteTemplateSerializer(templates, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取公共模板失败: {str(e)}")
            return Response(
                {'error': f'获取公共模板失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )