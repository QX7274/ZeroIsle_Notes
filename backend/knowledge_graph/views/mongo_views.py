"""
知识图谱MongoDB视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.http import Http404
from mongoengine.queryset.visitor import Q
import logging
import uuid
import traceback

from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge, KnowledgeGraph, Concept, Entity, Relation
from knowledge_graph.serializers.mongo_serializers import (
    MongoKnowledgeNodeSerializer,
    MongoKnowledgeEdgeSerializer,
    MongoKnowledgeGraphSerializer,
    MongoConceptSerializer,
    MongoEntitySerializer,
    MongoRelationSerializer
)
from common.permissions import IsOwner

logger = logging.getLogger(__name__)

class MongoUserViewSetBase(viewsets.ViewSet):
    """
    一个基础视图集，提供获取 MongoDB 用户和通用权限检查的功能。
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def _get_mongo_user(self, request):
        """
        从请求中获取对应的 MongoDB 用户对象
        优先使用中间件注入的 request.mongo_user
        """
        # 优先使用中间件注入的 mongo_user
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user

        # 降级方案：手动查找（兼容旧代码）
        try:
            from users.mongodb_models import User as MongoUser
            django_user = request.user
            if not django_user or not django_user.is_authenticated:
                return None
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.warning(f"未找到对应的MongoDB用户: {django_user.username}")
            return mongo_user
        except Exception as e:
            logger.error(f"获取 MongoDB 用户失败: {e}", exc_info=True)
            return None

