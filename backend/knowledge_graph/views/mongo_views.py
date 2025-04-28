"""
知识图谱MongoDB视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
import logging

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
        return KnowledgeNode.objects(user=self.request.user)
    
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
            node = KnowledgeNode.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeNodeSerializer(node)
            return Response(serializer.data)
        except KnowledgeNode.DoesNotExist:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取节点失败: {str(e)}")
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
        return KnowledgeEdge.objects(user=self.request.user)
    
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
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeEdgeSerializer(edge)
            return Response(serializer.data)
        except KnowledgeEdge.DoesNotExist:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取边失败: {str(e)}")
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
        return KnowledgeGraph.objects(user=self.request.user)
    
    def list(self, request):
        """列出所有图谱"""
        # 获取过滤参数
        search = request.query_params.get('search')
        
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
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    def retrieve(self, request, pk=None):
        """获取单个图谱"""
        try:
            graph = KnowledgeGraph.objects.get(id=pk, user=request.user)
            serializer = MongoKnowledgeGraphSerializer(graph)
            return Response(serializer.data)
        except KnowledgeGraph.DoesNotExist:
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取图谱失败: {str(e)}")
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
            graph = KnowledgeGraph.objects.get(id=pk, user=request.user)
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
            logger.error(f"获取图谱失败: {str(e)}")
            return Response({'error': f'获取图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def partial_update(self, request, pk=None):
        """部分更新图谱"""
        try:
            graph = KnowledgeGraph.objects.get(id=pk, user=request.user)
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
            logger.error(f"获取图谱失败: {str(e)}")
            return Response({'error': f'获取图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, pk=None):
        """删除图谱"""
        try:
            graph = KnowledgeGraph.objects.get(id=pk, user=request.user)
            graph.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeGraph.DoesNotExist:
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除图谱失败: {str(e)}")
            return Response({'error': f'删除图谱失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def full_graph(self, request, pk=None):
        """获取完整图谱数据"""
        try:
            graph = KnowledgeGraph.objects.get(id=pk, user=request.user)
            
            # 获取节点和边
            nodes = graph.nodes
            edges = graph.edges
            
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
            return Response({'error': '图谱不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取完整图谱数据失败: {str(e)}")
            return Response({'error': f'获取完整图谱数据失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
