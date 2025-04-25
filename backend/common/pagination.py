"""
自定义分页类
"""

from rest_framework.pagination import PageNumberPagination, LimitOffsetPagination
from rest_framework.response import Response

class StandardResultsSetPagination(PageNumberPagination):
    """
    标准分页器
    提供页码分页，并返回标准格式的分页数据
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'results': data
        })

class LargeResultsSetPagination(PageNumberPagination):
    """
    大结果集分页器
    用于返回较大数据集的分页
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
        })

class SmallResultsSetPagination(PageNumberPagination):
    """
    小型结果集分页器
    用于返回较小数据集的分页
    """
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 20

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
        })

class FlexiblePagination(LimitOffsetPagination):
    """
    灵活分页器
    使用limit/offset方式进行分页
    """
    default_limit = 20
    limit_query_param = 'limit'
    offset_query_param = 'offset'
    max_limit = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'limit': self.limit,
            'offset': self.offset,
            'results': data
        })
