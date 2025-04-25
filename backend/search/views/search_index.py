"""
搜索索引视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType

from search.models import SearchIndex
from search.serializers import SearchIndexSerializer
from search.services import IndexerService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class SearchIndexViewSet(viewsets.ModelViewSet):
    """搜索索引视图集"""
    serializer_class = SearchIndexSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['index_type', 'is_public', 'content_type']
    search_fields = ['title', 'content', 'keywords']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        """获取查询集"""
        return SearchIndex.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建索引时设置用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def index_object(self, request):
        """索引对象"""
        # 获取参数
        content_type_id = request.data.get('content_type_id')
        object_id = request.data.get('object_id')
        index_type = request.data.get('index_type')
        is_public = request.data.get('is_public', False)
        
        # 验证参数
        if not content_type_id or not object_id:
            return Response(
                {'detail': '内容类型ID和对象ID不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 获取内容类型
            content_type = ContentType.objects.get(id=content_type_id)
            
            # 获取对象
            obj = content_type.get_object_for_this_type(id=object_id)
            
            # 索引对象
            indexer_service = IndexerService()
            index = indexer_service.index_object(
                obj=obj,
                index_type=index_type,
                user=request.user,
                is_public=is_public
            )
            
            serializer = self.get_serializer(index)
            return Response(serializer.data)
        except ContentType.DoesNotExist:
            return Response(
                {'detail': f'内容类型不存在: {content_type_id}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def remove_index(self, request):
        """移除索引"""
        # 获取参数
        content_type_id = request.data.get('content_type_id')
        object_id = request.data.get('object_id')
        
        # 验证参数
        if not content_type_id or not object_id:
            return Response(
                {'detail': '内容类型ID和对象ID不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 获取内容类型
            content_type = ContentType.objects.get(id=content_type_id)
            
            # 获取对象
            obj = content_type.get_object_for_this_type(id=object_id)
            
            # 移除索引
            indexer_service = IndexerService()
            success = indexer_service.remove_index(obj)
            
            if success:
                return Response({'detail': '索引已移除'})
            else:
                return Response(
                    {'detail': '索引不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except ContentType.DoesNotExist:
            return Response(
                {'detail': f'内容类型不存在: {content_type_id}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
