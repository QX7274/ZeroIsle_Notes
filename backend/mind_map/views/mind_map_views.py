"""
思维导图视图
提供思维导图的CRUD操作
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from mind_map.models import MindMap, MindMapNode, MindMapEdge
from mind_map.mongodb_models import MindMap as MongoMindMap
from mind_map.serializers import (
    MindMapSerializer,
    MindMapNodeSerializer,
    MindMapEdgeSerializer,
    MindMapDetailSerializer
)
from mind_map.serializers.mongo_serializers import (
    MongoMindMapSerializer,
    MongoMindMapDetailSerializer
)

logger = logging.getLogger(__name__)

class MindMapViewSet(viewsets.ModelViewSet):
    """
    思维导图视图集
    提供思维导图的CRUD操作
    """
    serializer_class = MindMapSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        return MindMap.objects.filter(user=self.request.user, is_deleted=False)
    
    def get_serializer_class(self):
        """获取序列化器类"""
        if self.action == 'retrieve':
            return MindMapDetailSerializer
        return MindMapSerializer
    
    def perform_create(self, serializer):
        """创建思维导图"""
        serializer.save(user=self.request.user)
    
    def perform_destroy(self, instance):
        """软删除思维导图"""
        instance.is_deleted = True
        instance.save()
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """复制思维导图"""
        try:
            mind_map = self.get_object()
            
            # 创建新的思维导图
            new_mind_map = MindMap.objects.create(
                user=request.user,
                title=f"{mind_map.title} - 副本",
                description=mind_map.description,
                data=mind_map.data,
                layout_type=mind_map.layout_type,
                theme=mind_map.theme
            )
            
            serializer = self.get_serializer(new_mind_map)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"复制思维导图失败: {str(e)}")
            return Response({'error': f'复制思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复已删除的思维导图"""
        try:
            mind_map = MindMap.objects.get(id=pk, user=request.user, is_deleted=True)
            mind_map.is_deleted = False
            mind_map.updated_at = timezone.now()
            mind_map.save()
            
            serializer = self.get_serializer(mind_map)
            return Response(serializer.data)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在或已被永久删除'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"恢复思维导图失败: {str(e)}")
            return Response({'error': f'恢复思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def trash(self, request):
        """获取已删除的思维导图"""
        queryset = MindMap.objects.filter(user=request.user, is_deleted=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def empty_trash(self, request):
        """清空回收站"""
        try:
            MindMap.objects.filter(user=request.user, is_deleted=True).delete()
            return Response({'message': '回收站已清空'})
        except Exception as e:
            logger.error(f"清空回收站失败: {str(e)}")
            return Response({'error': f'清空回收站失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def related_notes(self, request, pk=None):
        """获取相关笔记"""
        try:
            mind_map = self.get_object()
            if mind_map.note:
                from notes.serializers import NoteSerializer
                serializer = NoteSerializer(mind_map.note)
                return Response([serializer.data])
            return Response([])
        except Exception as e:
            logger.error(f"获取相关笔记失败: {str(e)}")
            return Response({'error': f'获取相关笔记失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MindMapNodeViewSet(viewsets.ModelViewSet):
    """
    思维导图节点视图集
    提供思维导图节点的CRUD操作
    """
    serializer_class = MindMapNodeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        mind_map_id = self.request.query_params.get('mind_map')
        if mind_map_id:
            return MindMapNode.objects.filter(mind_map_id=mind_map_id)
        return MindMapNode.objects.filter(mind_map__user=self.request.user)
    
    def perform_create(self, serializer):
        """创建节点"""
        mind_map_id = self.request.data.get('mind_map')
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=self.request.user)
            serializer.save(mind_map=mind_map)
        except MindMap.DoesNotExist:
            raise ValueError("思维导图不存在或无权访问")


class MindMapEdgeViewSet(viewsets.ModelViewSet):
    """
    思维导图边视图集
    提供思维导图边的CRUD操作
    """
    serializer_class = MindMapEdgeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        mind_map_id = self.request.query_params.get('mind_map')
        if mind_map_id:
            return MindMapEdge.objects.filter(mind_map_id=mind_map_id)
        return MindMapEdge.objects.filter(mind_map__user=self.request.user)
    
    def perform_create(self, serializer):
        """创建边"""
        mind_map_id = self.request.data.get('mind_map')
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=self.request.user)
            serializer.save(mind_map=mind_map)
        except MindMap.DoesNotExist:
            raise ValueError("思维导图不存在或无权访问")


class MongoMindMapViewSet(viewsets.ViewSet):
    """
    MongoDB思维导图视图集
    提供思维导图的CRUD操作
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """获取查询集"""
        return MongoMindMap.objects(user=self.request.user, is_deleted=False)
    
    def list(self, request):
        """列出所有思维导图"""
        # 获取过滤参数
        search = request.query_params.get('search')
        
        # 构建查询
        queryset = self.get_queryset()
        if search:
            queryset = queryset.filter(title__icontains=search)
        
        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size
        
        # 序列化
        serializer = MongoMindMapSerializer(queryset[start:end], many=True)
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    def retrieve(self, request, pk=None):
        """获取单个思维导图"""
        try:
            mind_map = MongoMindMap.objects.get(id=pk, user=request.user)
            serializer = MongoMindMapDetailSerializer(mind_map)
            return Response(serializer.data)
        except MongoMindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取思维导图失败: {str(e)}")
            return Response({'error': f'获取思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create(self, request):
        """创建思维导图"""
        serializer = MongoMindMapSerializer(data=request.data)
        if serializer.is_valid():
            try:
                mind_map = serializer.save(user=request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建思维导图失败: {str(e)}")
                return Response({'error': f'创建思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, pk=None):
        """更新思维导图"""
        try:
            mind_map = MongoMindMap.objects.get(id=pk, user=request.user)
            serializer = MongoMindMapSerializer(mind_map, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except MongoMindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新思维导图失败: {str(e)}")
            return Response({'error': f'更新思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, pk=None):
        """软删除思维导图"""
        try:
            mind_map = MongoMindMap.objects.get(id=pk, user=request.user)
            mind_map.is_deleted = True
            mind_map.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MongoMindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除思维导图失败: {str(e)}")
            return Response({'error': f'删除思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """复制思维导图"""
        try:
            mind_map = MongoMindMap.objects.get(id=pk, user=request.user)
            
            # 创建新的思维导图
            new_mind_map = MongoMindMap(
                user=request.user,
                title=f"{mind_map.title} - 副本",
                description=mind_map.description,
                nodes=mind_map.nodes,
                edges=mind_map.edges,
                layout_type=mind_map.layout_type,
                theme=mind_map.theme
            )
            new_mind_map.save()
            
            serializer = MongoMindMapSerializer(new_mind_map)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except MongoMindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"复制思维导图失败: {str(e)}")
            return Response({'error': f'复制思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
