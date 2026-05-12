"""
代码片段视图
"""

from mongoengine.queryset.visitor import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from code.mongodb_models import CodeSnippet
from code.serializers import CodeSnippetSerializer
from common.pagination import StandardResultsSetPagination
from common.permissions import IsOwnerOrReadOnly
from users.utils import get_mongo_user_from_django


class CodeSnippetViewSet(viewsets.ViewSet):
    """代码片段视图集"""

    serializer_class = CodeSnippetSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['language', 'is_public']
    search_fields = ['title', 'description', 'code', 'tags']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    lookup_field = 'id'

    def get_serializer(self, *args, **kwargs):
        return self.serializer_class(*args, **kwargs)

    def paginate_queryset(self, queryset):
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(list(queryset), self.request, view=self)
        self._paginator = paginator
        return page

    def get_paginated_response(self, data):
        return self._paginator.get_paginated_response(data)

    def _get_mongo_user(self, request):
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user
        return get_mongo_user_from_django(request.user)

    def _get_required_mongo_user(self, request):
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return None, Response(
                {'detail': '当前用户缺少 Mongo 用户映射，无法访问该接口'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return mongo_user, None

    def get_queryset(self):
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return CodeSnippet.objects.none()
        return CodeSnippet.objects.filter(Q(user=mongo_user) | Q(is_public=True)).order_by('-created_at')

    def get_object(self, pk):
        mongo_user = self._get_mongo_user(self.request)
        snippet = CodeSnippet.objects.filter(id=pk).first()
        if not snippet:
            return None
        if snippet.is_public:
            return snippet
        if not mongo_user:
            return None
        if str(getattr(snippet.user, 'id', '')) != str(getattr(mongo_user, 'id', '')):
            return None
        return snippet

    def list(self, request):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        snippet = self.get_object(pk)
        if not snippet:
            return Response({'detail': '代码片段不存在'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(snippet)
        return Response(serializer.data)

    def create(self, request):
        mongo_user, error_response = self._get_required_mongo_user(request)
        if error_response:
            return error_response

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        tags = data.get('tags', [])
        snippet = CodeSnippet(
            user=mongo_user,
            title=data['title'],
            description=data.get('description'),
            code=data['code'],
            language=data['language'],
            is_public=data.get('is_public', False),
            is_favorite=data.get('is_favorite', False),
            tags=tags,
        )
        snippet.save()
        return Response(self.get_serializer(snippet).data, status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        snippet = self.get_object(pk)
        if not snippet:
            return Response({'detail': '代码片段不存在'}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        for field in ['title', 'description', 'code', 'language', 'is_public', 'is_favorite']:
            if field in data:
                setattr(snippet, field, data[field])
        if 'tags' in data:
            snippet.tags = data['tags']
        snippet.save()
        return Response(self.get_serializer(snippet).data)

    def destroy(self, request, pk=None):
        snippet = self.get_object(pk)
        if not snippet:
            return Response({'detail': '代码片段不存在'}, status=status.HTTP_404_NOT_FOUND)
        snippet.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def my(self, request):
        mongo_user, error_response = self._get_required_mongo_user(request)
        if error_response:
            return error_response
        queryset = CodeSnippet.objects.filter(user=mongo_user).order_by('-created_at')
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def public(self, request):
        queryset = CodeSnippet.objects.filter(is_public=True).order_by('-created_at')
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_language(self, request):
        language = request.query_params.get('language')
        if not language:
            return Response({'error': '缺少language参数'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(language=language)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_tag(self, request):
        tag = request.query_params.get('tag')
        if not tag:
            return Response({'error': '缺少tag参数'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(tags=tag)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

