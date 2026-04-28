"""
知识库视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import uuid
from mongoengine.queryset.visitor import Q

from knowledge_base.mongodb_models import KnowledgeBase, KnowledgeBaseSnapshot, KnowledgeBaseQuery
from knowledge_base.serializers import (
    KnowledgeBaseSerializer,
    KnowledgeBaseCreateSerializer,
    KnowledgeBaseSnapshotSerializer,
    KnowledgeBaseAskSerializer,
    KnowledgeBaseBuildSerializer,
    KnowledgeBaseImportMarkdownSerializer,
    KnowledgeBaseMemberSerializer,
)
from knowledge_base.services import (
    KnowledgeBaseManagementService,
    KnowledgeBaseBuilderService,
    KnowledgeBaseQAService,
    KnowledgeBaseApplicationService,
)
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination
from django.contrib.auth import get_user_model

User = get_user_model()


class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    """知识库视图集"""
    serializer_class = KnowledgeBaseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'is_public', 'is_archived', 'tags']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name', 'node_count']
    ordering = ['-updated_at']

    def get_queryset(self):
        """获取用户有权访问的知识库"""
        user = self.request.user
        # 用户可以访问自己的知识库，或作为成员的知识库，或公开的知识库
        return KnowledgeBase.objects.filter(
            (Q(owner=user) | Q(members__user=user) | Q(is_public=True)) &
            Q(is_deleted=False)
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return KnowledgeBaseCreateSerializer
        return self.serializer_class

    def perform_create(self, serializer):
        """创建知识库"""
        service = KnowledgeBaseManagementService()
        service.create_knowledge_base(
            user=self.request.user,
            **serializer.validated_data
        )

    def perform_destroy(self, instance):
        """删除知识库"""
        service = KnowledgeBaseManagementService()
        service.delete_knowledge_base(instance.id, self.request.user)

    @action(detail=True, methods=['get'], url_path='members', serializer_class=KnowledgeBaseMemberSerializer)
    def list_members(self, request, pk=None):
        """列出知识库的所有成员。"""
        kb = self.get_object()
        serializer = self.get_serializer(kb.members, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='members', serializer_class=KnowledgeBaseMemberSerializer)
    def add_member(self, request, pk=None):
        """向知识库添加一个新成员。"""
        kb = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id_to_add = serializer.validated_data['user']['id']
        role_to_add = serializer.validated_data.get('role', 'viewer')

        service = KnowledgeBaseManagementService()
        try:
            updated_kb = service.add_member(
                kb=kb,
                adding_user=request.user,
                user_to_add_id=user_id_to_add,
                role=role_to_add,
                request=request
            )
            response_serializer = self.get_serializer(updated_kb.members, many=True)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except (PermissionError, ValueError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except User.DoesNotExist:
            return Response({'detail': '指定的用户不存在'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['put'], url_path='members/(?P<user_id>[^/.]+)', serializer_class=KnowledgeBaseMemberSerializer)
    def update_member(self, request, pk=None, user_id=None):
        """更新知识库成员的角色。"""
        kb = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data.get('role')

        if not new_role:
            return Response({'detail': '必须提供新的角色'}, status=status.HTTP_400_BAD_REQUEST)

        service = KnowledgeBaseManagementService()
        try:
            updated_kb = service.update_member_role(
                kb=kb,
                updating_user=request.user,
                user_to_update_id=user_id,
                new_role=new_role,
                request=request
            )
            response_serializer = self.get_serializer(updated_kb.members, many=True)
            return Response(response_serializer.data)
        except (PermissionError, ValueError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['delete'], url_path='members/(?P<user_id>[^/.]+)')
    def delete_member(self, request, pk=None, user_id=None):
        """从知识库中移除一个成员。"""
        kb = self.get_object()
        service = KnowledgeBaseManagementService()
        try:
            service.remove_member(
                kb=kb,
                removing_user=request.user,
                user_to_remove_id=user_id,
                request=request
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (PermissionError, ValueError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'], serializer_class=KnowledgeBaseBuildSerializer)
    def build(self, request, pk=None):
        """从笔记构建知识库"""
        kb = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = KnowledgeBaseBuilderService()
        result = service.build_from_notes(
            kb_id=kb.id,
            user=request.user,
            **serializer.validated_data
        )
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], serializer_class=KnowledgeBaseAskSerializer)
    def ask(self, request, pk=None):
        """向知识库提问"""
        kb = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = KnowledgeBaseQAService()
        result = service.ask_question(
            kb_id=kb.id,
            user=request.user,
            **serializer.validated_data
        )
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], serializer_class=KnowledgeBaseImportMarkdownSerializer)
    def import_markdown(self, request, pk=None):
        """从Markdown文件导入"""
        kb = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = KnowledgeBaseBuilderService()
        result = service.import_from_markdown(
            kb_id=kb.id,
            user=request.user,
            markdown_content=serializer.validated_data['content'],
            source_name=serializer.validated_data['source_name']
        )
        
        if result['success']:
            return Response(result, status=status.HTTP_202_ACCEPTED)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def analyze_gaps(self, request, pk=None):
        """分析知识缺口"""
        kb = self.get_object()
        service = KnowledgeBaseApplicationService()
        result = service.identify_knowledge_gaps(kb.id, request.user)
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        return Response(result, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='nodes/batch-move')
    def batch_move_nodes(self, request):
        """批量移动节点到另一个知识库"""
        node_ids = request.data.get('node_ids', [])
        target_kb_id = request.data.get('target_kb_id')

        if not node_ids or not target_kb_id:
            return Response({'error': 'node_ids and target_kb_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        service = KnowledgeBaseManagementService()
        try:
            result = service.batch_move_nodes(request.user, node_ids, target_kb_id, request)
            return Response(result)
        except (PermissionError, ValueError) as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Target knowledge base not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='nodes/batch-archive')
    def batch_archive_nodes(self, request):
        """批量归档节点"""
        node_ids = request.data.get('node_ids', [])
        if not node_ids:
            return Response({'error': 'node_ids are required.'}, status=status.HTTP_400_BAD_REQUEST)

        service = KnowledgeBaseManagementService()
        try:
            result = service.batch_archive_nodes(request.user, node_ids, request)
            return Response(result)
        except (PermissionError, ValueError) as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['post'], url_path='nodes/batch-delete')
    def batch_delete_nodes(self, request):
        """批量删除节点"""
        node_ids = request.data.get('node_ids', [])
        if not node_ids:
            return Response({'error': 'node_ids are required.'}, status=status.HTTP_400_BAD_REQUEST)

        service = KnowledgeBaseManagementService()
        try:
            result = service.batch_delete_nodes(request.user, node_ids, request)
            return Response(result)
        except (PermissionError, ValueError) as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

