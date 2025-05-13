"""
思维导图模板视图
提供思维导图模板的CRUD操作
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from mongoengine.queryset.visitor import Q

from mind_map.mongodb_models import MindMapTemplate
from mind_map.serializers.mongo_serializers import MongoMindMapTemplateSerializer

logger = logging.getLogger(__name__)


# 不再需要 Django ORM 视图集


class MongoMindMapTemplateViewSet(viewsets.ViewSet):
    """
    思维导图模板视图集
    提供思维导图模板的CRUD操作
    """
    def get_permissions(self):
        """获取权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """获取查询集"""
        # 系统模板对所有用户可见
        queryset = MindMapTemplate.objects(is_system=True)

        # 如果是管理员，显示所有模板
        if self.request.user.is_staff:
            return MindMapTemplate.objects

        return queryset

    def list(self, request):
        """列出所有模板"""
        # 获取过滤参数
        type_filter = request.query_params.get('type')

        # 构建查询
        queryset = self.get_queryset()
        if type_filter:
            queryset = queryset.filter(type=type_filter)

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        # 序列化
        serializer = MongoMindMapTemplateSerializer(queryset[start:end], many=True)

        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    def retrieve(self, request, pk=None):
        """获取单个模板"""
        try:
            template = MindMapTemplate.objects.get(id=pk)
            serializer = MongoMindMapTemplateSerializer(template)
            return Response(serializer.data)
        except MindMapTemplate.DoesNotExist:
            return Response({'error': '模板不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取模板失败: {str(e)}")
            return Response({'error': f'获取模板失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建模板"""
        serializer = MongoMindMapTemplateSerializer(data=request.data)
        if serializer.is_valid():
            try:
                template = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建模板失败: {str(e)}")
                return Response({'error': f'创建模板失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新模板"""
        try:
            template = MindMapTemplate.objects.get(id=pk)
            serializer = MongoMindMapTemplateSerializer(template, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except MindMapTemplate.DoesNotExist:
            return Response({'error': '模板不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新模板失败: {str(e)}")
            return Response({'error': f'更新模板失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除模板"""
        try:
            template = MindMapTemplate.objects.get(id=pk)
            template.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MindMapTemplate.DoesNotExist:
            return Response({'error': '模板不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除模板失败: {str(e)}")
            return Response({'error': f'删除模板失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def use_template(self, request, pk=None):
        """使用模板创建思维导图"""
        try:
            template = MindMapTemplate.objects.get(id=pk)

            # 创建新的思维导图
            from mind_map.mongodb_models import MindMap
            mind_map = MindMap(
                user=request.user,
                title=f"基于 {template.title} 的思维导图",
                description=template.description,
                nodes=template.nodes,
                edges=template.edges,
                layout_type=template.layout_type,
                theme=template.theme
            )
            mind_map.save()

            from mind_map.serializers.mongo_serializers import MongoMindMapSerializer
            serializer = MongoMindMapSerializer(mind_map)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except MindMapTemplate.DoesNotExist:
            return Response({'error': '模板不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"使用模板创建思维导图失败: {str(e)}")
            return Response({'error': f'使用模板创建思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
