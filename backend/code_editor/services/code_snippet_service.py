"""
代码片段服务
"""

import logging
from mongoengine.queryset.visitor import Q
from code.mongodb_models import CodeSnippet

logger = logging.getLogger('backend')

class CodeSnippetService:
    """
    代码片段服务类
    处理代码片段相关的业务逻辑
    """

    def create_snippet(self, user, data):
        """
        创建代码片段

        Args:
            user: 用户对象
            data: 代码片段数据

        Returns:
            CodeSnippet: 创建的代码片段
        """
        try:
            # 处理标签
            tags = data.pop('tags_list', None)

            # 创建代码片段
            snippet = CodeSnippet(
                user=user,
                title=data.get('title', '未命名代码片段'),
                description=data.get('description', ''),
                code=data.get('code', ''),
                language=data.get('language', 'text'),
                is_public=data.get('is_public', False)
            )

            # 设置标签
            if tags:
                snippet.tags = tags

            snippet.save()

            return snippet
        except Exception as e:
            logger.error(f"创建代码片段失败: {e}")
            raise

    def update_snippet(self, snippet, data):
        """
        更新代码片段

        Args:
            snippet: 代码片段对象
            data: 代码片段数据

        Returns:
            CodeSnippet: 更新的代码片段
        """
        try:
            # 处理标签
            tags = data.pop('tags_list', None)

            # 更新代码片段字段
            for field in ['title', 'description', 'code', 'language', 'is_public']:
                if field in data:
                    setattr(snippet, field, data[field])

            # 设置标签
            if tags is not None:
                snippet.tags = tags

            snippet.save()
            return snippet
        except Exception as e:
            logger.error(f"更新代码片段失败: {e}")
            raise

    def search_snippets(self, user, query, language=None, tags=None, include_public=True):
        """
        搜索代码片段

        Args:
            user: 用户对象
            query: 搜索查询
            language: 语言过滤
            tags: 标签过滤
            include_public: 是否包含公开片段

        Returns:
            QuerySet: 代码片段查询集
        """
        try:
            # 构建基础查询
            if include_public:
                snippets = CodeSnippet.objects.filter(
                    Q(user=user) | Q(is_public=True)
                )
            else:
                snippets = CodeSnippet.objects.filter(user=user)

            # 添加搜索条件
            if query:
                snippets = snippets.filter(
                    Q(title__icontains=query) |
                    Q(description__icontains=query) |
                    Q(code__icontains=query)
                )

            # 添加语言过滤
            if language:
                snippets = snippets.filter(language=language)

            # 添加标签过滤
            if tags:
                for tag in tags:
                    snippets = snippets.filter(tags=tag)

            return snippets.order_by('-created_at')
        except Exception as e:
            logger.error(f"搜索代码片段失败: {e}")
            return CodeSnippet.objects.none()

    def get_popular_languages(self, user, limit=10):
        """
        获取热门语言

        Args:
            user: 用户对象
            limit: 限制数量

        Returns:
            list: 热门语言列表
        """
        try:
            # 获取用户的代码片段
            snippets = CodeSnippet.objects.filter(user=user)

            # 统计语言
            language_counts = {}
            for snippet in snippets:
                lang = snippet.language
                language_counts[lang] = language_counts.get(lang, 0) + 1

            # 排序并限制数量
            sorted_languages = sorted(language_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

            return [{'language': lang, 'count': count} for lang, count in sorted_languages]
        except Exception as e:
            logger.error(f"获取热门语言失败: {e}")
            return []

    def get_popular_tags(self, user, limit=20):
        """
        获取热门标签

        Args:
            user: 用户对象
            limit: 限制数量

        Returns:
            list: 热门标签列表
        """
        try:
            # 获取用户的所有代码片段
            snippets = CodeSnippet.objects.filter(user=user)

            # 统计标签
            tag_counts = {}
            for snippet in snippets:
                for tag in snippet.tags:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1

            # 排序并限制数量
            sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

            return [{'tag': tag, 'count': count} for tag, count in sorted_tags]
        except Exception as e:
            logger.error(f"获取热门标签失败: {e}")
            return []
