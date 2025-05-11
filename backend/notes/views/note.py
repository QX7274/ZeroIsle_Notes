"""
笔记视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
import uuid
import os
import logging
import tempfile
from PIL import Image
import io

# 尝试导入PDF和Word处理库
try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

try:
    from docx import Document
    PYTHON_DOCX_AVAILABLE = True
except ImportError:
    PYTHON_DOCX_AVAILABLE = False

from notes.mongodb_models import Note
from notes.serializers import (
    NoteSerializer,
    NoteListSerializer,
    NoteDetailSerializer,
    NoteCreateUpdateSerializer
)
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

# 配置日志
logger = logging.getLogger(__name__)

class NoteViewSet(viewsets.ModelViewSet):
    """笔记视图集"""
    serializer_class = NoteSerializer
    permission_classes = [IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_favorite', 'is_public']
    search_fields = ['title', 'content', 'tags__name']
    ordering_fields = ['created_at', 'updated_at', 'title', 'view_count']
    ordering = ['-updated_at']

    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        # 基础查询：用户自己的未删除笔记 或 公开的未删除笔记
        from mongoengine.queryset.visitor import Q
        queryset = Note.objects.filter(
            Q(user=user, is_deleted=False) |
            Q(is_public=True, is_deleted=False)
        )
        return queryset

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return NoteListSerializer
        elif self.action == 'retrieve':
            return NoteDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return NoteCreateUpdateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """创建笔记时设置用户"""
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """查看笔记详情时更新查看次数和最后查看时间"""
        instance = self.get_object()
        # 只有非笔记所有者查看时才增加查看次数
        if instance.user != request.user:
            instance.view_count += 1
            instance.save(update_fields=['view_count'])

        # 如果是笔记所有者，更新最后查看时间
        if instance.user == request.user:
            instance.last_viewed_at = timezone.now()
            instance.save(update_fields=['last_viewed_at'])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def favorites(self, request):
        """获取收藏的笔记"""
        queryset = self.get_queryset().filter(user=request.user, is_favorite=True)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = NoteListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = NoteListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """切换笔记收藏状态"""
        note = self.get_object()
        if note.user != request.user:
            return Response(
                {"detail": "您不能收藏其他用户的笔记"},
                status=status.HTTP_403_FORBIDDEN
            )

        note.is_favorite = not note.is_favorite
        note.save(update_fields=['is_favorite'])
        return Response({"is_favorite": note.is_favorite})

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近查看的笔记"""
        queryset = self.get_queryset().filter(
            user=request.user,
            last_viewed_at__isnull=False
        ).order_by('-last_viewed_at')[:10]
        serializer = NoteListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取笔记统计信息"""
        user = request.user
        total_count = Note.objects.filter(user=user, is_deleted=False).count()
        favorite_count = Note.objects.filter(user=user, is_favorite=True, is_deleted=False).count()
        public_count = Note.objects.filter(user=user, is_public=True, is_deleted=False).count()
        deleted_count = Note.objects.filter(user=user, is_deleted=True).count()

        return Response({
            "total_count": total_count,
            "favorite_count": favorite_count,
            "public_count": public_count,
            "deleted_count": deleted_count
        })

    @action(detail=False, methods=['post'], url_path='import')
    def import_note(self, request):
        """通用导入笔记"""
        try:
            # 获取文件和类型
            file = request.FILES.get('file')
            file_type = request.data.get('type', '').lower()

            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 根据文件类型调用相应的导入方法
            if file_type == 'pdf':
                return self.import_pdf_internal(request, file)
            elif file_type == 'word':
                return self.import_word_internal(request, file)
            elif file_type == 'image':
                return self.import_image_internal(request, file)
            elif file_type == 'text':
                return self.import_text_internal(request, file)
            else:
                return Response(
                    {'error': '不支持的文件类型，仅支持PDF、Word、图片和文本文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"导入笔记失败: {str(e)}")
            return Response(
                {'error': f'导入笔记失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='import/pdf')
    def import_pdf(self, request):
        """导入PDF文档为笔记"""
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return self.import_pdf_internal(request, file)
        except Exception as e:
            logger.error(f"导入PDF失败: {str(e)}")
            return Response(
                {'error': f'导入PDF失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def import_pdf_internal(self, request, file):
        """内部方法：处理PDF导入"""
        if not PYPDF2_AVAILABLE:
            return Response(
                {'error': 'PyPDF2库未安装，无法处理PDF文件'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        try:
            # 提取文件内容
            title = os.path.splitext(file.name)[0]  # 使用文件名作为标题
            content = ""

            try:
                with open(temp_file_path, 'rb') as f:
                    pdf_reader = PyPDF2.PdfReader(f)
                    for page_num in range(len(pdf_reader.pages)):
                        page = pdf_reader.pages[page_num]
                        content += page.extract_text() + "\n\n"
            except Exception as e:
                logger.error(f"PDF解析错误: {str(e)}")
                os.unlink(temp_file_path)  # 删除临时文件
                return Response(
                    {'error': f'PDF解析错误: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 删除临时文件
            os.unlink(temp_file_path)

            # 创建笔记
            note = Note(
                id=uuid.uuid4(),
                user=request.user,
                title=title,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            note.save()

            # 返回结果
            return Response({
                'message': '导入PDF成功',
                'note_id': str(note.id),
                'title': note.title
            })
        except Exception as e:
            # 确保临时文件被删除
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    @action(detail=False, methods=['post'], url_path='import/word')
    def import_word(self, request):
        """导入Word文档为笔记"""
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return self.import_word_internal(request, file)
        except Exception as e:
            logger.error(f"导入Word失败: {str(e)}")
            return Response(
                {'error': f'导入Word失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def import_word_internal(self, request, file):
        """内部方法：处理Word导入"""
        if not PYTHON_DOCX_AVAILABLE:
            return Response(
                {'error': 'python-docx库未安装，无法处理Word文件'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        try:
            # 提取文件内容
            title = os.path.splitext(file.name)[0]  # 使用文件名作为标题
            content = ""

            try:
                doc = Document(temp_file_path)
                for para in doc.paragraphs:
                    content += para.text + "\n"
            except Exception as e:
                logger.error(f"Word解析错误: {str(e)}")
                os.unlink(temp_file_path)  # 删除临时文件
                return Response(
                    {'error': f'Word解析错误: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 删除临时文件
            os.unlink(temp_file_path)

            # 创建笔记
            note = Note(
                id=uuid.uuid4(),
                user=request.user,
                title=title,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            note.save()

            # 返回结果
            return Response({
                'message': '导入Word成功',
                'note_id': str(note.id),
                'title': note.title
            })
        except Exception as e:
            # 确保临时文件被删除
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    @action(detail=False, methods=['post'], url_path='import/image')
    def import_image(self, request):
        """导入图片为笔记"""
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return self.import_image_internal(request, file)
        except Exception as e:
            logger.error(f"导入图片失败: {str(e)}")
            return Response(
                {'error': f'导入图片失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def import_image_internal(self, request, file):
        """内部方法：处理图片导入"""
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.img') as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        try:
            # 提取文件信息
            title = os.path.splitext(file.name)[0]  # 使用文件名作为标题
            content = f"![{title}](data:image/{os.path.splitext(file.name)[1][1:]};base64,IMAGE_DATA_PLACEHOLDER)"

            # 删除临时文件
            os.unlink(temp_file_path)

            # 创建笔记
            note = Note(
                id=uuid.uuid4(),
                user=request.user,
                title=title,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            note.save()

            # 返回结果
            return Response({
                'message': '导入图片成功',
                'note_id': str(note.id),
                'title': note.title
            })
        except Exception as e:
            # 确保临时文件被删除
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    @action(detail=False, methods=['post'], url_path='import/text')
    def import_text(self, request):
        """导入文本文件为笔记"""
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return self.import_text_internal(request, file)
        except Exception as e:
            logger.error(f"导入文本失败: {str(e)}")
            return Response(
                {'error': f'导入文本失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def import_text_internal(self, request, file):
        """内部方法：处理文本导入"""
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_file_path = temp_file.name

        try:
            # 提取文件内容
            title = os.path.splitext(file.name)[0]  # 使用文件名作为标题

            try:
                with open(temp_file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                # 尝试其他编码
                try:
                    with open(temp_file_path, 'r', encoding='gbk') as f:
                        content = f.read()
                except UnicodeDecodeError:
                    with open(temp_file_path, 'r', encoding='latin-1') as f:
                        content = f.read()

            # 删除临时文件
            os.unlink(temp_file_path)

            # 创建笔记
            note = Note(
                id=uuid.uuid4(),
                user=request.user,
                title=title,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            note.save()

            # 返回结果
            return Response({
                'message': '导入文本成功',
                'note_id': str(note.id),
                'title': note.title
            })
        except Exception as e:
            # 确保临时文件被删除
            try:
                os.unlink(temp_file_path)
            except:
                pass
            raise e

    @action(detail=True, methods=['post'])
    def append(self, request, pk=None):
        """向笔记添加内容"""
        try:
            note = self.get_object()

            # 检查权限
            if note.user != request.user:
                return Response(
                    {"detail": "您不能编辑其他用户的笔记"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 获取要添加的内容
            content = request.data.get('content', '')
            if not content:
                return Response(
                    {'error': '未提供内容'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 添加内容到笔记
            note.content += f"\n\n{content}"
            note.updated_at = timezone.now()
            note.save()

            return Response({
                'message': '内容已添加到笔记',
                'note_id': str(note.id)
            })
        except Exception as e:
            logger.error(f"向笔记添加内容失败: {str(e)}")
            return Response(
                {'error': f'向笔记添加内容失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
