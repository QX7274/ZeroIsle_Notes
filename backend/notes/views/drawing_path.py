"""
绘图路径视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from notes.mongodb_models import DrawingPath, Note
from notes.serializers.drawing_path import DrawingPathSerializer, DrawingPathListSerializer
from notes.permissions import IsOwnerOrReadOnly
import logging

# 配置日志
logger = logging.getLogger(__name__)

class DrawingPathViewSet(viewsets.ModelViewSet):
    """
    绘图路径视图集
    提供绘图路径的CRUD操作
    """
    serializer_class = DrawingPathSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """
        获取查询集
        根据用户过滤绘图路径
        """
        user = self.request.user
        return DrawingPath.objects.filter(user=user, is_deleted=False)
    
    def list(self, request, *args, **kwargs):
        """
        列出用户的所有绘图路径
        """
        queryset = self.get_queryset()
        note_id = request.query_params.get('note_id')
        canvas_id = request.query_params.get('canvas_id')
        
        if note_id:
            queryset = queryset.filter(note=note_id)
        
        if canvas_id:
            queryset = queryset.filter(canvas_id=canvas_id)
        
        serializer = DrawingPathListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """
        创建绘图路径
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                drawing_path = serializer.save()
                return Response(
                    DrawingPathSerializer(drawing_path).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                logger.error(f"创建绘图路径失败: {str(e)}")
                return Response(
                    {'detail': f'创建绘图路径失败: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        """
        更新绘图路径
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            try:
                drawing_path = serializer.save()
                return Response(DrawingPathSerializer(drawing_path).data)
            except Exception as e:
                logger.error(f"更新绘图路径失败: {str(e)}")
                return Response(
                    {'detail': f'更新绘图路径失败: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """
        删除绘图路径
        """
        instance = self.get_object()
        try:
            instance.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"删除绘图路径失败: {str(e)}")
            return Response(
                {'detail': f'删除绘图路径失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def by_note(self, request):
        """
        获取笔记的所有绘图路径
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
                    {'detail': '您没有权限查看此笔记的绘图路径'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            drawing_paths = DrawingPath.objects.filter(note=note, is_deleted=False)
            serializer = DrawingPathSerializer(drawing_paths, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response(
                {'detail': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"获取笔记绘图路径失败: {str(e)}")
            return Response(
                {'detail': f'获取笔记绘图路径失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def by_canvas(self, request):
        """
        获取画布的所有绘图路径
        """
        canvas_id = request.query_params.get('canvas_id')
        if not canvas_id:
            return Response(
                {'detail': '缺少canvas_id参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            drawing_paths = DrawingPath.objects.filter(
                canvas_id=canvas_id,
                user=request.user,
                is_deleted=False
            )
            serializer = DrawingPathSerializer(drawing_paths, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取画布绘图路径失败: {str(e)}")
            return Response(
                {'detail': f'获取画布绘图路径失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def batch_create(self, request):
        """
        批量创建绘图路径
        """
        paths_data = request.data.get('paths', [])
        if not paths_data:
            return Response(
                {'detail': '没有提供绘图路径数据'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_paths = []
        errors = []
        
        for path_data in paths_data:
            serializer = self.get_serializer(data=path_data)
            if serializer.is_valid():
                try:
                    drawing_path = serializer.save()
                    created_paths.append(DrawingPathSerializer(drawing_path).data)
                except Exception as e:
                    logger.error(f"批量创建绘图路径失败: {str(e)}")
                    errors.append({
                        'data': path_data,
                        'error': str(e)
                    })
            else:
                errors.append({
                    'data': path_data,
                    'error': serializer.errors
                })
        
        return Response({
            'created': created_paths,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_paths else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['delete'])
    def batch_delete(self, request):
        """
        批量删除绘图路径
        """
        path_ids = request.data.get('path_ids', [])
        if not path_ids:
            return Response(
                {'detail': '没有提供绘图路径ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted_count = 0
        errors = []
        
        for path_id in path_ids:
            try:
                drawing_path = DrawingPath.objects.get(id=path_id, user=request.user)
                drawing_path.delete()
                deleted_count += 1
            except DrawingPath.DoesNotExist:
                errors.append({
                    'id': path_id,
                    'error': '绘图路径不存在或无权删除'
                })
            except Exception as e:
                logger.error(f"批量删除绘图路径失败: {str(e)}")
                errors.append({
                    'id': path_id,
                    'error': str(e)
                })
        
        return Response({
            'deleted_count': deleted_count,
            'errors': errors
        })