class MongoKnowledgeNodeViewSet(MongoUserViewSetBase):
    """
    知识节点MongoDB视图集
    """

    def get_queryset(self):
        """获取当前用户的知识节点查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return KnowledgeNode.objects.none()  # 返回空查询集
        return KnowledgeNode.objects(user=mongo_user)

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供节点ID")

        try:
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的节点ID格式")

        queryset = self.get_queryset()
        try:
            obj = queryset.get(id=pk)
        except KnowledgeNode.DoesNotExist:
            raise Http404("节点不存在或无权访问")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """列出所有节点"""
        # 获取过滤参数
        type_filter = request.query_params.get('type')
        search = request.query_params.get('search')

        # 构建查询
        queryset = self.get_queryset()
        if type_filter:
            queryset = queryset.filter(type=type_filter)
        if search:
            queryset = queryset.filter(title__icontains=search)

        # 分页（DRF）
        paginator = PageNumberPagination()
        page_size = request.query_params.get('page_size')
        if page_size:
            try:
                paginator.page_size = int(page_size)
            except Exception:
                pass
        page_qs = paginator.paginate_queryset(queryset, request)

        serializer = MongoKnowledgeNodeSerializer(page_qs, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个节点"""
        try:
            node = self.get_object()
            serializer = MongoKnowledgeNodeSerializer(node)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取节点详情失败: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取节点详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建节点"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = MongoKnowledgeNodeSerializer(data=request.data, context={'request': request, 'user': mongo_user})
        if not serializer.is_valid():
            logger.warning(f"创建知识节点失败, 验证错误: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建知识节点时发生内部错误: {str(e)}", exc_info=True)
            return Response({"detail": "创建知识节点时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, pk=None):
        """更新节点"""
        try:
            node = self.get_object()
            serializer = MongoKnowledgeNodeSerializer(node, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新节点时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "更新节点时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新节点"""
        try:
            node = self.get_object()
            serializer = MongoKnowledgeNodeSerializer(node, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"部分更新节点时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "部分更新节点时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除节点"""
        try:
            node = self.get_object()

            # 检查是否有关联的边
            if KnowledgeEdge.objects(Q(source=node) | Q(target=node)).first():
                return Response({'detail': '该节点存在关联的边，无法删除'}, status=status.HTTP_400_BAD_REQUEST)

            node.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除节点时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "删除节点时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def related_nodes(self, request, pk=None):
        """获取相关节点"""
        try:
            node = self.get_object()

            # 获取相关节点
            related_nodes = set()
            for edge in KnowledgeEdge.objects(source=node):
                related_nodes.add(edge.target)
            for edge in KnowledgeEdge.objects(target=node):
                related_nodes.add(edge.source)

            serializer = MongoKnowledgeNodeSerializer(list(related_nodes), many=True)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取相关节点失败: {e}", exc_info=True)
            return Response({"detail": "获取相关节点时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoKnowledgeEdgeViewSet(MongoUserViewSetBase):
    """
    知识边MongoDB视图集
    """
    def get_queryset(self):
        """获取当前用户的知识边查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return KnowledgeEdge.objects.none()
        return KnowledgeEdge.objects(user=mongo_user)

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供边ID")

        try:
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的边ID格式")

        queryset = self.get_queryset()
        try:
            obj = queryset.get(id=pk)
        except KnowledgeEdge.DoesNotExist:
            raise Http404("边不存在或无权访问")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """列出所有边"""
        # 获取过滤参数
        type_filter = request.query_params.get('type')
        source = request.query_params.get('source')
        target = request.query_params.get('target')

        # 构建查询
        queryset = self.get_queryset()
        if type_filter:
            queryset = queryset.filter(type=type_filter)
        if source:
            queryset = queryset.filter(source=source)
        if target:
            queryset = queryset.filter(target=target)

        # 分页（DRF）
        paginator = PageNumberPagination()
        page_size = request.query_params.get('page_size')
        if page_size:
            try:
                paginator.page_size = int(page_size)
            except Exception:
                pass
        page_qs = paginator.paginate_queryset(queryset, request)

        serializer = MongoKnowledgeEdgeSerializer(page_qs, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个边"""
        try:
            edge = self.get_object()
            serializer = MongoKnowledgeEdgeSerializer(edge)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取边详情失败: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取边详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建边"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = MongoKnowledgeEdgeSerializer(data=request.data, context={'request': request, 'user': mongo_user})
        if not serializer.is_valid():
            logger.warning(f"创建知识边失败, 验证错误: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建知识边时发生内部错误: {str(e)}", exc_info=True)
            return Response({"detail": "创建知识边时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, pk=None):
        """更新边"""
        try:
            edge = self.get_object()
            serializer = MongoKnowledgeEdgeSerializer(edge, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新边时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "更新边时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新边"""
        try:
            edge = self.get_object()
            serializer = MongoKnowledgeEdgeSerializer(edge, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"部分更新边时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "部分更新边时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除边"""
        try:
            edge = self.get_object()
            edge.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除边时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "删除边时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoKnowledgeGraphViewSet(MongoUserViewSetBase):
    """
    知识图谱MongoDB视图集
    """
    def get_queryset(self):
        """获取当前用户的知识图谱查询集"""
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return KnowledgeGraph.objects.none()
        return KnowledgeGraph.objects(user=mongo_user)

    def get_object(self):
        """获取单个对象并自动检查权限"""
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供图谱ID")

        try:
            if isinstance(pk, str):
                pk = uuid.UUID(pk)
        except ValueError:
            raise Http404("无效的图谱ID格式")

        queryset = self.get_queryset()
        try:
            obj = queryset.get(id=pk)
        except KnowledgeGraph.DoesNotExist:
            raise Http404("图谱不存在或无权访问")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        # 列出所有图谱
        try:
            # 获取过滤参数
            search = request.query_params.get('search')
            logger.debug(f"列出知识图谱, 搜索参数: {search}")

            # 构建查询
            queryset = self.get_queryset()
            if search:
                queryset = queryset.filter(name__icontains=search)

            # 分页（DRF）
            paginator = PageNumberPagination()
            page_size = request.query_params.get('page_size')
            if page_size:
                try:
                    paginator.page_size = int(page_size)
                except Exception:
                    pass
            page_qs = paginator.paginate_queryset(queryset, request)

            serializer = MongoKnowledgeGraphSerializer(page_qs, many=True)
            logger.debug(f"成功获取知识图谱列表, 总数: {paginator.page.paginator.count}")
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            logger.error(f"列出知识图谱失败: {str(e)}", exc_info=True)
            return Response({
                'error': f'列出知识图谱失败: {str(e)}',
                'count': 0,
                'results': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, pk=None):
        """获取单个图谱"""
        try:
            graph = self.get_object()
            serializer = MongoKnowledgeGraphSerializer(graph)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取图谱详情失败: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取图谱详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request):
        """创建图谱"""
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return Response({"detail": "用户未认证或未找到"}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = MongoKnowledgeGraphSerializer(data=request.data, context={'request': request, 'user': mongo_user})
        if not serializer.is_valid():
            logger.warning(f"创建知识图谱失败, 验证错误: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建知识图谱时发生内部错误: {str(e)}", exc_info=True)
            return Response({"detail": "创建知识图谱时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, pk=None):
        """更新图谱"""
        try:
            graph = self.get_object()
            serializer = MongoKnowledgeGraphSerializer(graph, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新图谱时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "更新图谱时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新图谱"""
        try:
            graph = self.get_object()
            serializer = MongoKnowledgeGraphSerializer(graph, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"部分更新图谱时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "部分更新图谱时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除图谱"""
        try:
            graph = self.get_object()
            graph.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除图谱时发生内部错误: {e}", exc_info=True)
            return Response({"detail": "删除图谱时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def full_graph(self, request, pk=None):
        """获取完整图谱数据"""
        try:
            graph = self.get_object()

            # 获取节点和边
            nodes = graph.nodes
            edges = graph.edges
            logger.debug(f"图谱节点数: {len(nodes)}, 边数: {len(edges)}")

            # 序列化
            node_serializer = MongoKnowledgeNodeSerializer(nodes, many=True)
            edge_serializer = MongoKnowledgeEdgeSerializer(edges, many=True)

            return Response({
                'id': str(graph.id),
                'name': graph.name,
                'description': graph.description or '',
                'nodes': node_serializer.data,
                'edges': edge_serializer.data,
                'settings': graph.settings,
                'is_public': graph.is_public,
                'created_at': graph.created_at,
                'updated_at': graph.updated_at
            })
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取完整图谱数据失败: {e}", exc_info=True)
            return Response({"detail": "获取完整图谱数据时发生内部错误"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
