"""
注释视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from notes.mongodb_models import Annotation, Note
from notes.serializers.annotation import AnnotationSerializer, AnnotationListSerializer
from notes.permissions import IsOwnerOrReadOnly
import logging

# 配置日志
logger = logging.getLogger(__name__)

class AnnotationViewSet(viewsets.ModelViewSet):
    """
    注释视图集
    提供注释的CRUD操作
    """
    serializer_class = AnnotationSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """
        获取查询集
        根据用户过滤注释
        """
        user = self.request.user
        return Annotation.objects.filter(user=user, is_deleted=False)
    
    def list(self, request, *args, **kwargs):
        """
        列出用户的所有注释
        """
        queryset = self.get_queryset()
        note_id = request.query_params.get('note_id')
        page = request.query_params.get('page')
        
        if note_id:
            queryset = queryset.filter(note=note_id)
        
        if page:
            queryset = queryset.filter(page=int(page))
        
        serializer = AnnotationListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """
        创建注释
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                annotation = serializer.save()
                return Response(
                    AnnotationSerializer(annotation).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                logger.error(f"创建注释失败: {str(e)}")
                return Response(
                    {'detail': f'创建注释失败: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """
        更新注释
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            try:
                annotation = serializer.save()
                return Response(AnnotationSerializer(annotation).data)
            except Exception as e:
                logger.error(f"更新注释失败: {str(e)}")
                return Response(
                    {'detail': f'更新注释失败: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """
        删除注释
        """
        instance = self.get_object()
        try:
            instance.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"删除注释失败: {str(e)}")
            return Response(
                {'detail': f'删除注释失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def by_note(self, request):
        """
        获取笔记的所有注释
        """
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {'detail': '缺少note_id参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            note = Note.objects.get(id=note_id)
            
            # 检查权限
            if note.user != request.user and not note.is_public:
                return Response(
                    {'detail': '您没有权限查看此笔记的注释'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            annotations = Annotation.objects.filter(note=note, is_deleted=False)
            serializer = AnnotationSerializer(annotations, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response(
                {'detail': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"获取笔记注释失败: {str(e)}")
            return Response(
                {'detail': f'获取笔记注释失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def by_page(self, request):
        """
        获取笔记特定页面的所有注释
        """
        note_id = request.query_params.get('note_id')
        page = request.query_params.get('page')
        
        if not note_id or not page:
            return Response(
                {'detail': '缺少note_id或page参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            note = Note.objects.get(id=note_id)
            
            # 检查权限
            if note.user != request.user and not note.is_public:
                return Response(
                    {'detail': '您没有权限查看此笔记的注释'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            annotations = Annotation.objects.filter(
                note=note,
                page=int(page),
                is_deleted=False
            )
            serializer = AnnotationSerializer(annotations, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response(
                {'detail': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"获取页面注释失败: {str(e)}")
            return Response(
                {'detail': f'获取页面注释失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
