"""
思维导图视图
提供思维导图的CRUD操作
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from mongoengine.queryset.visitor import Q
from django.utils import timezone

from mind_map.mongodb_models import MindMap, MindMapNode, MindMapEdge
from users.mongodb_models import User
from mind_map.serializers.mongo_serializers import (
    MongoMindMapSerializer,
    MongoMindMapDetailSerializer
)
# 不再需要 Django ORM 序列化器

logger = logging.getLogger(__name__)

class MindMapNodeViewSet(viewsets.ViewSet):
    """
    思维导图节点视图集
    提供思维导图节点的CRUD操作
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出所有节点"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.query_params.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 返回节点列表
        from mind_map.serializers.mongo_serializers import MongoMindMapNodeSerializer
        serializer = MongoMindMapNodeSerializer(mind_map.nodes, many=True)
        return Response(serializer.data)

    def create(self, request):
        """创建节点"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.data.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 创建节点
        from mind_map.serializers.mongo_serializers import MongoMindMapNodeSerializer
        serializer = MongoMindMapNodeSerializer(data=request.data)
        if serializer.is_valid():
            # 创建节点
            node = MindMapNode(**serializer.validated_data)
            mind_map.nodes.append(node)
            mind_map.save()

            # 返回结果
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新节点"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.data.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 查找节点
        node = None
        for n in mind_map.nodes:
            if str(n.id) == pk:
                node = n
                break

        if not node:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 更新节点
        from mind_map.serializers.mongo_serializers import MongoMindMapNodeSerializer
        serializer = MongoMindMapNodeSerializer(node, data=request.data, partial=True)
        if serializer.is_valid():
            # 更新节点属性
            for key, value in serializer.validated_data.items():
                setattr(node, key, value)

            # 保存思维导图
            mind_map.save()

            # 返回结果
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """删除节点"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.query_params.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 查找节点
        node_index = None
        for i, n in enumerate(mind_map.nodes):
            if str(n.id) == pk:
                node_index = i
                break

        if node_index is None:
            return Response({'error': '节点不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 删除节点
        mind_map.nodes.pop(node_index)
        mind_map.save()

        # 返回结果
        return Response(status=status.HTTP_204_NO_CONTENT)

class MindMapEdgeViewSet(viewsets.ViewSet):
    """
    思维导图边视图集
    提供思维导图边的CRUD操作
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出所有边"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.query_params.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 返回边列表
        from mind_map.serializers.mongo_serializers import MongoMindMapEdgeSerializer
        serializer = MongoMindMapEdgeSerializer(mind_map.edges, many=True)
        return Response(serializer.data)

    def create(self, request):
        """创建边"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.data.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 创建边
        from mind_map.serializers.mongo_serializers import MongoMindMapEdgeSerializer
        serializer = MongoMindMapEdgeSerializer(data=request.data)
        if serializer.is_valid():
            # 创建边
            edge = MindMapEdge(**serializer.validated_data)
            mind_map.edges.append(edge)
            mind_map.save()

            # 返回结果
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新边"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.data.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 查找边
        edge = None
        for e in mind_map.edges:
            if str(e.id) == pk:
                edge = e
                break

        if not edge:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 更新边
        from mind_map.serializers.mongo_serializers import MongoMindMapEdgeSerializer
        serializer = MongoMindMapEdgeSerializer(edge, data=request.data, partial=True)
        if serializer.is_valid():
            # 更新边属性
            for key, value in serializer.validated_data.items():
                setattr(edge, key, value)

            # 保存思维导图
            mind_map.save()

            # 返回结果
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """删除边"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图ID
        mind_map_id = request.query_params.get('mind_map_id')
        if not mind_map_id:
            return Response({'error': '缺少思维导图ID参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=mind_map_id, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 查找边
        edge_index = None
        for i, e in enumerate(mind_map.edges):
            if str(e.id) == pk:
                edge_index = i
                break

        if edge_index is None:
            return Response({'error': '边不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 删除边
        mind_map.edges.pop(edge_index)
        mind_map.save()

        # 返回结果
        return Response(status=status.HTTP_204_NO_CONTENT)


class MindMapViewSet(viewsets.ViewSet):
    """
    思维导图视图集
    提供思维导图的CRUD操作
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """列出所有思维导图"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取过滤参数
        is_deleted = request.query_params.get('is_deleted', 'false').lower() == 'true'
        is_favorite = request.query_params.get('is_favorite')
        if is_favorite:
            is_favorite = is_favorite.lower() == 'true'

        # 构建查询
        query = Q(user=mongo_user) & Q(is_deleted=is_deleted)
        if is_favorite is not None:
            query &= Q(is_favorite=is_favorite)

        # 执行查询
        mind_maps = MindMap.objects.filter(query).order_by('-updated_at')

        # 分页
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        start = (page - 1) * page_size
        end = start + page_size

        # 序列化
        serializer = MongoMindMapSerializer(mind_maps[start:end], many=True)

        return Response({
            'count': mind_maps.count(),
            'results': serializer.data
        })

    def retrieve(self, request, pk=None):
        """获取单个思维导图"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
            serializer = MongoMindMapDetailSerializer(mind_map)
            return Response(serializer.data)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取思维导图失败: {str(e)}")
            return Response({'error': f'获取思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建思维导图"""
        serializer = MongoMindMapSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 获取MongoDB用户对象
                mongo_user = User.objects(username=request.user.username).first()

                # 创建思维导图
                mind_map_data = serializer.validated_data
                mind_map_data['user'] = mongo_user
                mind_map = MindMap(**mind_map_data)
                mind_map.save()

                # 返回结果
                serializer = MongoMindMapSerializer(mind_map)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建思维导图失败: {str(e)}")
                return Response({'error': f'创建思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新思维导图"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 更新思维导图
        serializer = MongoMindMapSerializer(mind_map, data=request.data, partial=True)
        if serializer.is_valid():
            try:
                # 更新属性
                for key, value in serializer.validated_data.items():
                    setattr(mind_map, key, value)

                # 保存
                mind_map.save()

                # 返回结果
                serializer = MongoMindMapSerializer(mind_map)
                return Response(serializer.data)
            except Exception as e:
                logger.error(f"更新思维导图失败: {str(e)}")
                return Response({'error': f'更新思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """软删除思维导图"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=request.user.username).first()

        # 获取思维导图
        try:
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 软删除
        mind_map.is_deleted = True
        mind_map.save()

        # 返回结果
        return Response(status=status.HTTP_204_NO_CONTENT)


class MongoMindMapViewSet(viewsets.ViewSet):
    """
    思维导图视图集
    提供思维导图的CRUD操作
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """获取查询集"""
        # 获取MongoDB用户对象
        mongo_user = User.objects(username=self.request.user.username).first()
        return MindMap.objects(user=mongo_user, is_deleted=False)

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
            # 获取MongoDB用户对象
            mongo_user = User.objects(username=request.user.username).first()
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
            serializer = MongoMindMapDetailSerializer(mind_map)
            return Response(serializer.data)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取思维导图失败: {str(e)}")
            return Response({'error': f'获取思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request):
        """创建思维导图"""
        serializer = MongoMindMapSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 获取MongoDB用户对象
                mongo_user = User.objects(username=request.user.username).first()
                mind_map = serializer.save(user=mongo_user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"创建思维导图失败: {str(e)}")
                return Response({'error': f'创建思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新思维导图"""
        try:
            # 获取MongoDB用户对象
            mongo_user = User.objects(username=request.user.username).first()
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
            serializer = MongoMindMapSerializer(mind_map, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"更新思维导图失败: {str(e)}")
            return Response({'error': f'更新思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, pk=None):
        """软删除思维导图"""
        try:
            # 获取MongoDB用户对象
            mongo_user = User.objects(username=request.user.username).first()
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)
            mind_map.is_deleted = True
            mind_map.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除思维导图失败: {str(e)}")
            return Response({'error': f'删除思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """复制思维导图"""
        try:
            # 获取MongoDB用户对象
            mongo_user = User.objects(username=request.user.username).first()
            mind_map = MindMap.objects.get(id=pk, user=mongo_user)

            # 创建新的思维导图
            new_mind_map = MindMap(
                user=mongo_user,
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
        except MindMap.DoesNotExist:
            return Response({'error': '思维导图不存在'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"复制思维导图失败: {str(e)}")
            return Response({'error': f'复制思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
