"""
知识图谱MongoDB视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
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

logger = logging.getLogger(__name__)

class MongoKnowledgeNodeViewSet(viewsets.ViewSet):
    """
    知识节点MongoDB视图集
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """获取查询集"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = self.request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                # 返回空查询集
                return KnowledgeNode.objects(id=None)

            logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}")
            return KnowledgeNode.objects(user=mongo_user)
        except Exception as e:
            logger.error(f"获取知识节点查询集失败: {str(e)}", exc_info=True)
            # 返回空查询集
            return KnowledgeNode.objects(id=None)

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

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        # 序列化
        serializer = MongoKnowledgeNodeSerializer(queryset[start:end], many=True)

        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    def retrieve(self, request, pk=None):
        """获取单个节点"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的节点ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            logger.debug(f"尝试获取节点, ID: {pk}, 用户: {mongo_user.username}")
            node = KnowledgeNode.objects.get(id=pk, user=mongo_user)
            serializer = MongoKnowledgeNodeSerializer(node)
            logger.debug(f"成功获取节点: {node.title}")
            return Response(serializer.data)
        except KnowledgeNode.DoesNotExist:
            logger.warning(f"节点不存在, ID: {pk}")
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取节点失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建节点"""
        serializer = MongoKnowledgeNodeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                node = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建节点失败: {str(e)}")
                return Response({'error': f'创建节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeNodeSerializer(node, data=request.data, context={'request': request})
            if serializer.is_valid():
                try:
                    node = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新节点失败: {str(e)}")
                    return Response({'error': f'更新节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeNode.DoesNotExist:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取节点失败: {str(e)}")
            return Response({'error': f'获取节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeNodeSerializer(node, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                try:
                    node = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新节点失败: {str(e)}")
                    return Response({'error': f'更新节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeNode.DoesNotExist:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取节点失败: {str(e)}")
            return Response({'error': f'获取节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user)

            # 检查是否有关联的边
            outgoing_edges = KnowledgeEdge.objects(source=node)
            incoming_edges = KnowledgeEdge.objects(target=node)

            if outgoing_edges or incoming_edges:
                return Response({'error': '该节点有关联的边，无法删除'}, status=status.HTTP_400_BAD_REQUEST)

            node.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeNode.DoesNotExist:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除节点失败: {str(e)}")
            return Response({'error': f'删除节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def related_nodes(self, request, pk=None):
        """获取相关节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user)

            # 获取所有与当前节点相关的边
            outgoing_edges = KnowledgeEdge.objects(source=node)
            incoming_edges = KnowledgeEdge.objects(target=node)

            # 获取相关节点
            related_nodes = set()
            for edge in outgoing_edges:
                related_nodes.add(edge.target)
            for edge in incoming_edges:
                related_nodes.add(edge.source)

            # 序列化
            serializer = MongoKnowledgeNodeSerializer(related_nodes, many=True)

            return Response(serializer.data)
        except KnowledgeNode.DoesNotExist:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取相关节点失败: {str(e)}")
            return Response({'error': f'获取相关节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoKnowledgeEdgeViewSet(viewsets.ViewSet):
    """
    知识边MongoDB视图集
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """获取查询集"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = self.request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                # 返回空查询集
                return KnowledgeEdge.objects(id=None)

            logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}")
            return KnowledgeEdge.objects(user=mongo_user)
        except Exception as e:
            logger.error(f"获取知识边查询集失败: {str(e)}", exc_info=True)
            # 返回空查询集
            return KnowledgeEdge.objects(id=None)

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

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        # 序列化
        serializer = MongoKnowledgeEdgeSerializer(queryset[start:end], many=True)

        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

    def retrieve(self, request, pk=None):
        """获取单个边"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的边ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            logger.debug(f"尝试获取边, ID: {pk}, 用户: {mongo_user.username}")
            edge = KnowledgeEdge.objects.get(id=pk, user=mongo_user)
            serializer = MongoKnowledgeEdgeSerializer(edge)
            logger.debug(f"成功获取边: {edge.type} - {edge.source.title} -> {edge.target.title}")
            return Response(serializer.data)
        except KnowledgeEdge.DoesNotExist:
            logger.warning(f"边不存在, ID: {pk}")
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取边失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建边"""
        serializer = MongoKnowledgeEdgeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                edge = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建边失败: {str(e)}")
                return Response({'error': f'创建边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新边"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeEdgeSerializer(edge, data=request.data, context={'request': request})
            if serializer.is_valid():
                try:
                    edge = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新边失败: {str(e)}")
                    return Response({'error': f'更新边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeEdge.DoesNotExist:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取边失败: {str(e)}")
            return Response({'error': f'获取边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新边"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeEdgeSerializer(edge, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                try:
                    edge = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新边失败: {str(e)}")
                    return Response({'error': f'更新边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeEdge.DoesNotExist:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取边失败: {str(e)}")
            return Response({'error': f'获取边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除边"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user)
            edge.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeEdge.DoesNotExist:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除边失败: {str(e)}")
            return Response({'error': f'删除边失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MongoKnowledgeGraphViewSet(viewsets.ViewSet):
    """
    知识图谱MongoDB视图集
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """获取查询集"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = self.request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                # 返回空查询集
                return KnowledgeGraph.objects(id=None)

            logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}, 类型: {type(mongo_user.id)}")
            return KnowledgeGraph.objects(user=mongo_user)
        except Exception as e:
            logger.error(f"获取知识图谱查询集失败: {str(e)}", exc_info=True)
            # 返回空查询集
            return KnowledgeGraph.objects(id=None)

    def list(self, request):
        """列出所有图谱"""
        try:
            # 获取过滤参数
            search = request.query_params.get('search')
            logger.debug(f"列出知识图谱, 搜索参数: {search}")

            # 构建查询
            queryset = self.get_queryset()
            if search:
                queryset = queryset.filter(name__icontains=search)

            # 分页
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 10))
            start = (page - 1) * page_size
            end = start + page_size

            # 序列化
            serializer = MongoKnowledgeGraphSerializer(queryset[start:end], many=True)

            logger.debug(f"成功获取知识图谱列表, 总数: {queryset.count()}")
            return Response({
                'count': queryset.count(),
                'results': serializer.data
            })
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
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的图谱ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            logger.debug(f"尝试获取图谱, ID: {pk}, 用户: {mongo_user.username}")
            graph = KnowledgeGraph.objects.get(id=pk, user=mongo_user)
            serializer = MongoKnowledgeGraphSerializer(graph)
            logger.debug(f"成功获取图谱: {graph.name}")
            return Response(serializer.data)
        except KnowledgeGraph.DoesNotExist:
            logger.warning(f"图谱不存在, ID: {pk}")
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取图谱失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建图谱"""
        serializer = MongoKnowledgeGraphSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            try:
                graph = serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建图谱失败: {str(e)}")
                return Response({'error': f'创建图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新图谱"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
                    pk = pk_uuid
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的图谱ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            graph = KnowledgeGraph.objects.get(id=pk, user=mongo_user)
            serializer = MongoKnowledgeGraphSerializer(graph, data=request.data, context={'request': request})
            if serializer.is_valid():
                try:
                    graph = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新图谱失败: {str(e)}")
                    return Response({'error': f'更新图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeGraph.DoesNotExist:
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新图谱失败: {str(e)}", exc_info=True)
            return Response({'error': f'更新图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新图谱"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
                    pk = pk_uuid
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的图谱ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            graph = KnowledgeGraph.objects.get(id=pk, user=mongo_user)
            serializer = MongoKnowledgeGraphSerializer(graph, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                try:
                    graph = serializer.save()
                    return Response(serializer.data)
                except Exception as e:
                    logger.error(f"更新图谱失败: {str(e)}")
                    return Response({'error': f'更新图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeGraph.DoesNotExist:
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取图谱失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """删除图谱"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
                    pk = pk_uuid
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的图谱ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            graph = KnowledgeGraph.objects.get(id=pk, user=mongo_user)
            graph.delete()
            logger.debug(f"成功删除图谱, ID: {pk}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeGraph.DoesNotExist:
            logger.warning(f"图谱不存在, ID: {pk}")
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除图谱失败: {str(e)}", exc_info=True)
            return Response({'error': f'删除图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def full_graph(self, request, pk=None):
        """获取完整图谱数据"""
        try:
            # 获取MongoDB用户模型
            from users.mongodb_models import User as MongoUser

            # 获取Django用户
            django_user = request.user

            # 查找对应的MongoDB用户
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
                return Response({'error': '未找到用户数据'}, status=status.HTTP_404_NOT_FOUND)

            # 检查pk是否为有效的UUID
            try:
                if isinstance(pk, str):
                    pk_uuid = uuid.UUID(pk)
                    logger.debug(f"将字符串ID转换为UUID: {pk_uuid}")
            except ValueError:
                logger.warning(f"无效的UUID格式: {pk}")
                return Response({'error': '无效的图谱ID格式'}, status=status.HTTP_400_BAD_REQUEST)

            logger.debug(f"尝试获取完整图谱数据, ID: {pk}, 用户: {mongo_user.username}")
            graph = KnowledgeGraph.objects.get(id=pk, user=mongo_user)

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
        except KnowledgeGraph.DoesNotExist:
            logger.warning(f"图谱不存在, ID: {pk}")
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取完整图谱数据失败: {str(e)}", exc_info=True)
            return Response({'error': f'获取完整图谱数据失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
